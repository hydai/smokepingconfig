import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  findNode,
  freshTree,
  loadFromStorage,
  mutateNode,
  removeNode,
  resetTree,
  saveToStorage,
  setIncluded,
  setLanguage,
  tree,
  walkNodes
} from '../../src/lib/store.js';

beforeEach(() => {
  resetTree('en');
});

describe('freshTree', () => {
  it('returns a clone of the catalog with language', () => {
    const t = freshTree('zh-TW');
    expect(t.language).toBe('zh-TW');
    expect(t.schemaVer).toBe(2);
    expect(t.nodes.length).toBeGreaterThan(0);
  });

  it('defaults language to en', () => {
    expect(freshTree().language).toBe('en');
  });

  it('returns independent clones (mutating one does not affect another)', () => {
    const a = freshTree();
    const b = freshTree();
    a.nodes[0].menu = 'mutated';
    expect(b.nodes[0].menu).not.toBe('mutated');
  });
});

describe('store: tree', () => {
  it('initializes with the fresh catalog', () => {
    const value = get(tree);
    expect(value.schemaVer).toBe(2);
    expect(value.nodes.length).toBeGreaterThan(0);
  });

  it('setIncluded toggles a node', () => {
    const first = get(tree).nodes[0];
    setIncluded(first.id, false);
    expect(findNode(get(tree).nodes, first.id)?.included).toBe(false);
    setIncluded(first.id, true);
    expect(findNode(get(tree).nodes, first.id)?.included).toBe(true);
  });

  it('setLanguage updates only language', () => {
    const nodesBefore = get(tree).nodes;
    setLanguage('zh-TW');
    const after = get(tree);
    expect(after.language).toBe('zh-TW');
    expect(after.nodes).toBe(nodesBefore);
  });

  it('mutateNode applies arbitrary edits', () => {
    const id = get(tree).nodes[0].id;
    mutateNode(id, (n) => {
      n.menu = 'edited';
      n.title = 'edited title';
    });
    const n = findNode(get(tree).nodes, id);
    expect(n?.menu).toBe('edited');
    expect(n?.title).toBe('edited title');
  });

  it('resetTree restores curated state but keeps language', () => {
    setLanguage('zh-TW');
    const id = get(tree).nodes[0].id;
    setIncluded(id, false);
    expect(findNode(get(tree).nodes, id)?.included).toBe(false);
    resetTree();
    expect(get(tree).language).toBe('zh-TW');
    expect(findNode(get(tree).nodes, id)?.included).toBe(true);
  });
});

describe('findNode, walkNodes, removeNode', () => {
  it('findNode descends recursively', () => {
    const nodes = get(tree).nodes;
    const cdn = nodes.find((n) => n.name === 'CDN')!;
    const cloudflare = findNode(nodes, `c:CDN/Cloudflare`);
    expect(cloudflare?.name).toBe('Cloudflare');
    expect(cloudflare).toBe(cdn.children.find((c) => c.name === 'Cloudflare'));
  });

  it('findNode returns null for missing ids', () => {
    expect(findNode(get(tree).nodes, 'c:Nope')).toBeNull();
  });

  it('walkNodes visits every node (including deeply nested)', () => {
    const seen: string[] = [];
    walkNodes(get(tree).nodes, (n) => seen.push(n.name));
    expect(seen).toContain('CDN');
    expect(seen).toContain('Cloudflare');
    expect(seen).toContain('HiNet');
  });

  it('removeNode removes deeply nested node', () => {
    const nodes = get(tree).nodes;
    const ok = removeNode(nodes, 'c:CDN/Cloudflare');
    expect(ok).toBe(true);
    expect(findNode(nodes, 'c:CDN/Cloudflare')).toBeNull();
  });

  it('removeNode returns false when not found', () => {
    expect(removeNode(get(tree).nodes, 'c:Nope')).toBe(false);
  });
});

describe('localStorage persistence (Node env has no window)', () => {
  it('loadFromStorage returns null outside a browser', () => {
    expect(loadFromStorage()).toBeNull();
  });

  it('saveToStorage returns false outside a browser', () => {
    expect(saveToStorage(freshTree())).toBe(false);
  });
});
