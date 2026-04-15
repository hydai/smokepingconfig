import type { Command } from 'commander';

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('write a minimal starter patch.yaml pinned to the bundled base')
    .option('-o, --out <file>', 'output path for the starter patch', 'patch.yaml')
    .action(() => {
      process.stderr.write('init: not yet implemented — comes in Phase 5\n');
      process.exit(2);
    });
}
