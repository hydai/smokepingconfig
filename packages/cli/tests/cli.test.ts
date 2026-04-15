import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import catalogJson from '@smokepingconf/core/catalog.json';
import {
  encodePatch,
  findNode,
  freshTree,
  patchToYaml,
  type Catalog
} from '@smokepingconf/core';

const CLI = resolve(fileURLToPath(new URL('.', import.meta.url)), '../dist/index.js');
const catalog = catalogJson as Catalog;

interface RunResult {
  stdout: string;
  stderr: string;
  status: number;
}

function run(args: string[], cwd?: string): RunResult {
  const r = spawnSync('node', [CLI, ...args], { encoding: 'utf8', cwd });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status ?? -1 };
}

let scratch = '';

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'smokepingconf-cli-'));
});

afterEach(() => {
  // Best-effort: leave behind on failure for inspection.
});

function writePatchFile(name: string, yaml: string): string {
  const p = join(scratch, name);
  writeFileSync(p, yaml);
  return p;
}

// ---------------------------------------------------------------------------
// Bootstrap smoke (unchanged from Phase 4)
// ---------------------------------------------------------------------------
describe('smokepingconf — bootstrap surface', () => {
  it('--version prints CLI + bundled catalog stamp', () => {
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
});

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------
describe('smokepingconf render', () => {
  function happyPatchYaml(): string {
    const t = freshTree(catalog);
    findNode(t.nodes, 'c:CDN/Akamai')!.included = false;
    const cf = findNode(t.nodes, 'c:CDN/Cloudflare')!;
    cf.host = '1.1.1.1';
    return patchToYaml(encodePatch(t, catalog));
  }

  it('prints a Targets file to stdout for a happy-path patch', () => {
    const patchPath = writePatchFile('happy.yaml', happyPatchYaml());
    const r = run(['render', patchPath]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('*** Targets ***');
    expect(r.stdout).not.toContain('++ Akamai');
    expect(r.stdout).toContain('host = 1.1.1.1');
  });

  it('writes to --out and prints a summary to stderr', () => {
    const patchPath = writePatchFile('happy.yaml', happyPatchYaml());
    const outPath = join(scratch, 'Targets');
    const r = run(['render', patchPath, '--out', outPath]);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(r.stderr).toMatch(/wrote Targets|wrote .*Targets/);
    const written = readFileSync(outPath, 'utf8');
    expect(written).toContain('*** Targets ***');
  });

  describe('drift handling', () => {
    function driftPatchYaml(): string {
      const t = freshTree(catalog);
      findNode(t.nodes, 'c:CDN/Akamai')!.included = false;
      const patch = encodePatch(t, catalog);
      patch.excluded = ['/CDN/DoesNotExist'];
      return patchToYaml(patch);
    }

    it('warns to stderr and exits 0 with --on-drift=warn (default)', () => {
      const patchPath = writePatchFile('drift.yaml', driftPatchYaml());
      const r = run(['render', patchPath]);
      expect(r.status).toBe(0);
      expect(r.stderr).toContain('warning');
      expect(r.stderr).toContain('/CDN/DoesNotExist');
      expect(r.stdout).toContain('*** Targets ***');
    });

    it('fails with --on-drift=error', () => {
      const patchPath = writePatchFile('drift.yaml', driftPatchYaml());
      const r = run(['render', patchPath, '--on-drift', 'error']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('error');
      expect(r.stderr).toContain('/CDN/DoesNotExist');
    });

    it('silences stderr with --on-drift=ignore', () => {
      const patchPath = writePatchFile('drift.yaml', driftPatchYaml());
      const r = run(['render', patchPath, '--on-drift', 'ignore']);
      expect(r.status).toBe(0);
      expect(r.stderr).toBe('');
      expect(r.stdout).toContain('*** Targets ***');
    });

    it('reports baseVersion mismatch and exits 1 under --on-drift=error', () => {
      const t = freshTree(catalog);
      const patch = encodePatch(t, catalog);
      patch.baseVersion = { date: '2020-01-01', sha: 'aaaaaaa' };
      const patchPath = writePatchFile('mismatch.yaml', patchToYaml(patch));
      const r = run(['render', patchPath, '--on-drift', 'error']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('baseVersion mismatch');
      expect(r.stderr).toContain('aaaaaaa');
    });
  });

  it('rejects an unknown --on-drift value with exit 2', () => {
    const patchPath = writePatchFile('happy.yaml', happyPatchYaml());
    const r = run(['render', patchPath, '--on-drift', 'nope']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('--on-drift');
  });
});

// ---------------------------------------------------------------------------
// diff-base
// ---------------------------------------------------------------------------
describe('smokepingconf diff-base', () => {
  it('reports no drift for a clean patch', () => {
    const t = freshTree(catalog);
    const patchPath = writePatchFile('clean.yaml', patchToYaml(encodePatch(t, catalog)));
    const r = run(['diff-base', patchPath]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('no drift');
  });

  it('reports missing paths and (by default) exits 0', () => {
    const t = freshTree(catalog);
    const patch = encodePatch(t, catalog);
    patch.excluded = ['/CDN/Bunny'];
    const patchPath = writePatchFile('drift.yaml', patchToYaml(patch));
    const r = run(['diff-base', patchPath]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('/CDN/Bunny');
    expect(r.stdout).toContain('missing from base');
  });

  it('exits 1 when drift is detected and --on-drift=error', () => {
    const t = freshTree(catalog);
    const patch = encodePatch(t, catalog);
    patch.baseVersion = { date: '2020-01-01', sha: 'aaaaaaa' };
    const patchPath = writePatchFile('mismatch.yaml', patchToYaml(patch));
    const r = run(['diff-base', patchPath, '--on-drift', 'error']);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('baseVersion mismatch');
  });
});

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------
describe('smokepingconf init', () => {
  it('writes patch.yaml to cwd by default', () => {
    const r = run(['init'], scratch);
    expect(r.status).toBe(0);
    const content = readFileSync(join(scratch, 'patch.yaml'), 'utf8');
    expect(content).toContain('schema: 1');
    expect(content).toContain('baseVersion');
    expect(content).toContain(catalog.version?.sha ?? 'unknown');
    expect(content).toContain('# Example edits');
  });

  it('honours --out', () => {
    const outPath = join(scratch, 'my.patch.yml');
    const r = run(['init', '--out', outPath]);
    expect(r.status).toBe(0);
    expect(existsSync(outPath)).toBe(true);
  });

  it('refuses to clobber an existing file without --force', () => {
    const outPath = join(scratch, 'patch.yaml');
    writeFileSync(outPath, 'existing content');
    const r = run(['init', '--out', outPath]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('already exists');
    // File unchanged.
    expect(readFileSync(outPath, 'utf8')).toBe('existing content');
  });

  it('overwrites with --force', () => {
    const outPath = join(scratch, 'patch.yaml');
    writeFileSync(outPath, 'stale');
    const r = run(['init', '--out', outPath, '--force']);
    expect(r.status).toBe(0);
    expect(readFileSync(outPath, 'utf8')).toContain('schema: 1');
  });
});

// ---------------------------------------------------------------------------
// --base file (BYO catalog)
// ---------------------------------------------------------------------------
describe('--base file', () => {
  it('renders using a user-supplied catalog.json', () => {
    const basePath = join(scratch, 'base.json');
    writeFileSync(basePath, JSON.stringify(catalog));
    const t = freshTree(catalog);
    findNode(t.nodes, 'c:CDN/Akamai')!.included = false;
    const patchPath = writePatchFile('happy.yaml', patchToYaml(encodePatch(t, catalog)));
    const r = run(['render', patchPath, '--base', basePath]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('*** Targets ***');
  });
});
