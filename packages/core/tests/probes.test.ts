import { describe, expect, it } from 'vitest';

import {
  collectUsedProbes,
  defaultProbe,
  fieldsToProbe,
  probeToFields,
  probesFileSnippet,
} from '../src/probes.js';
import type { Node } from '../src/types.js';

function leaf(partial: Partial<Node> & { id: string; name: string }): Node {
  return {
    source: 'curated',
    type: 'target',
    menu: partial.name,
    title: partial.name,
    included: true,
    children: [],
    ...partial,
  };
}

describe('defaultProbe', () => {
  it('returns a valid probe for each kind', () => {
    expect(defaultProbe('FPing')).toEqual({ kind: 'FPing' });
    expect(defaultProbe('DNS')).toEqual({ kind: 'DNS' });
    expect(defaultProbe('EchoPingHttp')).toEqual({ kind: 'EchoPingHttp', url: '' });
    expect(defaultProbe('EchoPingHttps')).toEqual({ kind: 'EchoPingHttps', url: '' });
    expect(defaultProbe('EchoPingPlugin')).toEqual({ kind: 'EchoPingPlugin', pingport: 80 });
  });
});

describe('probeToFields / fieldsToProbe round-trip', () => {
  it('empty probe → empty fields → undefined', () => {
    expect(probeToFields(undefined)).toEqual({});
    expect(fieldsToProbe('', {})).toBeUndefined();
  });

  it('DNS with lookup and record type survives round trip', () => {
    const fields = probeToFields({ kind: 'DNS', lookup: 'example.com', recordType: 'AAAA' });
    expect(fields).toEqual({ lookup: 'example.com', recordType: 'AAAA' });
    expect(fieldsToProbe('DNS', fields)).toEqual({
      kind: 'DNS',
      lookup: 'example.com',
      recordType: 'AAAA',
    });
  });

  it('HTTP URL survives round trip', () => {
    const f = probeToFields({ kind: 'EchoPingHttps', url: 'https://a.test/' });
    expect(fieldsToProbe('EchoPingHttps', f)).toEqual({
      kind: 'EchoPingHttps',
      url: 'https://a.test/',
    });
  });

  it('pingport coerces to number', () => {
    expect(fieldsToProbe('EchoPingPlugin', { pingport: '443' })).toEqual({
      kind: 'EchoPingPlugin',
      pingport: 443,
    });
  });

  it('bad DNS record type is dropped', () => {
    expect(fieldsToProbe('DNS', { recordType: 'INVALID' })).toEqual({ kind: 'DNS' });
  });
});

describe('collectUsedProbes', () => {
  it('always includes the root kind', () => {
    expect(collectUsedProbes([], 'FPing')).toEqual(new Set(['FPing']));
  });

  it('adds declared kinds from included nodes only', () => {
    const nodes: Node[] = [
      leaf({ id: 'x:A', name: 'A', probe: { kind: 'DNS' } }),
      leaf({ id: 'x:B', name: 'B', included: false, probe: { kind: 'EchoPingHttps', url: '' } }),
      {
        id: 'x:C',
        source: 'curated',
        type: 'category',
        name: 'C',
        menu: 'C',
        title: 'C',
        included: true,
        probe: { kind: 'EchoPingHttp', url: '' },
        children: [leaf({ id: 'x:C/D', name: 'D' })],
      },
    ];
    const used = collectUsedProbes(nodes, 'FPing');
    expect(used).toEqual(new Set(['FPing', 'DNS', 'EchoPingHttp']));
  });
});

describe('probesFileSnippet', () => {
  it('emits a *** Probes *** section with entries ordered by PROBE_KINDS', () => {
    const snippet = probesFileSnippet(new Set(['FPing', 'DNS']));
    expect(snippet).toContain('*** Probes ***');
    expect(snippet.indexOf('+ FPing')).toBeLessThan(snippet.indexOf('+ DNS'));
  });

  it('only includes probes that are used', () => {
    const snippet = probesFileSnippet(new Set(['EchoPingPlugin']));
    expect(snippet).toContain('+ EchoPingPlugin');
    expect(snippet).not.toContain('+ FPing');
    expect(snippet).not.toContain('+ DNS');
  });
});
