import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Command } from 'commander';

import { patchToYaml, type Patch } from '@smokepingconf/core';

import { bundledVersion } from '../base-resolver.js';

interface InitOpts {
  out: string;
  force: boolean;
}

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('write a minimal starter patch.yaml pinned to the bundled base')
    .option('-o, --out <file>', 'output path for the starter patch', 'patch.yaml')
    .option('-f, --force', 'overwrite an existing file', false)
    .action(async (opts: InitOpts) => {
      process.exit(await runInit(opts));
    });
}

export async function runInit(opts: InitOpts): Promise<number> {
  const version = bundledVersion() ?? { date: 'unknown', sha: 'unknown' };
  const starter: Patch = { schema: 1, baseVersion: version };
  const body = patchToYaml(starter);

  const header =
    '# SmokePing config builder — patch file.\n' +
    '#\n' +
    '# Pin: this patch was initialised against the catalogue snapshot identified\n' +
    '# by `baseVersion`. Running `smokepingconf render <this-file>` applies the\n' +
    '# patch on top of that base. When upstream evolves, `smokepingconf diff-base`\n' +
    '# reports which of your paths drifted.\n' +
    '#\n' +
    '# Example edits — uncomment and adjust:\n' +
    '#\n' +
    '# excluded:\n' +
    '#   - /CDN/Akamai\n' +
    '#\n' +
    '# overrides:\n' +
    '#   /CDN/Cloudflare:\n' +
    '#     host: 1.1.1.1\n' +
    '#\n' +
    '# custom:\n' +
    '#   - parentPath: null\n' +
    '#     node:\n' +
    '#       type: category\n' +
    '#       name: MyStuff\n' +
    '#       menu: My Stuff\n' +
    '#       title: Personal targets\n\n';

  const outPath = resolve(process.cwd(), opts.out);
  try {
    writeFileSync(outPath, header + body, { flag: opts.force ? 'w' : 'wx' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'EEXIST') {
      process.stderr.write(`init: ${opts.out} already exists (pass --force to overwrite)\n`);
      return 1;
    }
    throw err;
  }
  process.stderr.write(`init: wrote ${opts.out} pinned to ${version.date} @ ${version.sha}\n`);
  return 0;
}
