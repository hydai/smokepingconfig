import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseTargets } from '../../src/lib/parser.js';
import { serializeCatalog } from '../../src/lib/serializer.js';

const here = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(here, '../../config.txt');
const configText = readFileSync(configPath, 'utf8');

describe('parse ↔ serialize round-trip', () => {
  it('re-serializing the real config.txt produces a semantically identical tree', () => {
    const first = parseTargets(configText);
    const text = serializeCatalog(first);
    const second = parseTargets(text);
    expect(second).toEqual(first);
  });

  it('is a fixed point (serialize → parse → serialize yields the same text)', () => {
    const first = parseTargets(configText);
    const text1 = serializeCatalog(first);
    const second = parseTargets(text1);
    const text2 = serializeCatalog(second);
    expect(text2).toBe(text1);
  });
});
