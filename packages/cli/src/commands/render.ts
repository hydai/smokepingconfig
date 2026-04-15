import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Command } from 'commander';

import { applyPatch, patchFromYaml, serializeCatalog, type Catalog } from '@smokepingconf/core';

import { resolveBase } from '../base-resolver.js';

export type DriftMode = 'ignore' | 'warn' | 'error';

interface RenderOpts {
  base?: string;
  baseUrl?: string;
  onDrift: DriftMode;
  out?: string;
}

export function registerRender(program: Command): void {
  program
    .command('render <patch>')
    .description('render a Targets file from a patch YAML + base catalogue')
    .option('-b, --base <file>', 'local catalog.json path (overrides --base-url/bundled)')
    .option('-u, --base-url <url>', 'fetch catalog.json over HTTP(S)')
    .option(
      '--on-drift <mode>',
      'behaviour when patch references paths missing from the base or pinned sha differs: ignore | warn | error',
      'warn'
    )
    .option('-o, --out <file>', 'write Targets to this file instead of stdout')
    .action(async (patchPath: string, opts: RenderOpts) => {
      process.exit(await runRender(patchPath, opts));
    });
}

export async function runRender(patchPath: string, opts: RenderOpts): Promise<number> {
  if (!isDriftMode(opts.onDrift)) {
    process.stderr.write(
      `render: --on-drift must be one of ignore | warn | error, got "${opts.onDrift}"\n`
    );
    return 2;
  }

  const base = await resolveBase(opts);
  const patchText = readFileSync(resolve(process.cwd(), patchPath), 'utf8');
  const patch = patchFromYaml(patchText);
  const { tree, drift } = applyPatch(patch, base);

  const driftLines = formatDrift(drift);
  if (driftLines.length > 0) {
    if (opts.onDrift === 'error') {
      for (const line of driftLines) process.stderr.write(`error: ${line}\n`);
      process.stderr.write('render: aborting due to drift (--on-drift=error)\n');
      return 1;
    }
    if (opts.onDrift === 'warn') {
      for (const line of driftLines) process.stderr.write(`warning: ${line}\n`);
    }
    // ignore → silent, continue
  }

  const targets = serializeCatalog(tree as Catalog);
  if (opts.out) {
    const outPath = resolve(process.cwd(), opts.out);
    writeFileSync(outPath, targets);
    process.stderr.write(`render: wrote ${opts.out} (${targets.length} bytes)\n`);
  } else {
    process.stdout.write(targets);
  }
  return 0;
}

function formatDrift(drift: {
  missingPaths: string[];
  baseMismatch: { patch: { date: string; sha: string }; actual?: { date: string; sha: string } } | null;
}): string[] {
  const lines: string[] = [];
  if (drift.baseMismatch) {
    const p = drift.baseMismatch.patch;
    const a = drift.baseMismatch.actual;
    lines.push(
      `baseVersion mismatch: patch pinned ${p.date} @ ${p.sha}` +
        (a ? `, current base is ${a.date} @ ${a.sha}` : ', current base has no version stamp')
    );
  }
  for (const p of drift.missingPaths) {
    lines.push(`path not present in base: ${p}`);
  }
  return lines;
}

function isDriftMode(v: string): v is DriftMode {
  return v === 'ignore' || v === 'warn' || v === 'error';
}
