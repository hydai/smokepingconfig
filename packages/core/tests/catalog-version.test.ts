import { describe, expect, it } from 'vitest';

import catalog from '../src/catalog.json';
import type { Catalog } from '../src/types.js';

describe('catalog.json version stamp', () => {
  const c = catalog as Catalog;

  it('is schemaVer 2', () => {
    expect(c.schemaVer).toBe(2);
  });

  it('carries a version block populated by prebuild', () => {
    expect(c.version).toBeDefined();
  });

  it('date is ISO YYYY-MM-DD', () => {
    expect(c.version?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sha is 7-char hex or the "unknown" sentinel', () => {
    const sha = c.version?.sha ?? '';
    expect(sha === 'unknown' || /^[0-9a-f]{7}$/.test(sha)).toBe(true);
  });
});
