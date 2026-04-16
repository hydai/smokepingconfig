import { describe, expect, it } from 'vitest';

import { parseTargets } from '../src/parser.js';
import { serializeCatalog } from '../src/serializer.js';
import type { Catalog } from '../src/types.js';

describe('serializeCatalog', () => {
  it('emits the *** Targets *** header and root attributes', () => {
    const catalog: Catalog = {
      schemaVer: 2,
      root: { probe: 'FPing', menu: 'Top', title: 'Network Latency Grapher' },
      nodes: [],
    };
    const text = serializeCatalog(catalog);
    expect(text).toContain('*** Targets ***');
    expect(text).toContain('probe = FPing');
    expect(text).toContain('menu = Top');
    expect(text).toContain('title = Network Latency Grapher');
  });

  it('emits nested categories with correct + prefixes', () => {
    const catalog: Catalog = {
      schemaVer: 2,
      root: { probe: 'FPing', menu: 'Top', title: 'X' },
      nodes: [
        {
          id: 'c:A',
          source: 'curated',
          type: 'category',
          name: 'A',
          menu: 'A',
          title: 'A',
          included: true,
          children: [
            {
              id: 'c:A/B',
              source: 'curated',
              type: 'target',
              name: 'B',
              menu: 'B',
              title: 'B',
              included: true,
              host: '1.2.3.4',
              children: [],
            },
          ],
        },
      ],
    };
    const text = serializeCatalog(catalog);
    expect(text).toMatch(/^\+ A$/m);
    expect(text).toMatch(/^\+\+ B$/m);
    expect(text).toMatch(/^host = 1\.2\.3\.4$/m);
  });

  it('skips nodes with included=false', () => {
    const catalog: Catalog = {
      schemaVer: 2,
      root: { probe: 'FPing', menu: 'Top', title: 'X' },
      nodes: [
        {
          id: 'c:A',
          source: 'curated',
          type: 'target',
          name: 'A',
          menu: 'A',
          title: 'A',
          included: false,
          host: '1.1.1.1',
          children: [],
        },
      ],
    };
    const text = serializeCatalog(catalog);
    expect(text).not.toContain('+ A');
    expect(text).not.toContain('1.1.1.1');
  });

  it('emits probe-specific attributes in order', () => {
    const catalog: Catalog = {
      schemaVer: 2,
      root: { probe: 'FPing', menu: 'Top', title: 'X' },
      nodes: [
        {
          id: 'c:T',
          source: 'curated',
          type: 'target',
          name: 'T',
          menu: 'T',
          title: 'T',
          included: true,
          host: 'example.com',
          probe: { kind: 'EchoPingHttps', url: 'https://example.com/' },
          children: [],
        },
      ],
    };
    const text = serializeCatalog(catalog);
    expect(text).toContain('probe = EchoPingHttps');
    expect(text).toContain('url = https://example.com/');
  });

  it('emits parent comparison host lines for categories', () => {
    const catalog: Catalog = {
      schemaVer: 2,
      root: { probe: 'FPing', menu: 'Top', title: 'X' },
      nodes: [
        {
          id: 'c:Asia',
          source: 'curated',
          type: 'category',
          name: 'Asia',
          menu: 'Asia',
          title: 'Asia',
          included: true,
          comparisonChildren: ['/Asia/Taiwan/HiNet', '/Asia/Taiwan/TWM'],
          children: [
            {
              id: 'c:Asia/Taiwan',
              source: 'curated',
              type: 'category',
              name: 'Taiwan',
              menu: 'Taiwan',
              title: 'Taiwan',
              included: true,
              children: [
                {
                  id: 'c:Asia/Taiwan/HiNet',
                  source: 'curated',
                  type: 'target',
                  name: 'HiNet',
                  menu: 'HiNet',
                  title: 'HiNet',
                  included: true,
                  host: '1.1.1.1',
                  children: [],
                },
                {
                  id: 'c:Asia/Taiwan/TWM',
                  source: 'curated',
                  type: 'target',
                  name: 'TWM',
                  menu: 'TWM',
                  title: 'TWM',
                  included: true,
                  host: '2.2.2.2',
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    };
    const text = serializeCatalog(catalog);
    expect(text).toMatch(/^host = \/Asia\/Taiwan\/HiNet \/Asia\/Taiwan\/TWM$/m);
  });

  it('emits extra attributes after known ones', () => {
    const catalog: Catalog = {
      schemaVer: 2,
      root: { probe: 'FPing', menu: 'Top', title: 'X' },
      nodes: [
        {
          id: 'c:T',
          source: 'curated',
          type: 'target',
          name: 'T',
          menu: 'T',
          title: 'T',
          included: true,
          host: '1.1.1.1',
          extraAttrs: { alerts: 'bigloss', pings: '20' },
          children: [],
        },
      ],
    };
    const text = serializeCatalog(catalog);
    expect(text).toContain('alerts = bigloss');
    expect(text).toContain('pings = 20');
  });
});
