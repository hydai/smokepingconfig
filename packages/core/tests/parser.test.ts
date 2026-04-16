import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseTargets } from '../src/parser.js';

const here = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(here, '../../../config.txt');
const configText = readFileSync(configPath, 'utf8');

describe('parseTargets', () => {
  it('extracts root metadata', () => {
    const catalog = parseTargets(configText);
    expect(catalog.root.probe).toBe('FPing');
    expect(catalog.root.menu).toBe('Top');
    expect(catalog.root.title).toBe('Network Latency Grapher');
  });

  it('parses top-level categories', () => {
    const catalog = parseTargets(configText);
    const topNames = catalog.nodes.map((n) => n.name);
    expect(topNames).toEqual([
      'CDN',
      'Cloud',
      'Streaming',
      'Internet',
      'Asia',
      'DNS',
      'DNSProbes',
      'Hosting',
    ]);
  });

  it('assigns path-based IDs', () => {
    const catalog = parseTargets(configText);
    const cdn = catalog.nodes.find((n) => n.name === 'CDN')!;
    expect(cdn.id).toBe('c:CDN');
    const cf = cdn.children.find((n) => n.name === 'Cloudflare')!;
    expect(cf.id).toBe('c:CDN/Cloudflare');
  });

  it('preserves Chinese menu and title strings', () => {
    const catalog = parseTargets(configText);
    const asia = catalog.nodes.find((n) => n.name === 'Asia')!;
    const twm = asia.children
      .find((c) => c.name === 'Taiwan')!
      .children.find((c) => c.name === 'TWM')!;
    expect(twm.menu).toBe('台灣大寬頻');
  });

  it('captures parent comparison host paths', () => {
    const catalog = parseTargets(configText);
    const asia = catalog.nodes.find((n) => n.name === 'Asia')!;
    expect(asia.comparisonChildren).toEqual([
      '/Asia/Taiwan/HiNet',
      '/Asia/Taiwan/TWM',
      '/Asia/Taiwan/Seednet',
      '/Asia/Taiwan/SoNet',
      '/Asia/Taiwan/APTG',
    ]);
  });

  it('records probe override at section level', () => {
    const catalog = parseTargets(configText);
    const dnsProbes = catalog.nodes.find((n) => n.name === 'DNSProbes')!;
    expect(dnsProbes.probe?.kind).toBe('DNS');
  });

  it('leaf targets inherit probe implicitly (probe field undefined)', () => {
    const catalog = parseTargets(configText);
    const dnsProbes = catalog.nodes.find((n) => n.name === 'DNSProbes')!;
    const g1 = dnsProbes.children.find((n) => n.name === 'GoogleDNS1')!;
    expect(g1.probe).toBeUndefined();
    expect(g1.host).toBe('8.8.8.8');
  });

  it('handles deeply nested categories (+++)', () => {
    const catalog = parseTargets(configText);
    const linode = catalog.nodes
      .find((n) => n.name === 'Hosting')!
      .children.find((n) => n.name === 'Linode')!;
    expect(linode.children.map((c) => c.name)).toContain('US-East');
    expect(linode.comparisonChildren?.length).toBe(8);
  });
});

describe('parseTargets — small synthetic inputs', () => {
  it('handles empty input', () => {
    const catalog = parseTargets('');
    expect(catalog.nodes).toEqual([]);
    expect(catalog.root.probe).toBe('FPing');
  });

  it('strips *** Targets *** marker', () => {
    const catalog = parseTargets('*** Targets ***\n\n+ A\nhost = 1.2.3.4\n');
    expect(catalog.nodes).toHaveLength(1);
    expect(catalog.nodes[0].host).toBe('1.2.3.4');
  });

  it('joins line continuations', () => {
    const catalog = parseTargets('remark = hello \\\n world\n');
    expect(catalog.root.remark).toBe('hello  world');
  });

  it('skips comments', () => {
    const catalog = parseTargets('# comment\n+ A\nhost = x\n');
    expect(catalog.nodes[0].name).toBe('A');
  });

  it('preserves unknown attributes in extraAttrs', () => {
    const catalog = parseTargets('+ A\nhost = 1.1.1.1\nalerts = bigloss\npings = 20\n');
    expect(catalog.nodes[0].extraAttrs).toEqual({ alerts: 'bigloss', pings: '20' });
  });
});
