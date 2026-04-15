// Resolve the base catalogue the CLI will diff / render against.
//
// Priority (most specific wins):
//   1. --base <file>   : a local catalog.json path (fully BYO, air-gap safe).
//   2. --base-url <url>: fetch a catalog.json via HTTP(S).
//   3. bundled snapshot: the catalogue compiled into the tarball at build time.
//
// The bundled snapshot is `@smokepingconf/core/catalog.json` — tsup inlines
// it into dist/index.js via the JSON loader, so the installed CLI is
// self-contained and works offline by default.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import bundledCatalogJson from '@smokepingconf/core/catalog.json';
import type { Catalog, CatalogVersion } from '@smokepingconf/core';

const bundledCatalog = bundledCatalogJson as Catalog;

export interface BaseOpts {
  base?: string;
  baseUrl?: string;
}

export async function resolveBase(opts: BaseOpts): Promise<Catalog> {
  if (opts.base) {
    const abs = resolve(process.cwd(), opts.base);
    const text = readFileSync(abs, 'utf8');
    return JSON.parse(text) as Catalog;
  }
  if (opts.baseUrl) {
    const res = await fetch(opts.baseUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      throw new Error(`--base-url ${opts.baseUrl}: HTTP ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as Catalog;
  }
  return bundledCatalog;
}

export function bundledVersion(): CatalogVersion | undefined {
  return bundledCatalog.version;
}

export { bundledCatalog };
