// Metadata for the probes this tool emits.
//
// Drives the EditForm field set, the ProbesNotice snippet generation, and the
// default values when a user picks a probe from the dropdown.

import type { Node, Probe, ProbeKind } from './types.js';

export const PROBE_KINDS: readonly ProbeKind[] = [
  'FPing',
  'DNS',
  'EchoPingHttp',
  'EchoPingHttps',
  'EchoPingPlugin'
] as const;

export type FieldType = 'text' | 'number' | 'select';

export interface ProbeField {
  key: 'lookup' | 'recordType' | 'url' | 'pingport';
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: readonly { label: string; value: string }[];
}

export interface ProbeMeta {
  kind: ProbeKind;
  label: string;
  description: string;
  fields: readonly ProbeField[];
  // Emitted by ProbesNotice when this kind is used anywhere in the tree.
  probesSnippet: string;
}

const DNS_RECORD_OPTIONS = [
  { label: 'default (A)', value: '' },
  { label: 'A', value: 'A' },
  { label: 'AAAA', value: 'AAAA' },
  { label: 'MX', value: 'MX' },
  { label: 'TXT', value: 'TXT' },
  { label: 'NS', value: 'NS' }
] as const;

export const PROBE_META: Record<ProbeKind, ProbeMeta> = {
  FPing: {
    kind: 'FPing',
    label: 'FPing (ICMP)',
    description: 'ICMP ping latency. Works for most hosts.',
    fields: [],
    probesSnippet: `+ FPing
binary = /usr/sbin/fping
`
  },
  DNS: {
    kind: 'DNS',
    label: 'DNS',
    description: 'DNS lookup latency against a resolver.',
    fields: [
      { key: 'lookup', label: 'Lookup', type: 'text', placeholder: 'www.example.com' },
      { key: 'recordType', label: 'Record type', type: 'select', options: DNS_RECORD_OPTIONS }
    ],
    probesSnippet: `+ DNS
binary = /usr/bin/dig
lookup = www.example.com
`
  },
  EchoPingHttp: {
    kind: 'EchoPingHttp',
    label: 'EchoPingHttp',
    description: 'HTTP fetch latency.',
    fields: [
      {
        key: 'url',
        label: 'URL',
        type: 'text',
        placeholder: 'http://example.com/',
        required: true
      }
    ],
    probesSnippet: `+ EchoPingHttp
binary = /usr/bin/echoping
`
  },
  EchoPingHttps: {
    kind: 'EchoPingHttps',
    label: 'EchoPingHttps',
    description: 'HTTPS fetch latency.',
    fields: [
      {
        key: 'url',
        label: 'URL',
        type: 'text',
        placeholder: 'https://example.com/',
        required: true
      }
    ],
    probesSnippet: `+ EchoPingHttps
binary = /usr/bin/echoping
`
  },
  EchoPingPlugin: {
    kind: 'EchoPingPlugin',
    label: 'EchoPingPlugin (TCP)',
    description: 'Custom TCP port latency.',
    fields: [
      {
        key: 'pingport',
        label: 'Port',
        type: 'number',
        placeholder: '80',
        required: true
      }
    ],
    probesSnippet: `+ EchoPingPlugin
binary = /usr/bin/echoping
forks = 5
`
  }
};

export function defaultProbe(kind: ProbeKind): Probe {
  switch (kind) {
    case 'FPing':
      return { kind: 'FPing' };
    case 'DNS':
      return { kind: 'DNS' };
    case 'EchoPingHttp':
      return { kind: 'EchoPingHttp', url: '' };
    case 'EchoPingHttps':
      return { kind: 'EchoPingHttps', url: '' };
    case 'EchoPingPlugin':
      return { kind: 'EchoPingPlugin', pingport: 80 };
  }
}

// Read probe field values out of a Probe into a flat Record so forms can bind directly.
export function probeToFields(probe: Probe | undefined): Record<string, string> {
  if (!probe) return {};
  switch (probe.kind) {
    case 'FPing':
      return {};
    case 'DNS':
      return {
        lookup: probe.lookup ?? '',
        recordType: probe.recordType ?? ''
      };
    case 'EchoPingHttp':
    case 'EchoPingHttps':
      return { url: probe.url };
    case 'EchoPingPlugin':
      return { pingport: String(probe.pingport) };
  }
}

// Inverse of probeToFields. Returns undefined for 'inherit' (empty kind).
export function fieldsToProbe(
  kind: ProbeKind | '',
  fields: Record<string, string>
): Probe | undefined {
  if (kind === '') return undefined;
  switch (kind) {
    case 'FPing':
      return { kind: 'FPing' };
    case 'DNS': {
      const probe: Probe = { kind: 'DNS' };
      if (fields.lookup) probe.lookup = fields.lookup;
      const rt = fields.recordType;
      if (rt === 'A' || rt === 'AAAA' || rt === 'MX' || rt === 'TXT' || rt === 'NS') {
        probe.recordType = rt;
      }
      return probe;
    }
    case 'EchoPingHttp':
      return { kind: 'EchoPingHttp', url: fields.url ?? '' };
    case 'EchoPingHttps':
      return { kind: 'EchoPingHttps', url: fields.url ?? '' };
    case 'EchoPingPlugin':
      return { kind: 'EchoPingPlugin', pingport: Number(fields.pingport) || 80 };
  }
}

// Collect every declared probe kind in the tree (included nodes only).
// Used to emit a matching *** Probes *** snippet in ProbesNotice.
export function collectUsedProbes(nodes: Node[], rootKind: ProbeKind): Set<ProbeKind> {
  const used = new Set<ProbeKind>([rootKind]);
  const walk = (n: Node) => {
    if (!n.included) return;
    if (n.probe) used.add(n.probe.kind);
    for (const c of n.children) walk(c);
  };
  nodes.forEach(walk);
  return used;
}

export function probesFileSnippet(used: Set<ProbeKind>): string {
  const lines: string[] = ['*** Probes ***', ''];
  for (const kind of PROBE_KINDS) {
    if (used.has(kind)) {
      lines.push(PROBE_META[kind].probesSnippet);
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}
