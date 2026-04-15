import { defineConfig } from 'tsup';

// tsup bundles the CLI into a single self-contained dist/index.js so the
// package tarball doesn't need to locate or execute TypeScript at runtime.
// catalog.json is inlined via the JSON loader; cross-package imports from
// @smokepingconf/core are followed from source.
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: false,
  minify: false,
  dts: false,
  splitting: false,
  // Inline @smokepingconf/core (and its catalog.json import) so the CLI
  // tarball is self-contained — otherwise Node ESM would need `with
  // { type: 'json' }` attributes at runtime, which tsup doesn't synthesize
  // for external imports.
  noExternal: ['@smokepingconf/core'],
  // Prepend a shebang so `chmod +x dist/index.js` isn't needed — npm sets
  // the executable bit automatically when installing a package with a `bin`
  // field, and Node's loader skips the first line when the file is invoked
  // as a script.
  banner: { js: '#!/usr/bin/env node' }
});
