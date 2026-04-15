// Shared domain types for the SmokePing Config Builder.

export type ProbeKind = 'FPing' | 'DNS' | 'EchoPingHttp' | 'EchoPingHttps' | 'EchoPingPlugin';

export type DnsRecordType = 'A' | 'AAAA' | 'MX' | 'TXT' | 'NS';

export type Probe =
  | { kind: 'FPing' }
  | { kind: 'DNS'; lookup?: string; recordType?: DnsRecordType }
  | { kind: 'EchoPingHttp'; url: string }
  | { kind: 'EchoPingHttps'; url: string }
  | { kind: 'EchoPingPlugin'; pingport: number };

export type NodeSource = 'curated' | 'custom';
export type NodeType = 'category' | 'target';

export interface Node {
  // Stable ID. Curated nodes use path-based IDs ("c:CDN/Cloudflare") so they survive
  // catalog regeneration; custom nodes use UUIDs ("x:<uuid>").
  id: string;
  source: NodeSource;
  type: NodeType;

  // SmokePing section name (used to build `/Path/To/Node`). Distinct from `menu`
  // so rename/translation of the UI label does not break parent comparison paths.
  name: string;

  // User-facing label and hover text. Emitted as `menu = ...` and `title = ...`.
  menu: string;
  title: string;

  // Whether this node appears in the generated output. Lets users toggle
  // individual curated items off without deleting them from the tree.
  included: boolean;

  // Target-only: the host to ping (or probe-specific "host"). Categories leave this
  // undefined and use `comparisonChildren` instead.
  host?: string;

  // Probe declaration AT THIS NODE. May appear on a category (inherited by children)
  // or a target (explicit override). Undefined means "inherit from ancestor or root".
  probe?: Probe;

  // Children (categories). Empty for targets.
  children: Node[];

  // Category-only: SmokePing paths whose latency is aggregated into this parent's
  // comparison graph (e.g., ["/Asia/Taiwan/HiNet", "/Asia/Taiwan/TWM"]).
  comparisonChildren?: string[];

  // Preserve any attribute the parser did not recognise (e.g., `alerts`, `pings`,
  // `slaves`) so we can re-emit them verbatim on serialize.
  extraAttrs?: Record<string, string>;
}

export interface RootMeta {
  probe: ProbeKind;
  menu: string;
  title: string;
  remark?: string;
}

export interface Catalog {
  root: RootMeta;
  nodes: Node[];
  schemaVer: 1;
}

export type Language = 'en' | 'zh-TW';

export interface WorkingTree extends Catalog {
  language: Language;
}
