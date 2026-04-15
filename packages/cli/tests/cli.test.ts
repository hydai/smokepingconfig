import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CLI = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../dist/index.js'
);

function runCli(args: string[]): { stdout: string; stderr: string; status: number } {
  const r = spawnSync('node', [CLI, ...args], { encoding: 'utf8' });
  return {
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    status: r.status ?? -1
  };
}

describe('smokepingconf CLI — Phase 4 bootstrap smoke', () => {
  it('--version prints CLI version and the bundled catalog stamp', () => {
    const out = execFileSync('node', [CLI, '--version'], { encoding: 'utf8' });
    expect(out).toMatch(/smokepingconf v\d+\.\d+\.\d+/);
    expect(out).toMatch(/bundled catalog \d{4}-\d{2}-\d{2} @ [0-9a-f]{7}|bundled catalog unknown/);
  });

  it('--help lists all three subcommands', () => {
    const out = execFileSync('node', [CLI, '--help'], { encoding: 'utf8' });
    expect(out).toContain('render');
    expect(out).toContain('diff-base');
    expect(out).toContain('init');
  });

  it('render --help exposes --base, --base-url, --on-drift, --out', () => {
    const out = execFileSync('node', [CLI, 'render', '--help'], { encoding: 'utf8' });
    expect(out).toContain('--base');
    expect(out).toContain('--base-url');
    expect(out).toContain('--on-drift');
    expect(out).toContain('--out');
  });

  it('stubs exit with status 2 and a "not yet implemented" banner', () => {
    for (const cmd of ['render', 'diff-base']) {
      const r = runCli([cmd, 'any.yaml']);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('not yet implemented');
    }
    const initResult = runCli(['init']);
    expect(initResult.status).toBe(2);
    expect(initResult.stderr).toContain('not yet implemented');
  });
});
