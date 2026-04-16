import { Command } from 'commander';

import { bundledVersion } from './base-resolver.js';
import { registerDiffBase } from './commands/diff-base.js';
import { registerInit } from './commands/init.js';
import { registerRender } from './commands/render.js';

const CLI_VERSION = '0.1.0';

function fullVersion(): string {
  const cat = bundledVersion();
  const catPart = cat ? `bundled catalog ${cat.date} @ ${cat.sha}` : 'bundled catalog unknown';
  return `smokepingconf v${CLI_VERSION}\n${catPart}`;
}

const program = new Command();

program
  .name('smokepingconf')
  .description(
    'SmokePing config builder — render Targets files from a committable patch YAML on top of a versioned base catalogue',
  )
  .version(fullVersion(), '-v, --version', 'print CLI version and bundled catalog stamp');

registerRender(program);
registerDiffBase(program);
registerInit(program);

program.parseAsync().catch((err) => {
  process.stderr.write(`smokepingconf: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
