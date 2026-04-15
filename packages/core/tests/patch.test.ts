import { describe, expect, it } from 'vitest';

import catalogData from '../src/catalog.json';
import {
  applyPatch,
  decodeHashToPatch,
  encodePatch,
  encodePatchToHash,
  patchFromYaml,
  patchToYaml,
  readHashSlug
} from '../src/patch.js';
import { findNode, freshTree } from '../src/tree.js';
import { encodeTree } from '../src/url-state.js';
import type { Catalog, Node } from '../src/types.js';

const catalog = catalogData as Catalog;

function customHome(): Node {
  return {
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
}

describe('encodePatch / applyPatch', () => {
  it('fresh tree produces a minimal patch', () => {
    const p = encodePatch(freshTree(catalog), catalog);
    expect(p.schema).toBe(1);
    expect(p.excluded).toBeUndefined();
    expect(p.overrides).toBeUndefined();
    expect(p.custom).toBeUndefined();
  });

  it('baseVersion is captured from base.version', () => {
    const p = encodePatch(freshTree(catalog), catalog);
    expect(p.baseVersion).toEqual(catalog.version);
  });

  it('emits excluded as paths, not ids', () => {
    const t = freshTree(catalog);
    findNode(t.nodes, 'c:CDN/Akamai')!.included = false;
    const p = encodePatch(t, catalog);
    expect(p.excluded).toEqual(['/CDN/Akamai']);
  });

  it('emits overrides keyed by path', () => {
    const t = freshTree(catalog);
    findNode(t.nodes, 'c:CDN/Cloudflare')!.host = '1.1.1.1';
    const p = encodePatch(t, catalog);
    expect(p.overrides).toEqual({ '/CDN/Cloudflare': { host: '1.1.1.1' } });
  });

  it('round-trips excluded + overrides + custom', () => {
    const t = freshTree(catalog);
    findNode(t.nodes, 'c:CDN/Akamai')!.included = false;
    findNode(t.nodes, 'c:CDN/Cloudflare')!.host = '1.1.1.1';
    t.nodes.push(customHome());
    const p = encodePatch(t, catalog);
    const { tree, drift } = applyPatch(p, catalog);
    expect(drift.missingPaths).toEqual([]);
    expect(findNode(tree.nodes, 'c:CDN/Akamai')?.included).toBe(false);
    expect(findNode(tree.nodes, 'c:CDN/Cloudflare')?.host).toBe('1.1.1.1');
    const home = tree.nodes.find((n) => n.name === 'Home');
    expect(home?.source).toBe('custom');
    expect(home?.children.find((c) => c.name === 'Router')?.host).toBe('router.local');
  });

  it('custom PatchNode omits internal fields', () => {
    const t = freshTree(catalog);
    t.nodes.push(customHome());
    const p = encodePatch(t, catalog);
    const emitted = p.custom![0].node as unknown as Record<string, unknown>;
    expect(emitted.id).toBeUndefined();
    expect(emitted.source).toBeUndefined();
    expect(emitted.name).toBe('Home');
  });

  it('reports missing paths when patch references a path the base no longer has', () => {
    const p = encodePatch(freshTree(catalog), catalog);
    p.excluded = ['/CDN/Bunny', '/Does/Not/Exist'];
    const { drift } = applyPatch(p, catalog);
    expect(drift.missingPaths).toEqual(['/CDN/Bunny', '/Does/Not/Exist']);
  });

  it('reports baseMismatch when pinned sha differs', () => {
    const p = encodePatch(freshTree(catalog), catalog);
    p.baseVersion = { date: '2020-01-01', sha: 'aaaaaaa' };
    const { drift } = applyPatch(p, catalog);
    expect(drift.baseMismatch).not.toBeNull();
    expect(drift.baseMismatch?.patch.sha).toBe('aaaaaaa');
    expect(drift.baseMismatch?.actual?.sha).toBe(catalog.version?.sha);
  });

  it('no baseMismatch when shas match', () => {
    const p = encodePatch(freshTree(catalog), catalog);
    const { drift } = applyPatch(p, catalog);
    expect(drift.baseMismatch).toBeNull();
  });
});

describe('patchToYaml / patchFromYaml', () => {
  it('round-trips without field drift', () => {
    const t = freshTree(catalog);
    findNode(t.nodes, 'c:CDN/Akamai')!.included = false;
    findNode(t.nodes, 'c:CDN/Cloudflare')!.host = '1.1.1.1';
    t.nodes.push(customHome());
    const p1 = encodePatch(t, catalog);
    const yaml = patchToYaml(p1);
    const p2 = patchFromYaml(yaml);
    expect(p2).toEqual(p1);
  });

  it('produces a YAML mapping, not an array at top level', () => {
    const yaml = patchToYaml(encodePatch(freshTree(catalog), catalog));
    expect(yaml.startsWith('schema:')).toBe(true);
  });

  it('rejects YAML without a schema version', () => {
    expect(() => patchFromYaml('foo: bar')).toThrow(/schema/);
  });

  it('rejects wrong schema version', () => {
    const yaml = 'schema: 999\nbaseVersion:\n  date: x\n  sha: y\n';
    expect(() => patchFromYaml(yaml)).toThrow(/schema/);
  });

  it('rejects patches without baseVersion', () => {
    expect(() => patchFromYaml('schema: 1\n')).toThrow(/baseVersion/);
  });
});

describe('URL hash v:2 envelope', () => {
  it('encode and decode round-trip through the envelope', () => {
    const t = freshTree(catalog);
    findNode(t.nodes, 'c:CDN/Akamai')!.included = false;
    const p = encodePatch(t, catalog);
    const slug = encodePatchToHash(p);
    const decoded = decodeHashToPatch(slug);
    expect(decoded).toEqual(p);
  });

  it('rejects malformed envelope payload', () => {
    expect(decodeHashToPatch('not-an-lz-slug')).toBeNull();
    expect(decodeHashToPatch('')).toBeNull();
  });
});

describe('readHashSlug — unified v:2-first, v:1-fallback', () => {
  it('reads a v:2 slug (compressed patch YAML)', () => {
    const t = freshTree(catalog);
    findNode(t.nodes, 'c:CDN/Akamai')!.included = false;
    const slug = encodePatchToHash(encodePatch(t, catalog));
    const decoded = readHashSlug(slug, catalog);
    expect(decoded).toBeTruthy();
    expect(findNode(decoded!.nodes, 'c:CDN/Akamai')?.included).toBe(false);
  });

  it('falls back to v:1 (legacy TreeDiff JSON) slugs', () => {
    const t = freshTree(catalog);
    findNode(t.nodes, 'c:CDN/Akamai')!.included = false;
    const legacySlug = encodeTree(t, catalog);
    const decoded = readHashSlug(legacySlug, catalog);
    expect(decoded).toBeTruthy();
    expect(findNode(decoded!.nodes, 'c:CDN/Akamai')?.included).toBe(false);
  });

  it('returns null for garbage', () => {
    expect(readHashSlug('this-is-garbage', catalog)).toBeNull();
  });
});
