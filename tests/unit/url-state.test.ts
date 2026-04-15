import { describe, expect, it } from 'vitest';

import { freshTree, findNode, tree } from '../../src/lib/store.js';
import {
  applyDiff,
  computeDiff,
  decodeTree,
  encodeTree
} from '../../src/lib/url-state.js';
import type { Node, WorkingTree } from '../../src/lib/types.js';

function withCustom(t: WorkingTree, parentId: string | null, custom: Node): WorkingTree {
  if (parentId === null) {
    t.nodes.push(custom);
    return t;
  }
  const parent = findNode(t.nodes, parentId);
  if (parent) parent.children.push(custom);
  return t;
}

describe('computeDiff / applyDiff', () => {
  it('fresh tree produces a minimal diff', () => {
    const d = computeDiff(freshTree());
    expect(d).toEqual({ v: 1 });
  });

  it('round-trip preserves excluded ids', () => {
    const t = freshTree();
    const cf = findNode(t.nodes, 'c:CDN/Cloudflare')!;
    cf.included = false;
    const decoded = applyDiff(computeDiff(t));
    expect(findNode(decoded.nodes, 'c:CDN/Cloudflare')?.included).toBe(false);
  });

  it('round-trip preserves field overrides', () => {
    const t = freshTree();
    const dns = findNode(t.nodes, 'c:DNSProbes')!;
    dns.menu = 'MyDNS';
    dns.title = 'DNS Probe Set';
    const decoded = applyDiff(computeDiff(t));
    const round = findNode(decoded.nodes, 'c:DNSProbes')!;
    expect(round.menu).toBe('MyDNS');
    expect(round.title).toBe('DNS Probe Set');
  });

  it('round-trip preserves custom subtrees', () => {
    const t = freshTree();
    const custom: Node = {
      id: 'x:home',
      source: 'custom',
      type: 'category',
      name: 'Home',
      menu: 'Home',
      title: 'Home LAN',
      included: true,
      children: [
        {
          id: 'x:home/router',
          source: 'custom',
          type: 'target',
          name: 'Router',
          menu: 'Router',
          title: 'Router',
          included: true,
          host: 'router.local',
          children: []
        }
      ]
    };
    withCustom(t, null, custom);
    const decoded = applyDiff(computeDiff(t));
    const round = findNode(decoded.nodes, 'x:home');
    expect(round?.name).toBe('Home');
    expect(findNode(decoded.nodes, 'x:home/router')?.host).toBe('router.local');
  });

  it('omits `ex` and `ov` when no edits', () => {
    const d = computeDiff(freshTree());
    expect(d.ex).toBeUndefined();
    expect(d.ov).toBeUndefined();
    expect(d.cu).toBeUndefined();
  });

  it('records language only when non-default', () => {
    const t = freshTree('zh-TW');
    expect(computeDiff(t).lang).toBe('zh-TW');
    expect(computeDiff(freshTree('en')).lang).toBeUndefined();
  });

  it('records probe removal as null', () => {
    const t = freshTree();
    const dns = findNode(t.nodes, 'c:DNSProbes')!;
    expect(dns.probe?.kind).toBe('DNS');
    delete dns.probe;
    const d = computeDiff(t);
    expect(d.ov?.['c:DNSProbes']?.probe).toBeNull();
    const decoded = applyDiff(d);
    expect(findNode(decoded.nodes, 'c:DNSProbes')?.probe).toBeUndefined();
  });
});

describe('encodeTree / decodeTree', () => {
  it('URL-safe round-trip', () => {
    const t = freshTree();
    findNode(t.nodes, 'c:CDN/Cloudflare')!.included = false;
    const slug = encodeTree(t);
    expect(slug).toMatch(/^[A-Za-z0-9\-_$+]+$/);
    const decoded = decodeTree(slug);
    expect(decoded).toBeTruthy();
    expect(findNode(decoded!.nodes, 'c:CDN/Cloudflare')?.included).toBe(false);
  });

  it('rejects malformed slug', () => {
    expect(decodeTree('this is not a valid lz-string')).toBeNull();
    expect(decodeTree('')).toBeNull();
  });

  it('rejects wrong schema version', () => {
    // JSON that lz-compresses but has wrong v
    const bad = encodeTree({
      ...freshTree(),
      schemaVer: 1
    });
    // Replace the encoded v:1 with v:99 by round-tripping
    const raw = JSON.stringify({ v: 99 });
    const slug = (() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('lz-string').compressToEncodedURIComponent(raw) as string;
    })();
    expect(decodeTree(slug)).toBeNull();
    // Ensure the "bad" re-encoded slug still decodes (sanity)
    expect(decodeTree(bad)).toBeTruthy();
  });

  it('produces compact URLs for realistic edits', () => {
    const t = freshTree();
    // Simulate: disable 10 nodes, rename 3, add 2 customs
    const toDisable = [
      'c:CDN/Cloudflare',
      'c:CDN/Fastly',
      'c:DNS/GoogleDNS1',
      'c:DNS/GoogleDNS2',
      'c:DNS/OpenDNS1',
      'c:DNS/OpenDNS2',
      'c:DNS/L3-1',
      'c:DNS/L3-2',
      'c:DNS/Quad9',
      'c:Hosting/Linode/US-East'
    ];
    for (const id of toDisable) {
      const n = findNode(t.nodes, id);
      if (n) n.included = false;
    }
    const cdn = findNode(t.nodes, 'c:CDN')!;
    cdn.menu = 'My CDN';
    const streaming = findNode(t.nodes, 'c:Streaming')!;
    streaming.menu = 'Home Streaming';
    t.nodes.push({
      id: 'x:lan',
      source: 'custom',
      type: 'target',
      name: 'LAN',
      menu: 'LAN Router',
      title: 'LAN',
      included: true,
      host: '192.168.1.1',
      children: []
    });
    const slug = encodeTree(t);
    // Under 1500 chars is plenty for any real share target
    expect(slug.length).toBeLessThan(1500);
    const decoded = decodeTree(slug);
    expect(decoded).toBeTruthy();
    expect(findNode(decoded!.nodes, 'x:lan')?.host).toBe('192.168.1.1');
    expect(findNode(decoded!.nodes, 'c:CDN')?.menu).toBe('My CDN');
  });
});

describe('tree store integration — hash hydration', () => {
  it('freshTree matches applyDiff({v:1}) for default state', () => {
    const a = freshTree();
    const b = applyDiff({ v: 1 });
    expect(b.language).toBe(a.language);
    expect(b.nodes.length).toBe(a.nodes.length);
  });
});
