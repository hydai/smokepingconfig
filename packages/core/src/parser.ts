// Parse a SmokePing `Targets` configuration into a Catalog tree.
//
// Supported syntax:
//   *** Targets ***       (section marker — skipped if present)
//   # comment             (skipped)
//   key = value           (attribute, attached to the most recently opened section)
//   key = value \         (line continuation; tail of next line appended)
//     more
//   + Name                (category at depth 1)
//   ++ Sub                (depth 2, child of most recent depth-1 section)
//
// Unknown attributes are preserved in `extraAttrs` so round-trip serialization
// is lossless for fields we do not model explicitly (e.g., `alerts`, `pings`).

import type { Catalog, CatalogVersion, Node, Probe, ProbeKind, RootMeta } from './types.js';

interface RawSection {
  depth: number;
  name: string;
  attrs: Record<string, string>;
  children: RawSection[];
}

const SECTION_HEADER = /^(\++)\s+(\S.*?)\s*$/;
const ATTRIBUTE_LINE = /^([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(.*?)\s*$/;

export function parseTargets(text: string, version?: CatalogVersion): Catalog {
  const lines = joinContinuations(text);
  const root: RawSection = { depth: 0, name: '', attrs: {}, children: [] };
  const stack: RawSection[] = [root];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) continue;
    if (line.startsWith('***') && line.endsWith('***')) continue;

    const header = matchSectionHeader(line);
    if (header) {
      while (stack.length > header.depth) stack.pop();
      const parent = stack[stack.length - 1];
      const node: RawSection = {
        depth: header.depth,
        name: header.name,
        attrs: {},
        children: []
      };
      parent.children.push(node);
      stack.push(node);
      continue;
    }

    const attr = matchAttribute(line);
    if (attr) {
      const current = stack[stack.length - 1];
      current.attrs[attr.key] = attr.value;
    }
    // Unrecognized lines are ignored silently — SmokePing itself tolerates them.
  }

  return rawToCatalog(root, version);
}

function joinContinuations(text: string): string[] {
  const raw = text.split(/\r?\n/);
  const out: string[] = [];
  let buf = '';
  for (const line of raw) {
    if (line.endsWith('\\')) {
      buf += line.slice(0, -1);
    } else {
      out.push(buf + line);
      buf = '';
    }
  }
  if (buf) out.push(buf);
  return out;
}

function matchSectionHeader(line: string): { depth: number; name: string } | null {
  const m = SECTION_HEADER.exec(line);
  if (!m) return null;
  return { depth: m[1].length, name: m[2] };
}

function matchAttribute(line: string): { key: string; value: string } | null {
  const m = ATTRIBUTE_LINE.exec(line);
  if (!m) return null;
  return { key: m[1], value: m[2] };
}

const KNOWN_ATTRS = new Set([
  'menu',
  'title',
  'host',
  'probe',
  'lookup',
  'recordtype',
  'url',
  'pingport',
  'remark'
]);

function rawToCatalog(root: RawSection, version?: CatalogVersion): Catalog {
  const rootProbe = (root.attrs.probe as ProbeKind | undefined) ?? 'FPing';
  const rootMeta: RootMeta = {
    probe: rootProbe,
    menu: root.attrs.menu ?? 'Top',
    title: root.attrs.title ?? 'Network Latency Grapher'
  };
  if (root.attrs.remark !== undefined) rootMeta.remark = root.attrs.remark;

  const catalog: Catalog = {
    schemaVer: 2,
    root: rootMeta,
    nodes: root.children.map((child) => rawToNode(child, ''))
  };
  if (version) catalog.version = version;
  return catalog;
}

function rawToNode(raw: RawSection, parentPath: string): Node {
  const path = parentPath ? `${parentPath}/${raw.name}` : raw.name;
  const isCategory = raw.children.length > 0;
  const attrs = raw.attrs;

  const node: Node = {
    id: `c:${path}`,
    source: 'curated',
    type: isCategory ? 'category' : 'target',
    name: raw.name,
    menu: attrs.menu ?? raw.name,
    title: attrs.title ?? raw.name,
    included: true,
    children: raw.children.map((child) => rawToNode(child, path))
  };

  const probe = buildProbe(attrs);
  if (probe) node.probe = probe;

  if (isCategory) {
    if (attrs.host && attrs.host.startsWith('/')) {
      node.comparisonChildren = attrs.host.split(/\s+/).filter(Boolean);
    }
  } else if (attrs.host !== undefined) {
    node.host = attrs.host;
  }

  const extras = collectExtras(attrs);
  if (Object.keys(extras).length > 0) node.extraAttrs = extras;

  return node;
}

function collectExtras(attrs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (!KNOWN_ATTRS.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

function buildProbe(attrs: Record<string, string>): Probe | undefined {
  const kind = attrs.probe as ProbeKind | undefined;
  if (!kind) return undefined;
  switch (kind) {
    case 'FPing':
      return { kind: 'FPing' };
    case 'DNS': {
      const probe: Probe = { kind: 'DNS' };
      if (attrs.lookup) probe.lookup = attrs.lookup;
      if (attrs.recordtype) {
        const rt = attrs.recordtype.toUpperCase();
        if (rt === 'A' || rt === 'AAAA' || rt === 'MX' || rt === 'TXT' || rt === 'NS') {
          probe.recordType = rt;
        }
      }
      return probe;
    }
    case 'EchoPingHttp':
      return { kind: 'EchoPingHttp', url: attrs.url ?? '' };
    case 'EchoPingHttps':
      return { kind: 'EchoPingHttps', url: attrs.url ?? '' };
    case 'EchoPingPlugin':
      return { kind: 'EchoPingPlugin', pingport: Number(attrs.pingport) || 80 };
    default:
      return undefined;
  }
}
