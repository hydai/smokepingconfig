# Contributing

Thanks for wanting to extend the SmokePing Config Builder. The repo is a
mixed-toolchain monorepo — Node (npm workspaces) for the web app and the core
library, Rust (Cargo) for the CLI. The sections below map each kind of change
to the right package and the exact files you'll touch.

## Monorepo layout

| Package               | Where              | What lives here                                                                                            |
| --------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `@smokepingconf/core` | `packages/core/`   | Pure logic: types, parser / serializer, probes, tree helpers, patch model.                                 |
| `@smokepingconf/web`  | `packages/web/`    | SvelteKit app — tree editor, Import/Export Patch modal, share URL, i18n.                                   |
| `smokeping-config`    | `packages/cli-rs/` | `clap` CLI (Rust crate) — `render`, `diff-base`, `init`. Published to crates.io as a static single binary. |

The curated catalogue source of truth is `config.txt` at the repo root.
`npm run build` regenerates `packages/core/src/catalog.json`, stamped with
`version = { date, sha }`; `packages/cli-rs/build.rs` then copies that JSON
into the crate's `OUT_DIR` and embeds it at compile time, so the Rust CLI
is self-contained at runtime.

## Where do I add what?

| I want to add…                                                   | Go to                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| A new CDN, ISP, cloud, or other preset target                    | [Curated catalogue entries](#curated-catalogue-entries) |
| A new SmokePing probe kind                                       | [Probe kinds](#probe-kinds)                             |
| A new default menu / title / starter-node seed                   | [Root-level defaults](#root-level-defaults)             |
| A new UI string or translation fix                               | [i18n strings](#i18n-strings)                           |
| A patch-schema field (new top-level key, new per-node attribute) | [Patch schema changes](#patch-schema-changes)           |
| A new CLI subcommand or flag                                     | [CLI development](#cli-development)                     |
| A user-facing feature (saved presets, alerts, etc.)              | [Feature ideas](#feature-ideas)                         |

## Dev setup

Two toolchains, split by package:

- **Node 24** (see `.nvmrc`) for `packages/core/` and `packages/web/`.
- **Rust 1.85+** (2024 edition) for `packages/cli-rs/`. Install via
  [rustup](https://rustup.rs/); `rustup show` should list a toolchain at
  or above 1.85.

First-time setup:

```sh
npm install
npx playwright install chromium   # one-time, for E2E
npm run dev                       # http://localhost:5173
```

Before opening a PR (these mirror what CI runs in
`.github/workflows/ci.yml` and `.github/workflows/ci-cli-rs.yml`):

```sh
# Node side — core + web
npm run check     # core tsc + web svelte-check
npm test          # vitest across core and web
npm run build     # prebuild + web build
npm run test:e2e  # Playwright (boots `npm run build && npm run preview`)

# Rust side — run from packages/cli-rs/
cargo fmt --check
cargo clippy -- -D warnings
cargo test --release
cargo build --release
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
of `@smokepingconf/web`'s build, so Node CI does this automatically:

```sh
npm -w @smokepingconf/core run prebuild   # writes packages/core/src/catalog.json
npm run build                             # full Node orchestrated build
```

The Rust CLI picks up the regenerated `catalog.json` at its next compile —
`packages/cli-rs/build.rs` copies the file into `OUT_DIR` on every `cargo
build`, so after `prebuild` you'll want:

```sh
cd packages/cli-rs && cargo build --release
```

to re-embed the fresh catalogue into `target/release/smokeping-config`.

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
   stability) and the Rust CLI integration tests in
   `packages/cli-rs/tests/cli_integration.rs`. When mirroring a new
   field into the Rust side, update the shapes in
   `packages/cli-rs/src/patch.rs` / `src/types.rs` in lockstep.

## CLI development

The CLI is a Rust crate at `packages/cli-rs/`. Binary name
`smokeping-config`, published to crates.io under the same name. Minimum
Rust 1.85 (2024 edition).

The `clap` entry point is `src/main.rs` (derive API,
`disable_version_flag = true` so `-v` / `--version` prints the CLI
version plus the bundled catalog's `{date, sha}` stamp). Each
subcommand lives in its own module under `src/commands/`:

- `init.rs` — writes a minimal starter `patch.yaml` pinned to the
  bundled base.
- `render.rs` — composes base + patch and emits a `Targets` file.
- `diff_base.rs` — reports drift between a patch and the resolved base.

Shared helpers are split into focused modules: `base_resolver.rs` (the
`--base <file>` → `--base-url <url>` → bundled cascade, using `reqwest`
with rustls for the HTTP path), `patch.rs` (`serde_yaml_ng` I/O),
`diff.rs` (drift detection), `serializer.rs` (Targets emission),
`tree.rs` (path ↔ id helpers), `types.rs` (Catalog / Node / Probe
mirroring `@smokepingconf/core`).

The bundled catalogue is embedded at compile time: `build.rs` copies
`packages/core/src/catalog.json` into `OUT_DIR`, and `base_resolver.rs`
reads it via
`include_str!(concat!(env!("OUT_DIR"), "/catalog.json"))`. Changes to
`config.txt` therefore require re-running
`npm -w @smokepingconf/core run prebuild` before `cargo build --release`.

Integration tests live in `tests/cli_integration.rs` using `assert_cmd`
and `tempfile`. They cover `--version`, `--help`, each subcommand's
happy path, every `--on-drift` mode (`ignore` / `warn` / `error`),
`baseVersion` mismatches, and the exit-code contract (`0` success, `1`
error-mode drift / I/O / parse, `2` invalid flag value).

When adding a new subcommand or flag:

1. Add a `src/commands/<name>.rs` module that takes the parsed args
   struct and returns an exit code. Reuse `base_resolver` for base
   loading and `diff` for drift classification where applicable.
2. Register it in the `Commands` enum in `src/main.rs` (a
   `#[derive(Subcommand)]` variant) and dispatch to it from `main()`.
3. Add integration tests in `tests/cli_integration.rs` — happy path,
   error path, and each relevant `--on-drift` mode. Use `tempfile` to
   scope fixtures to the test run.

## Releasing the CLI

`packages/cli-rs/` ships on two channels — GitHub Releases (prebuilt
static binaries for Linux musl x86_64/aarch64, macOS x86_64/aarch64,
Windows MSVC x86_64) and crates.io — both driven by conventional-commit
automation. No developer ever edits `Cargo.toml`'s `version` field
directly.

**How it works** ([knope] 0.22.4, [Trusted Publishing][tp] via
[`rust-lang/crates-io-auth-action`][auth-action]):

1. Merge `feat(cli-rs):` / `fix(cli-rs):` commits to `master`. Other
   scopes (`feat(web):`, `fix(core):`) are ignored for Rust CLI
   releases thanks to `scopes = ["cli-rs"]` in `knope.toml`.
2. `.github/workflows/prepare-release-cli-rs.yml` runs on every push to
   master, notices there are unreleased conventional commits, and
   opens a release PR on the `release-cli-rs` branch with:
   - `packages/cli-rs/Cargo.toml` bumped (major/minor/patch per the
     commit types)
   - `packages/cli-rs/CHANGELOG.md` updated
   - Title: `chore: release smokeping-config X.Y.Z`
3. Review + merge the PR.
4. `.github/workflows/release-cli-rs.yml` fires on the merged PR:
   - Builds 5 target binaries in parallel
   - `knope release` creates the `smokeping-config/vX.Y.Z` tag and the
     GitHub Release with all 5 binaries attached
   - `publish-crate` OIDC-publishes the source crate to crates.io

[knope]: https://knope.tech/
[tp]: https://crates.io/docs/trusted-publishing
[auth-action]: https://github.com/rust-lang/crates-io-auth-action

**One-time maintainer setup** (already done):

- Registered a Trusted Publisher at
  <https://crates.io/crates/smokeping-config/settings> pointing at
  repository `hydai/smokepingconfig` + workflow `release-cli-rs.yml`.
- Bootstrap tag so knope has a baseline:
  ```sh
  git tag smokeping-config/v0.1.0 $(git rev-list -n 1 cli-rs-v0.1.0)
  git push origin smokeping-config/v0.1.0
  ```

**Smoke-testing without releasing**: `workflow_dispatch` on
`release-cli-rs.yml` runs the build matrix only (the `release` and
`publish-crate` jobs are gated on the merged PR). For packaging
changes, run `cargo publish --dry-run --allow-dirty` locally from
`packages/cli-rs/` after `cp ../core/src/catalog.json .`.

**Commit prefix cheatsheet** (scope must be `cli-rs` to count for the
Rust CLI release):

| Prefix                                           | Version bump              |
| ------------------------------------------------ | ------------------------- |
| `feat(cli-rs):`                                  | minor                     |
| `fix(cli-rs):`                                   | patch                     |
| `feat(cli-rs)!:`                                 | major                     |
| `fix(cli-rs)!:`                                  | major                     |
| `chore(cli-rs):`, `ci(cli-rs):`, `docs(cli-rs):` | no bump, not in changelog |

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
  by package where useful: `feat(core):`, `feat(web):`, `feat(cli-rs):`.
  The `cli-rs` scope is also what knope keys off for Rust-CLI releases
  (see [Releasing the CLI](#releasing-the-cli)).
- One concern per commit — split logically.
- Branch off `master`; open PRs against `master`.
- CI is split by toolchain and path-scoped:
  `.github/workflows/ci.yml` handles lint (`prettier --check` +
  `eslint`), type checking (`npm run check`), unit tests, build, and
  E2E for core + web. `.github/workflows/ci-cli-rs.yml` runs
  `cargo fmt --check`, `cargo clippy -- -D warnings`,
  `cargo test --release`, and a release build for `cli-rs`.
- The GitHub Pages deploy runs on push to `main` / `master` and
  regenerates `catalog.json` itself, so a slightly stale committed copy
  won't block deployment — but please still run `npm run build` locally
  to confirm there's no drift.

## PR checklist

Copy this into your PR description:

```
- [ ] Ran `npm run lint && npm run check && npm test`
- [ ] Ran `npm run build` (regenerates `packages/core/src/catalog.json` if `config.txt` changed)
- [ ] Ran `npm run test:e2e` if UI behaviour changed
- [ ] Ran `cargo fmt --check && cargo clippy -- -D warnings && cargo test --release && cargo build --release` in `packages/cli-rs/` if the Rust CLI changed (or `config.txt` / `catalog.json` did)
- [ ] Updated i18n keys in both `en.json` and `zh-TW.json`
- [ ] Updated `packages/core/tests/parser.test.ts` if top-level categories changed
- [ ] If touching the patch schema: updated `packages/core/`, `packages/web/`, `packages/cli-rs/`, and tests in lockstep
- [ ] Commit messages follow Conventional Commits (use `cli-rs` as the scope for Rust-CLI changes)
```
