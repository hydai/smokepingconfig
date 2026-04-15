# Contributing

Thanks for wanting to extend the SmokePing Config Builder. The repo is an npm
workspaces monorepo with three packages — the sections below map each kind of
change to the right workspace and the exact files you'll touch.

## Monorepo layout

| Package                  | Where                  | What lives here                                                                  |
| ------------------------ | ---------------------- | -------------------------------------------------------------------------------- |
| `@smokepingconf/core`    | `packages/core/`       | Pure logic: types, parser / serializer, probes, tree helpers, patch model.       |
| `@smokepingconf/web`     | `packages/web/`        | SvelteKit app — tree editor, Import/Export Patch modal, share URL, i18n.         |
| `@smokepingconf/cli`     | `packages/cli/`        | `commander` CLI — `render`, `diff-base`, `init`. Bundled via tsup.               |

The curated catalogue source of truth is `config.txt` at the repo root.
`npm run build` regenerates `packages/core/src/catalog.json`, stamped with
`version = { date, sha }`.

## Where do I add what?

| I want to add…                                                      | Go to                                                    |
| ------------------------------------------------------------------- | -------------------------------------------------------- |
| A new CDN, ISP, cloud, or other preset target                       | [Curated catalogue entries](#curated-catalogue-entries)  |
| A new SmokePing probe kind                                          | [Probe kinds](#probe-kinds)                              |
| A new default menu / title / starter-node seed                      | [Root-level defaults](#root-level-defaults)              |
| A new UI string or translation fix                                  | [i18n strings](#i18n-strings)                            |
| A patch-schema field (new top-level key, new per-node attribute)    | [Patch schema changes](#patch-schema-changes)            |
| A new CLI subcommand or flag                                        | [CLI development](#cli-development)                      |
| A user-facing feature (saved presets, alerts, etc.)                 | [Feature ideas](#feature-ideas)                          |

## Dev setup

Node 24 (see `.nvmrc`). First-time setup:

```sh
npm install
npx playwright install chromium   # one-time, for E2E
npm run dev                       # http://localhost:5173
```

Before opening a PR (these mirror what CI runs in
`.github/workflows/ci.yml`):

```sh
npm run check     # core tsc + web svelte-check + cli tsc
npm test          # vitest across core, web, cli
npm run build     # prebuild + web build + cli bundle
npm run test:e2e  # Playwright (boots `npm run build && npm run preview`)
```

## Curated catalogue entries

The curated tree users start from is generated from `config.txt` at the repo
root. It uses SmokePing's native `Targets` syntax: each `+` opens a top-level
category, each extra `+` nests deeper.

```smokeping
+ CDN

menu = CDN
title = CDN

++ Cloudflare
menu = Cloudflare
title = cloudflare.com
host = cloudflare.com
```

Adding a new provider is an extra `++` block under the right parent. The
recognised per-node attributes (see
`packages/core/src/parser.ts` `KNOWN_ATTRS`) are:
`menu`, `title`, `host`, `probe`, `lookup`, `recordtype`, `url`, `pingport`,
`remark`. Any unknown attribute is preserved verbatim via `extraAttrs` and
round-trips on save.

Regenerate the catalogue with either command — `prebuild` is a lifecycle hook
of web and CLI `build`, so CI does this automatically:

```sh
npm -w @smokepingconf/core run prebuild   # writes packages/core/src/catalog.json
npm run build                             # full orchestrated build
```

**Gotcha**: `packages/core/tests/parser.test.ts` locks the list of top-level
categories. If you add, remove, or rename a `+`-level entry, update the
expectation there.

## Probe kinds

Adding a new probe (e.g. `Curl`, `EchoPingIcmp`) currently touches several
files in `@smokepingconf/core`. Go through the checklist in order:

1. `packages/core/src/types.ts` — extend the `ProbeKind` union and add a
   new variant to the `Probe` discriminated union with the attributes the
   probe needs.
2. `packages/core/src/probes.ts` — append the kind to `PROBE_KINDS`, extend
   `ProbeField.key` if a new editable attribute is introduced, add a
   `PROBE_META` entry (`label`, `description`, `fields`, `probesSnippet`),
   and handle the new kind in `defaultProbe`, `probeToFields`, and
   `fieldsToProbe`.
3. `packages/core/src/parser.ts` — extend `buildProbe` so `config.txt`
   lines for your probe parse correctly (and extend `KNOWN_ATTRS` if
   needed).
4. `packages/core/src/serializer.ts` — emit the probe's attributes in
   `writeProbe`.
5. `packages/core/tests/probes.test.ts` — add a `defaultProbe` shape
   assertion and a `probeToFields / fieldsToProbe` round-trip case.
6. `packages/core/tests/roundtrip.test.ts` — add a fixture that parses
   and serialises a sample target using your new probe without drift.

Use `EchoPingHttp` as a minimal pattern to copy: one required string
field, one snippet, one default.

> **Maintainer note.** If probe additions become frequent, the natural
> follow-up is to collapse these files into a per-kind registry
> (`packages/core/src/probes/<kind>.ts` exporting a full `ProbeSpec`).
> Out of scope for a single-probe PR — flag it in the PR description.

## Root-level defaults

Two distinct layers use similar-looking code but serve different purposes.

**Catalogue-missing fallbacks** — used only when `config.txt` omits the root
`menu` / `title` / `probe`. Rarely changed.

- `packages/core/src/parser.ts` — `rawToCatalog()` fallbacks
  (`?? 'FPing'`, `?? 'Top'`, `?? 'Network Latency Grapher'`).

**New-user-node seeds** — the initial values for nodes the user creates via
the "+ Add category" / "+ Add target" buttons in the web UI. This is what
most contributors actually want to tweak.

- `packages/web/src/lib/store.ts` — `newCustomCategory()` and
  `newCustomTarget()`.

## i18n strings

Strings live in `packages/web/src/lib/i18n/en.json` and
`packages/web/src/lib/i18n/zh-TW.json`. Both files **must stay key-in-sync**;
svelte-i18n falls back silently if a key is missing in one language. When
adding a key:

1. Append it at the end of the nearest nesting group in `en.json`.
2. Add the same key to `zh-TW.json` with the Traditional Chinese translation.
3. Reference the key in your component via `$_('your.key.here')`.

Loading is set up in `packages/web/src/routes/+layout.svelte`.

## Patch schema changes

The patch YAML is the contract between the web editor and the CLI. Both
encode to and decode from the same shape via `@smokepingconf/core`. If you
add a top-level field or a per-node attribute:

1. Extend `Patch` / `PatchNode` / `NodeOverride` in
   `packages/core/src/patch.ts` (and the corresponding internal `TreeDiff`
   in `packages/core/src/url-state.ts` if the field should also participate
   in the `#s=` URL hash).
2. Wire the field through `encodePatch` (tree → patch) and `applyPatch`
   (patch → tree + drift). Update `toPatchNode` / `fromPatchNode` if it's a
   custom-node attribute.
3. Update `patchFromYaml` validation if the new field has required
   invariants (we currently gate only `schema` and `baseVersion`).
4. Decide on URL-hash compatibility: `v:2` carries patch YAML via
   `encodePatchToHash`, `v:1` is TreeDiff JSON via `encodeTree`. Adding
   an optional field is safe on both; adding a required field needs a
   version bump with a fallback decoder.
5. Update tests in `packages/core/tests/patch.test.ts` (round-trip + YAML
   stability) and the CLI integration tests in
   `packages/cli/tests/cli.test.ts`.

## CLI development

The CLI is bundled by tsup into a single ESM `dist/index.js`.
`noExternal: ['@smokepingconf/core', 'lz-string']` inlines the pure-TS
sources and `lz-string`'s CJS exports; `yaml` stays external because its
transitive `require('process')` trips tsup's ESM `__require` shim.

Subcommands live in `packages/cli/src/commands/`. Each file exports a
`register<Name>(program)` that adds a `commander` command and an async
action. The action delegates to a `run<Name>(args, opts)` function whose
exit code is the integer the CLI returns. Errors bubble up as rejected
promises to the top-level `parseAsync().catch(...)` which prints and
exits 1.

When adding a command:

1. Create `packages/cli/src/commands/<name>.ts` following the pattern
   above.
2. Register it in `packages/cli/src/index.ts`.
3. Add integration tests in `packages/cli/tests/cli.test.ts` that spawn
   the built `dist/index.js` via `spawnSync` and assert exit code + stdout
   + stderr. Use `encodePatch` + `patchToYaml` to generate fixture
   patches pinned to the bundled catalog's current `{date, sha}`.

### Releasing the CLI

`@smokepingconf/core` is a devDependency of `@smokepingconf/cli`; it is
inlined into the tsup bundle and never resolved from the public registry
at install time, so only the CLI needs publishing. The
`.github/workflows/release-cli.yml` workflow fires on tags matching
`cli-v*` and runs `npm publish --access public --provenance` with the
`NPM_TOKEN` repo secret.

To cut a release:

```sh
# Bump in a commit of its own so the tag points at a clean version bump.
npm -w @smokepingconf/cli version patch   # or minor / major
git push origin master
git push origin cli-v$(node -p "require('./packages/cli/package.json').version")
```

The workflow verifies the tag matches `packages/cli/package.json` before
publishing, reruns the CLI test suite as a last-mile gate, and publishes
with [npm provenance](https://docs.npmjs.com/generating-provenance-statements).

## Feature ideas

PRs welcome for these — open an issue first if they're non-trivial.

- **Saveable named presets.** Map of `{ name → patch.yaml }` in
  localStorage, exposed as a dropdown in `Actions.svelte`.
- **Alert modelling.** Alerts currently round-trip as opaque
  `extraAttrs`. First-class alert editing would expand the type and add an
  `AlertEditor` component.
- **IPv6 toggle per target.** A per-node boolean that flips the probe or
  emits `probe = FPing6` / equivalent on serialise.
- **CSV import** for bulk custom-target creation.
- **`@include`-style append output.** A CLI flag that splits the rendered
  Targets into a base-include + additions fragment for SmokePing's native
  `@include` — append-only, since `@include` can't express overrides or
  exclusions.

## Workflow & commit conventions

- Follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`, `ci:`. Scope
  by package where useful: `feat(core):`, `feat(web):`, `feat(cli):`.
- One concern per commit — split logically.
- Branch off `master`; open PRs against `master`.
- CI runs lint, unit tests across all three packages, build, and E2E on
  every PR.
- The GitHub Pages deploy runs on push to `main` / `master` and
  regenerates `catalog.json` itself, so a slightly stale committed copy
  won't block deployment — but please still run `npm run build` locally
  to confirm there's no drift.

## PR checklist

Copy this into your PR description:

```
- [ ] Ran `npm run check && npm test`
- [ ] Ran `npm run build` (regenerates `packages/core/src/catalog.json` if `config.txt` changed)
- [ ] Ran `npm run test:e2e` if UI behaviour changed
- [ ] Updated i18n keys in both `en.json` and `zh-TW.json`
- [ ] Updated `packages/core/tests/parser.test.ts` if top-level categories changed
- [ ] If touching the patch schema: updated core, web, CLI, and tests in lockstep
- [ ] Commit messages follow Conventional Commits
```
