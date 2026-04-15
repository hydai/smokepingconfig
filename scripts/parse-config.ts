// Build-time: parse the curated `config.txt` into `src/lib/catalog.json`
// so the runtime bundle imports the tree without shipping the parser.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTargets } from '../src/lib/parser.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const source = resolve(repoRoot, 'config.txt');
const out = resolve(repoRoot, 'src/lib/catalog.json');

const text = await readFile(source, 'utf8');
const catalog = parseTargets(text);

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(catalog, null, 2) + '\n');
console.log(
  `parsed ${source} → ${out} (${catalog.nodes.length} top-level categories, schemaVer ${catalog.schemaVer})`
);
