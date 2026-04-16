import { describe, expect, it } from 'vitest';

import catalogData from '../src/catalog.json';
import { findNode, freshTree, idToPath, pathToId, walkNodes } from '../src/tree.js';
import type { Catalog, Node } from '../src/types.js';

const catalog = catalogData as Catalog;

describe('freshTree', () => {
  it('clones the base catalog and attaches a language', () => {
    const t = freshTree(catalog, 'zh-TW');
    expect(t.language).toBe('zh-TW');
    expect(t.nodes.length).toBe(catalog.nodes.length);
  });

  it('returns independent clones — mutation does not leak', () => {
    const a = freshTree(catalog);
    const b = freshTree(catalog);
    a.nodes[0].menu = 'mutated';
    expect(b.nodes[0].menu).not.toBe('mutated');
  });
});

describe('findNode', () => {
  it('finds curated nodes by id across depth', () => {
    const n = findNode(catalog.nodes, 'c:CDN/Cloudflare');
    expect(n?.name).toBe('Cloudflare');
  });

  it('returns null for ids that do not exist', () => {
    expect(findNode(catalog.nodes, 'c:Nope')).toBeNull();
  });
});

describe('walkNodes', () => {
  it('visits every node in the forest', () => {
    let count = 0;
    walkNodes(catalog.nodes, () => count++);
    expect(count).toBeGreaterThan(20);
  });
});

describe('idToPath', () => {
  it('builds an absolute path from id', () => {
    expect(idToPath(catalog.nodes, 'c:CDN/Cloudflare')).toBe('/CDN/Cloudflare');
  });

  it('works for deeper paths', () => {
    expect(idToPath(catalog.nodes, 'c:Asia/Taiwan/HiNet')).toBe('/Asia/Taiwan/HiNet');
  });

  it('returns null for unknown ids', () => {
    expect(idToPath(catalog.nodes, 'c:Nope')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// pathToId — the inverse of idToPath. This is the function you'll implement
// in packages/core/src/tree.ts. The tests below spec the contract.
// ---------------------------------------------------------------------------
describe('pathToId', () => {
  it('resolves a curated path to its id', () => {
    expect(pathToId(catalog.nodes, '/CDN/Cloudflare')).toBe('c:CDN/Cloudflare');
  });

  it('resolves a deeper curated path', () => {
    expect(pathToId(catalog.nodes, '/Asia/Taiwan/HiNet')).toBe('c:Asia/Taiwan/HiNet');
  });

  it('resolves a top-level category', () => {
    expect(pathToId(catalog.nodes, '/CDN')).toBe('c:CDN');
  });

  it('returns null for a path that does not exist', () => {
    expect(pathToId(catalog.nodes, '/CDN/Bunny')).toBeNull();
  });

  it('returns null for partially-matching prefixes that overshoot the tree', () => {
    // "/CDN/Cloudflare" is a leaf target — extending it further has no match.
    expect(pathToId(catalog.nodes, '/CDN/Cloudflare/Extra')).toBeNull();
  });

  it('returns null for empty or root-only paths', () => {
    expect(pathToId(catalog.nodes, '')).toBeNull();
    expect(pathToId(catalog.nodes, '/')).toBeNull();
  });

  it('returns null for paths that do not start with /', () => {
    expect(pathToId(catalog.nodes, 'CDN/Cloudflare')).toBeNull();
  });

  it('returns null for paths with empty segments', () => {
    // Double-slash means an empty segment, which is malformed.
    expect(pathToId(catalog.nodes, '/CDN//Cloudflare')).toBeNull();
  });

  it('is case-sensitive — SmokePing names are filesystem-like', () => {
    expect(pathToId(catalog.nodes, '/cdn/cloudflare')).toBeNull();
  });

  it('resolves a custom subtree mixed with curated siblings', () => {
    const t = freshTree(catalog);
    const customCat: Node = {
      id: 'x:home-123',
      source: 'custom',
      type: 'category',
      name: 'Home',
      menu: 'Home',
      title: 'Home',
      included: true,
      children: [
        {
          id: 'x:home-123/router-456',
          source: 'custom',
          type: 'target',
          name: 'Router',
          menu: 'Router',
          title: 'Router',
          included: true,
          host: '192.168.1.1',
          children: [],
        },
      ],
    };
    t.nodes.push(customCat);
    expect(pathToId(t.nodes, '/Home')).toBe('x:home-123');
    expect(pathToId(t.nodes, '/Home/Router')).toBe('x:home-123/router-456');
  });

  it('round-trips with idToPath on every curated node', () => {
    walkNodes(catalog.nodes, (n) => {
      const p = idToPath(catalog.nodes, n.id);
      expect(p).not.toBeNull();
      expect(pathToId(catalog.nodes, p!)).toBe(n.id);
    });
  });
});
