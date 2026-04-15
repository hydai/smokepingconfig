import type { Command } from 'commander';

export function registerDiffBase(program: Command): void {
  program
    .command('diff-base <patch>')
    .description('report drift between a patch and its resolved base catalogue')
    .option('-b, --base <file>', 'local catalog.json path (overrides --base-url/bundled)')
    .option('-u, --base-url <url>', 'fetch catalog.json over HTTP(S)')
    .action(() => {
      process.stderr.write('diff-base: not yet implemented — comes in Phase 5\n');
      process.exit(2);
    });
}
