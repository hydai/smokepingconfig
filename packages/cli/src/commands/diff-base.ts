import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Command } from 'commander';

import { applyPatch, patchFromYaml } from '@smokepingconf/core';

import { resolveBase } from '../base-resolver.js';

interface DiffBaseOpts {
  base?: string;
  baseUrl?: string;
  onDrift: 'ignore' | 'warn' | 'error';
}

export function registerDiffBase(program: Command): void {
  program
    .command('diff-base <patch>')
    .description('report drift between a patch and its resolved base catalogue')
    .option('-b, --base <file>', 'local catalog.json path (overrides --base-url/bundled)')
    .option('-u, --base-url <url>', 'fetch catalog.json over HTTP(S)')
    .option(
      '--on-drift <mode>',
      'exit non-zero if drift is detected: ignore | warn | error',
      'warn',
    )
    .action(async (patchPath: string, opts: DiffBaseOpts) => {
      process.exit(await runDiffBase(patchPath, opts));
    });
}

export async function runDiffBase(patchPath: string, opts: DiffBaseOpts): Promise<number> {
  const base = await resolveBase(opts);
  const patchText = readFileSync(resolve(process.cwd(), patchPath), 'utf8');
  const patch = patchFromYaml(patchText);
  const { drift } = applyPatch(patch, base);

  const cleanReport = !drift.baseMismatch && drift.missingPaths.length === 0;
  if (cleanReport) {
    process.stdout.write('no drift — patch applies cleanly against the current base\n');
    return 0;
  }

  if (drift.baseMismatch) {
    const p = drift.baseMismatch.patch;
    const a = drift.baseMismatch.actual;
    process.stdout.write('baseVersion mismatch:\n');
    process.stdout.write(`  patch pinned: ${p.date} @ ${p.sha}\n`);
    process.stdout.write(`  current base: ${a ? `${a.date} @ ${a.sha}` : '(no version stamp)'}\n`);
  }
  if (drift.missingPaths.length > 0) {
    process.stdout.write(
      `paths referenced by patch but missing from base (${drift.missingPaths.length}):\n`,
    );
    for (const p of drift.missingPaths) process.stdout.write(`  - ${p}\n`);
  }

  return opts.onDrift === 'error' ? 1 : 0;
}
