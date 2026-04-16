// First-class patch artifact for the base + patch layered architecture.
//
// A Patch is the human-editable, git-committable form of a WorkingTree diff.
// It differs from the internal TreeDiff in two ways:
//
//   1. Addresses nodes by SmokePing path ("/CDN/Cloudflare") rather than by
//      internal id ("c:CDN/Cloudflare"), so git diffs stay readable and two
//      users can PR each other's patches.
//   2. Pins a `baseVersion` so the CLI / web can detect drift when the
//      upstream catalogue evolves.
//
// This module also owns the v:2 URL-hash format (compressed patch YAML) and
// provides unified browser helpers that try v:2 first and fall back to the
// legacy v:1 TreeDiff JSON so old share links keep working.

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';

import type {
  Catalog,
  CatalogVersion,
  Language,
  Node,
  NodeType,
  Probe,
  RootMeta,
  WorkingTree,
} from './types.js';
import { idToPath, pathToId } from './tree.js';
import {
  MAX_URL_LENGTH,
  URL_HASH_PREFIX,
  applyDiff,
  computeDiff,
  decodeTree,
  type CustomEntry,
  type NodeOverride,
  type TreeDiff,
} from './url-state.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const PATCH_SCHEMA = 1;
export const PATCH_URL_V = 2;

// Shape of a user-added node as it appears in a patch. Omits internal fields
// (id, source) — applyPatch regenerates those on hydration.
export interface PatchNode {
  type: NodeType;
  name: string;
  menu: string;
  title: string;
  included?: boolean;
  host?: string;
  probe?: Probe;
  comparisonChildren?: string[];
  extra?: Record<string, string>;
  children?: PatchNode[];
}

export interface PatchCustomEntry {
  parentPath: string | null;
  node: PatchNode;
}

export interface Patch {
  schema: typeof PATCH_SCHEMA;
  baseVersion: CatalogVersion;
  language?: Language;
  root?: Partial<RootMeta>;
  excluded?: string[];
  overrides?: Record<string, NodeOverride>;
  custom?: PatchCustomEntry[];
}

export interface DriftReport {
  missingPaths: string[];
  baseMismatch: { patch: CatalogVersion; actual?: CatalogVersion } | null;
}

// ---------------------------------------------------------------------------
// encode / apply
// ---------------------------------------------------------------------------

export function encodePatch(tree: WorkingTree, base: Catalog): Patch {
  const diff = computeDiff(tree, base);
  const patch: Patch = {
    schema: PATCH_SCHEMA,
    baseVersion: base.version ?? { date: 'unknown', sha: 'unknown' },
  };

  if (diff.lang) patch.language = diff.lang;
  if (diff.root) patch.root = diff.root;

  if (diff.ex) {
    const paths = diff.ex
      .map((id) => idToPath(base.nodes, id))
      .filter((p): p is string => p !== null);
    if (paths.length) patch.excluded = paths;
  }

  if (diff.ov) {
    const ov: Record<string, NodeOverride> = {};
    for (const [id, override] of Object.entries(diff.ov)) {
      const path = idToPath(base.nodes, id);
      if (path) ov[path] = override;
    }
    if (Object.keys(ov).length) patch.overrides = ov;
  }

  if (diff.cu && diff.cu.length) {
    patch.custom = diff.cu.map((entry) => ({
      parentPath: entry.parentId ? idToPath(tree.nodes, entry.parentId) : null,
      node: toPatchNode(entry.node),
    }));
  }

  return patch;
}

export function applyPatch(patch: Patch, base: Catalog): { tree: WorkingTree; drift: DriftReport } {
  const drift: DriftReport = { missingPaths: [], baseMismatch: null };

  if (base.version && patch.baseVersion && base.version.sha !== patch.baseVersion.sha) {
    drift.baseMismatch = { patch: patch.baseVersion, actual: base.version };
  }

  const diff: TreeDiff = { v: 1 };
  if (patch.language) diff.lang = patch.language;
  if (patch.root) diff.root = patch.root;

  if (patch.excluded) {
    const ids: string[] = [];
    for (const p of patch.excluded) {
      const id = pathToId(base.nodes, p);
      if (id) ids.push(id);
      else drift.missingPaths.push(p);
    }
    if (ids.length) diff.ex = ids;
  }

  if (patch.overrides) {
    const ov: Record<string, NodeOverride> = {};
    for (const [path, override] of Object.entries(patch.overrides)) {
      const id = pathToId(base.nodes, path);
      if (id) ov[id] = override;
      else drift.missingPaths.push(path);
    }
    if (Object.keys(ov).length) diff.ov = ov;
  }

  if (patch.custom) {
    const cu: CustomEntry[] = [];
    for (const entry of patch.custom) {
      let parentId: string | null = null;
      if (entry.parentPath) {
        const resolved = pathToId(base.nodes, entry.parentPath);
        if (resolved === null) {
          drift.missingPaths.push(entry.parentPath);
          // Attach to root as a best-effort fallback.
        } else {
          parentId = resolved;
        }
      }
      cu.push({ parentId, node: fromPatchNode(entry.node) });
    }
    if (cu.length) diff.cu = cu;
  }

  const tree = applyDiff(diff, base);
  return { tree, drift };
}

