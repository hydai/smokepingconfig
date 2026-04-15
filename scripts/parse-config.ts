// Build-time parser: reads config.txt from repo root and writes src/lib/catalog.json.
// Stub in Step 1 — real implementation arrives in Step 2.
// Writing an empty catalog keeps `npm run build` green during scaffolding.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..', 'src/lib/catalog.json');

await mkdir(dirname(out), { recursive: true });
await writeFile(
  out,
  JSON.stringify({ root: { probe: 'FPing', menu: 'Top', title: 'Network Latency Grapher' }, nodes: [], schemaVer: 1 }, null, 2) + '\n'
);
console.log('wrote', out);
