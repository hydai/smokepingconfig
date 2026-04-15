// Reactive WorkingTree store.
//
// Hydration precedence (browser only):
//   1. URL hash (#s=...)   — populated by url-state.ts in Step 9
//   2. localStorage          — persisted from the previous session
//   3. Fresh curated catalog — built-in fallback
//
// Saves to localStorage on change, debounced by PERSIST_DEBOUNCE_MS.
// Works in Node for unit tests (persistence is a no-op without `window`).

import { get, writable, type Writable } from 'svelte/store';

import catalogData from './catalog.json';
import type { Catalog, Language, Node, WorkingTree } from './types.js';

export const STORAGE_KEY = 'smokepingconf:v1:state';
export const PERSIST_DEBOUNCE_MS = 200;

const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export function freshTree(language: Language = 'en'): WorkingTree {
  return structuredClone({ ...(catalogData as Catalog), language });
}

export function loadFromStorage(): WorkingTree | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidTree(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
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
  return t.schemaVer === 1 && Array.isArray(t.nodes) && t.root !== undefined;
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

// --- Pure helpers (exported for tests and later use) ------------------------

export function findNode(nodes: Node[], id: string): Node | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
  return null;
}

export function walkNodes(nodes: Node[], visit: (node: Node) => void): void {
  for (const n of nodes) {
    visit(n);
    walkNodes(n.children, visit);
  }
}

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
