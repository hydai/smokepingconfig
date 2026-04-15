// Render a Catalog back into a SmokePing `Targets` file.
//
// Inverse of `parser.ts`. Not byte-for-byte identical to the source `config.txt`
// (we normalise attribute order and whitespace) but semantically equivalent:
// parsing the output produces the same Catalog tree.

import type { Catalog, Node, Probe } from './types.js';

export function serializeCatalog(catalog: Catalog): string {
  const lines: string[] = [];
  lines.push('*** Targets ***', '');
  lines.push(`probe = ${catalog.root.probe}`, '');
  lines.push(`menu = ${catalog.root.menu}`);
  lines.push(`title = ${catalog.root.title}`);
  if (catalog.root.remark !== undefined) {
    lines.push(`remark = ${catalog.root.remark}`);
  }
  lines.push('');
  for (const node of catalog.nodes) {
    if (!node.included) continue;
    writeNode(node, 1, lines);
  }
  return lines.join('\n') + '\n';
}

function writeNode(node: Node, depth: number, lines: string[]): void {
  lines.push(`${'+'.repeat(depth)} ${node.name}`, '');
  lines.push(`menu = ${node.menu}`);
  lines.push(`title = ${node.title}`);

  if (node.type === 'target' && node.host !== undefined) {
    lines.push(`host = ${node.host}`);
  }
  if (node.type === 'category' && node.comparisonChildren && node.comparisonChildren.length > 0) {
    lines.push(`host = ${node.comparisonChildren.join(' ')}`);
  }

  if (node.probe) {
    writeProbe(node.probe, lines);
  }

  if (node.extraAttrs) {
    for (const [k, v] of Object.entries(node.extraAttrs)) {
      lines.push(`${k} = ${v}`);
    }
  }

  lines.push('');

  for (const child of node.children) {
    if (!child.included) continue;
    writeNode(child, depth + 1, lines);
  }
}

function writeProbe(probe: Probe, lines: string[]): void {
  lines.push(`probe = ${probe.kind}`);
  switch (probe.kind) {
    case 'FPing':
      break;
    case 'DNS':
      if (probe.lookup) lines.push(`lookup = ${probe.lookup}`);
      if (probe.recordType) lines.push(`recordtype = ${probe.recordType}`);
      break;
    case 'EchoPingHttp':
    case 'EchoPingHttps':
      if (probe.url) lines.push(`url = ${probe.url}`);
      break;
    case 'EchoPingPlugin':
      lines.push(`pingport = ${probe.pingport}`);
      break;
  }
}
