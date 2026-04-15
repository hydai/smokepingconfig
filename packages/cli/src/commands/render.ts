import type { Command } from 'commander';

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
    .action(() => {
      process.stderr.write('render: not yet implemented — comes in Phase 5\n');
      process.exit(2);
    });
}
