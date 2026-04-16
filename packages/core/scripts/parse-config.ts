// Build-time: parse the curated `config.txt` into `packages/core/src/catalog.json`
// so the runtime bundle imports the tree without shipping the parser.
//
// The output is stamped with `version = { date, sha }` so patch files can pin
// against a specific catalogue snapshot:
//   date: CATALOG_DATE env var, else today's UTC (YYYY-MM-DD).
//   sha : CATALOG_SHA env var, else `git rev-parse --short=7 HEAD`,
//         else 'unknown' when git is unavailable.
// Env vars let CI produce reproducible, deterministic builds; local dev
// uses git as the source of truth.

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTargets } from '../src/parser.ts';
import type { CatalogVersion } from '../src/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const source = resolve(repoRoot, 'config.txt');
const out = resolve(here, '../src/catalog.json');

function resolveVersion(): CatalogVersion {
  const date = process.env.CATALOG_DATE ?? new Date().toISOString().slice(0, 10);
  const envSha = process.env.CATALOG_SHA;
  if (envSha) return { date, sha: envSha };
  try {
    const sha = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return { date, sha };
  } catch {
    return { date, sha: 'unknown' };
  }
}

const text = await readFile(source, 'utf8');
const version = resolveVersion();
const catalog = parseTargets(text, version);

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(catalog, null, 2) + '\n');
console.log(
  `parsed ${source} → ${out} ` +
    `(${catalog.nodes.length} categories, schemaVer ${catalog.schemaVer}, ` +
    `version ${version.date}/${version.sha})`,
);
