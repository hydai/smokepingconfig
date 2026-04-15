// Delta-encoded WorkingTree ↔ URL hash state.
//
// Size strategy: the curated catalog is ~26KB of JSON; we never send it over the
// wire. Instead we diff the current WorkingTree against the embedded catalog and
// transmit only (a) excluded curated ids, (b) per-id field overrides, (c) custom
// node subtrees. LZ-string compresses the diff JSON into a base64url-safe slug.
//
// Schema ownership: `v: 1` is bumped if we ever rename fields in a way that would
// confuse old share links. decode() returns null on unknown versions so the
// store falls back to fresh state instead of silently loading garbage.

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

import catalogData from './catalog.json';
import type { Catalog, Language, Node, Probe, RootMeta, WorkingTree } from './types.js';
import { findNode, freshTree } from './store.js';

const CATALOG = catalogData as Catalog;

export const URL_HASH_PREFIX = '#s=';
export const MAX_URL_LENGTH = 6000;

export interface NodeOverride {
  name?: string;
  menu?: string;
  title?: string;
  host?: string | null;
  probe?: Probe | null;
  comparisonChildren?: string[] | null;
}

export interface CustomEntry {
  parentId: string | null;
  node: Node;
}

export interface TreeDiff {
  v: 1;
  lang?: Language;
  root?: Partial<RootMeta>;
  ex?: string[];
  ov?: Record<string, NodeOverride>;
  cu?: CustomEntry[];
}

export function encodeTree(tree: WorkingTree): string {
  const diff = computeDiff(tree);
  return compressToEncodedURIComponent(JSON.stringify(diff));
}

export function decodeTree(s: string): WorkingTree | null {
  try {
    const json = decompressFromEncodedURIComponent(s);
    if (!json) return null;
    const diff = JSON.parse(json) as TreeDiff;
    if (diff?.v !== 1) return null;
    return applyDiff(diff);
  } catch {
    return null;
  }
}

export function computeDiff(tree: WorkingTree): TreeDiff {
  const diff: TreeDiff = { v: 1 };
  if (tree.language && tree.language !== 'en') diff.lang = tree.language;

  const root: Partial<RootMeta> = {};
  if (tree.root.probe !== CATALOG.root.probe) root.probe = tree.root.probe;
  if (tree.root.menu !== CATALOG.root.menu) root.menu = tree.root.menu;
  if (tree.root.title !== CATALOG.root.title) root.title = tree.root.title;
  if ((tree.root.remark ?? null) !== (CATALOG.root.remark ?? null)) {
    root.remark = tree.root.remark;
  }
  if (Object.keys(root).length > 0) diff.root = root;

  const ex: string[] = [];
  const ov: Record<string, NodeOverride> = {};
  const cu: CustomEntry[] = [];

  walkUserTree(tree.nodes, null, (node, parentId) => {
    if (node.source === 'custom') {
      cu.push({ parentId, node });
      return 'skip';
    }
    if (!node.included) ex.push(node.id);
    const curated = findNode(CATALOG.nodes, node.id);
    if (curated) {
      const delta = nodeFieldDiff(node, curated);
      if (delta) ov[node.id] = delta;
    }
    return 'continue';
  });

  if (ex.length > 0) diff.ex = ex;
  if (Object.keys(ov).length > 0) diff.ov = ov;
  if (cu.length > 0) diff.cu = cu;

  return diff;
}

export function applyDiff(diff: TreeDiff): WorkingTree {
  const tree = freshTree(diff.lang ?? 'en');

  if (diff.root) {
    if (diff.root.probe) tree.root.probe = diff.root.probe;
    if (diff.root.menu !== undefined) tree.root.menu = diff.root.menu;
    if (diff.root.title !== undefined) tree.root.title = diff.root.title;
    if (diff.root.remark !== undefined) tree.root.remark = diff.root.remark;
  }

  if (diff.ex) {
    for (const id of diff.ex) {
      const n = findNode(tree.nodes, id);
      if (n) n.included = false;
    }
  }

  if (diff.ov) {
    for (const [id, ov] of Object.entries(diff.ov)) {
      const n = findNode(tree.nodes, id);
      if (!n) continue;
      if (ov.name !== undefined) n.name = ov.name;
      if (ov.menu !== undefined) n.menu = ov.menu;
      if (ov.title !== undefined) n.title = ov.title;
      if (ov.host !== undefined) {
        n.host = ov.host === null ? undefined : ov.host;
      }
      if (ov.probe !== undefined) {
        if (ov.probe === null) delete n.probe;
        else n.probe = ov.probe;
      }
      if (ov.comparisonChildren !== undefined) {
        if (ov.comparisonChildren === null) delete n.comparisonChildren;
        else n.comparisonChildren = ov.comparisonChildren;
      }
    }
  }

  if (diff.cu) {
    for (const entry of diff.cu) {
      const parent = entry.parentId ? findNode(tree.nodes, entry.parentId) : null;
      if (parent) {
        parent.children.push(entry.node);
      } else {
        tree.nodes.push(entry.node);
      }
    }
  }

  return tree;
}

function walkUserTree(
  nodes: Node[],
  parentId: string | null,
  visit: (node: Node, parentId: string | null) => 'continue' | 'skip'
): void {
  for (const n of nodes) {
    const action = visit(n, parentId);
    if (action === 'continue') {
      walkUserTree(n.children, n.id, visit);
    }
  }
}

function nodeFieldDiff(user: Node, curated: Node): NodeOverride | null {
  const out: NodeOverride = {};
  if (user.name !== curated.name) out.name = user.name;
  if (user.menu !== curated.menu) out.menu = user.menu;
  if (user.title !== curated.title) out.title = user.title;
  if (user.host !== curated.host) {
    out.host = user.host === undefined ? null : user.host;
  }
  if (!sameProbe(user.probe, curated.probe)) {
    out.probe = user.probe === undefined ? null : user.probe;
  }
  if (!sameArray(user.comparisonChildren, curated.comparisonChildren)) {
    out.comparisonChildren =
      user.comparisonChildren === undefined ? null : user.comparisonChildren;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function sameProbe(a: Probe | undefined, b: Probe | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameArray(a: string[] | undefined, b: string[] | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

// --- Browser helpers --------------------------------------------------------

export function readHashState(): WorkingTree | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith(URL_HASH_PREFIX)) return null;
  return decodeTree(hash.slice(URL_HASH_PREFIX.length));
}

export function buildShareUrl(tree: WorkingTree): { url: string; length: number; ok: boolean } {
  const slug = encodeTree(tree);
  const base =
    typeof window !== 'undefined'
      ? window.location.href.split('#')[0]
      : 'https://example.com/';
  const url = `${base}${URL_HASH_PREFIX}${slug}`;
  return { url, length: url.length, ok: url.length <= MAX_URL_LENGTH };
}

export function writeHashState(tree: WorkingTree): void {
  if (typeof window === 'undefined') return;
  const slug = encodeTree(tree);
  history.replaceState(null, '', `${URL_HASH_PREFIX}${slug}`);
}
