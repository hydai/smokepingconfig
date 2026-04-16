// Reactive WorkingTree store.
//
// Hydration precedence (browser only):
//   1. URL hash (#s=...)   — populated by routes/+layout.svelte via url-state
//   2. localStorage         — persisted from the previous session
//   3. Fresh curated catalog — built-in fallback
//
// Saves to localStorage on change, debounced by PERSIST_DEBOUNCE_MS.
// Works in Node for unit tests (persistence is a no-op without `window`).
//
// Pure helpers (findNode, walkNodes, freshTree) now live in @smokepingconf/core
// and are re-exported here for the Svelte components and tests that still
// import them via $lib/store.

import { get, writable, type Writable } from 'svelte/store';

import catalogData from '@smokepingconf/core/catalog.json';
import {
  applyPatch,
  encodePatch,
  findNode,
  freshTree as coreFreshTree,
  idToPath,
  patchFromYaml,
  patchToYaml,
  walkNodes,
  type Catalog,
  type DriftReport,
  type Language,
  type Node,
  type WorkingTree,
} from '@smokepingconf/core';

export { findNode, walkNodes };

// The base catalogue used by every WorkingTree hydration in the web app.
// Kept as a separate const so tests and consumers can reference it too.
export const baseCatalog = catalogData as Catalog;

// Web-side convenience wrapper: pins the bundled catalogue as the base so
// existing call sites (`freshTree()`, `freshTree('zh-TW')`) keep working.
export function freshTree(language: Language = 'en'): WorkingTree {
  return coreFreshTree(baseCatalog, language);
}

// Serialise the current working tree as a patch YAML suitable for git-commit.
export function exportPatchYaml(): string {
  return patchToYaml(encodePatch(get(tree), baseCatalog));
}

// Parse a patch YAML and compute the resulting tree + drift report, without
// committing. The caller inspects drift and decides whether to apply via
// commitImportedTree.
export function previewPatchYaml(yamlText: string): { tree: WorkingTree; drift: DriftReport } {
  const patch = patchFromYaml(yamlText);
  return applyPatch(patch, baseCatalog);
}

// Commit a tree produced by previewPatchYaml (or any other source) to the
// reactive store.
export function commitImportedTree(t: WorkingTree): void {
  tree.set(t);
}

export const STORAGE_KEY = 'smokepingconf:v1:state';
export const PERSIST_DEBOUNCE_MS = 200;

const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export function loadFromStorage(): WorkingTree | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = migrateTree(JSON.parse(raw));
    if (!isValidTree(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// v1 and v2 are structurally identical (v2 adds an optional `version` field);
// bumping the number in place lets existing localStorage survive the schema
// change without forcing users to lose their working tree.
function migrateTree(v: unknown): unknown {
  if (!v || typeof v !== 'object') return v;
  const t = v as { schemaVer?: number };
  if (t.schemaVer === 1) t.schemaVer = 2;
  return v;
}

export function saveToStorage(t: WorkingTree): boolean {
  if (!isBrowser) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    return true;
  } catch {
    return false;
  }
}

export function clearStorage(): void {
  if (!isBrowser) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Intentionally swallowed — storage not available is not a failure mode for us.
  }
}

function isValidTree(v: unknown): v is WorkingTree {
  if (!v || typeof v !== 'object') return false;
  const t = v as Partial<WorkingTree>;
  return t.schemaVer === 2 && Array.isArray(t.nodes) && t.root !== undefined;
}

function hydrate(): WorkingTree {
  return loadFromStorage() ?? freshTree();
}

export const tree: Writable<WorkingTree> = writable(hydrate());

let persistTimer: ReturnType<typeof setTimeout> | undefined;
tree.subscribe((value) => {
  if (!isBrowser) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => saveToStorage(value), PERSIST_DEBOUNCE_MS);
});

// --- Mutators ---------------------------------------------------------------

export function resetTree(language?: Language): void {
  const lang = language ?? get(tree).language;
  tree.set(freshTree(lang));
}

export function setLanguage(language: Language): void {
  tree.update((t) => {
    t.language = language;
    return t;
  });
}

export function setIncluded(id: string, included: boolean): void {
  mutateNode(id, (n) => {
    n.included = included;
  });
}

export function mutateNode(id: string, mutator: (node: Node) => void): void {
  tree.update((t) => {
    const found = findNode(t.nodes, id);
    if (found) mutator(found);
    return t;
  });
}

// --- Pure helpers (remain here because they're only called by web UI) -------

// Remove a node anywhere in the tree. Returns true if removed.
export function removeNode(nodes: Node[], id: string): boolean {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      nodes.splice(i, 1);
      return true;
    }
    if (removeNode(nodes[i].children, id)) return true;
  }
  return false;
}

// Reorder siblings under a given parent (null = top-level) by the given id list.
// Any ids in the list but not in the children are ignored; any children not in
// the list keep their relative order after the listed ones.
export function reorderSiblings(parentId: string | null, orderedIds: string[]): void {
  tree.update((t) => {
    const arr = parentId ? findNode(t.nodes, parentId)?.children : t.nodes;
    if (!arr) return t;
    const rank = new Map<string, number>();
    orderedIds.forEach((id, i) => rank.set(id, i));
    arr.sort((a, b) => {
      const ra = rank.has(a.id) ? (rank.get(a.id) as number) : Number.POSITIVE_INFINITY;
      const rb = rank.has(b.id) ? (rank.get(b.id) as number) : Number.POSITIVE_INFINITY;
      return ra - rb;
    });
    return t;
  });
}

export function addTopLevel(node: Node): void {
  tree.update((t) => {
    t.nodes.push(node);
    return t;
  });
}

export function addChild(parentId: string, node: Node): void {
  tree.update((t) => {
    const parent = findNode(t.nodes, parentId);
    if (parent) parent.children.push(node);
    return t;
  });
}

export function newCustomCategory(): Node {
  return {
    id: `x:${crypto.randomUUID()}`,
    source: 'custom',
    type: 'category',
    name: 'NewCategory',
    menu: 'New category',
    title: 'New category',
    included: true,
    children: [],
  };
}

export function newCustomTarget(): Node {
  return {
    id: `x:${crypto.randomUUID()}`,
    source: 'custom',
    type: 'target',
    name: 'NewTarget',
    menu: 'New target',
    title: 'New target',
    included: true,
    children: [],
    host: '',
  };
}

// List every descendant leaf (target) under a given node id, returning
// { id, path, menu } triples. Useful for the comparison-graph picker.
export function listDescendants(
  nodes: Node[],
  id: string,
): { id: string; path: string; menu: string }[] {
  const root = findNode(nodes, id);
  if (!root) return [];
  const rootPath = idToPath(nodes, id);
  if (rootPath === null) return [];
  const out: { id: string; path: string; menu: string }[] = [];
  function walk(n: Node, prefix: string): void {
    for (const c of n.children) {
      const p = `${prefix}/${c.name}`;
      out.push({ id: c.id, path: p, menu: c.menu });
      walk(c, p);
    }
  }
  walk(root, rootPath);
  return out;
}
