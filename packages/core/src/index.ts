// Public API for @smokepingconf/core.
//
// Pure-logic package: types, parser/serializer for SmokePing Targets files,
// probe metadata, tree helpers, and WorkingTree ↔ URL-hash delta encoding.
// No runtime dependencies on any framework.
//
// The curated catalogue is also exposed as a direct subpath import:
//   import catalog from '@smokepingconf/core/catalog.json';

export * from './types.js';
export * from './parser.js';
export * from './serializer.js';
export * from './probes.js';
export * from './tree.js';
export * from './url-state.js';
export * from './patch.js';