function toPatchNode(node: Node): PatchNode {
  const p: PatchNode = {
    type: node.type,
    name: node.name,
    menu: node.menu,
    title: node.title,
  };
  if (!node.included) p.included = false;
  if (node.host !== undefined) p.host = node.host;
  if (node.probe) p.probe = node.probe;
  if (node.comparisonChildren) p.comparisonChildren = node.comparisonChildren;
  if (node.extraAttrs && Object.keys(node.extraAttrs).length) p.extra = node.extraAttrs;
  if (node.children.length) p.children = node.children.map(toPatchNode);
  return p;
}

function fromPatchNode(p: PatchNode): Node {
  const n: Node = {
    id: `x:${crypto.randomUUID()}`,
    source: 'custom',
    type: p.type,
    name: p.name,
    menu: p.menu,
    title: p.title,
    included: p.included ?? true,
    children: p.children ? p.children.map(fromPatchNode) : [],
  };
  if (p.host !== undefined) n.host = p.host;
  if (p.probe) n.probe = p.probe;
  if (p.comparisonChildren) n.comparisonChildren = p.comparisonChildren;
  if (p.extra) n.extraAttrs = p.extra;
  return n;
}

// ---------------------------------------------------------------------------
// YAML I/O
// ---------------------------------------------------------------------------

export function patchToYaml(patch: Patch): string {
  return yamlStringify(patch, { lineWidth: 100 });
}

export function patchFromYaml(text: string): Patch {
  const parsed = yamlParse(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('patchFromYaml: input is not a YAML mapping');
  }
  const p = parsed as Partial<Patch>;
  if (p.schema !== PATCH_SCHEMA) {
    throw new Error(
      `patchFromYaml: unsupported schema (got ${String(p.schema)}, expected ${PATCH_SCHEMA})`,
    );
  }
  if (!p.baseVersion || typeof p.baseVersion.sha !== 'string') {
    throw new Error('patchFromYaml: missing or malformed baseVersion');
  }
  return parsed as Patch;
}

// ---------------------------------------------------------------------------
// URL hash — v:2 carries compressed patch YAML, v:1 (legacy TreeDiff JSON)
// still decoded for back-compat.
// ---------------------------------------------------------------------------

interface HashEnvelopeV2 {
  v: typeof PATCH_URL_V;
  y: string;
}

export function encodePatchToHash(patch: Patch): string {
  const envelope: HashEnvelopeV2 = { v: PATCH_URL_V, y: patchToYaml(patch) };
  return compressToEncodedURIComponent(JSON.stringify(envelope));
}

export function decodeHashToPatch(s: string): Patch | null {
  try {
    const json = decompressFromEncodedURIComponent(s);
    if (!json) return null;
    const envelope = JSON.parse(json) as HashEnvelopeV2;
    if (envelope?.v !== PATCH_URL_V || typeof envelope.y !== 'string') return null;
    return patchFromYaml(envelope.y);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Browser helpers — unified v:2-first, v:1-fallback.
// These replace the v:1-only helpers that used to live in url-state.ts.
// ---------------------------------------------------------------------------

export function readHashState(base: Catalog): WorkingTree | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith(URL_HASH_PREFIX)) return null;
  const slug = hash.slice(URL_HASH_PREFIX.length);
  return readHashSlug(slug, base);
}

// Exported separately so tests / CLI can feed in a slug without a real
// window.location.hash.
export function readHashSlug(slug: string, base: Catalog): WorkingTree | null {
  const patch = decodeHashToPatch(slug);
  if (patch) return applyPatch(patch, base).tree;
  // Legacy v:1 fallback.
  return decodeTree(slug, base);
}

export function writeHashState(tree: WorkingTree, base: Catalog): void {
  if (typeof window === 'undefined') return;
  const slug = encodePatchToHash(encodePatch(tree, base));
  history.replaceState(null, '', `${URL_HASH_PREFIX}${slug}`);
}

export function buildShareUrl(
  tree: WorkingTree,
  base: Catalog,
): { url: string; length: number; ok: boolean } {
  const slug = encodePatchToHash(encodePatch(tree, base));
  const baseUrl =
    typeof window !== 'undefined' ? window.location.href.split('#')[0] : 'https://example.com/';
  const url = `${baseUrl}${URL_HASH_PREFIX}${slug}`;
  return { url, length: url.length, ok: url.length <= MAX_URL_LENGTH };
}
