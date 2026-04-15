// Pure tree manipulation and hydration helpers.
//
// These were originally in packages/web/src/lib/store.ts, but they have no
// Svelte dependency — the reactive store and localStorage wrappers stay web
// side, these pure operations move here so the CLI and any future consumer
// can reuse them without pulling in Svelte.

import type { Catalog, Language, Node, WorkingTree } from './types.js';

// Build a fresh WorkingTree by structurally cloning the given catalogue and
// attaching a language. The returned object is safe to mutate independently
// of the source catalog.
export function freshTree(base: Catalog, language: Language = 'en'): WorkingTree {
  return structuredClone({ ...base, language });
}

// Depth-first lookup by stable id (curated "c:..." or custom "x:..."). Returns
// null if no match is found.
export function findNode(nodes: Node[], id: string): Node | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
  return null;
}

// Visit every node in the forest in pre-order.
export function walkNodes(nodes: Node[], visit: (node: Node) => void): void {
  for (const n of nodes) {
    visit(n);
    walkNodes(n.children, visit);
  }
}

// ---------------------------------------------------------------------------
// Path <-> id bridge for the patch file format.
//
// Patch YAML addresses nodes by SmokePing path ("/CDN/Cloudflare") — a
// human-readable, stable-under-rename handle. The in-memory diff, though,
// keys by node.id ("c:CDN/Cloudflare" for curated, "x:<uuid>" for custom).
// These helpers convert between the two so the patch serialiser can emit
// paths while the merge algorithm keeps speaking ids.
// ---------------------------------------------------------------------------

// Absolute SmokePing path for a node by id ("/CDN/Cloudflare"). Returns null
// if the id is not present in the forest. Paths always begin with '/'.
export function idToPath(nodes: Node[], id: string): string | null {
  function walk(arr: Node[], prefix: string): string | null {
    for (const n of arr) {
      const path = `${prefix}/${n.name}`;
      if (n.id === id) return path;
      const sub = walk(n.children, path);
      if (sub) return sub;
    }
    return null;
  }
  return walk(nodes, '');
}

// Inverse of idToPath: resolve a SmokePing path like "/CDN/Cloudflare" back
// to the node's id in the given forest. Returns null if no node matches at
// that path. Matching is exact on each segment; the function is the base
// lookup used when applying a patch's `excluded`, `overrides`, and `custom`
// keys to the working tree.
//
// Semantics to enforce:
//   - `path` must start with '/' and have no empty segments (so "/CDN" is ok
//     but "CDN" or "/CDN//Cloudflare" or "/" return null).
//   - For each segment, match a child's `name` field exactly (case-sensitive;
//     SmokePing names are filesystem-like).
//   - Returns the id of the last matched node, or null if any segment fails
//     to match.
//   - Accepts a mix of curated and custom nodes: a custom node added under
//     "/MyStuff/Router" must be reachable by that path even though its id is
//     an "x:<uuid>".
export function pathToId(nodes: Node[], path: string): string | null {
  if (!path || !path.startsWith('/')) return null;
  const segments = path.slice(1).split('/');
  if (segments.some((s) => s === '')) return null;
  let current: Node[] = nodes;
  let match: Node | null = null;
  for (const seg of segments) {
    match = current.find((n) => n.name === seg) ?? null;
    if (!match) return null;
    current = match.children;
  }
  return match?.id ?? null;
}
