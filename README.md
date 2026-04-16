# SmokePing Config Builder

A bilingual (English / 繁體中文) toolkit for composing a [SmokePing](https://oss.oetiker.ch/smokeping/) `Targets` file from a shared curated catalogue plus your own patches.

- **Web app** — pick targets from the tree, edit any entry, export a committable `patch.yaml` or share via URL. Runs entirely in the browser.
- **CLI** (`smokeping-config`) — a single static binary (Rust, published to [crates.io](https://crates.io/crates/smokeping-config)) that renders the same patch against the bundled (or custom) base catalogue from the command line. No Node.js, no runtime deps. Scripts cleanly into Ansible, cron, GitHub Actions.

Both front-ends read and write the same YAML schema, so you can edit interactively and render reproducibly without the two going out of sync.

## Why base + patch?

Before this refactor, every user would export a monolithic `Targets` file and their edits would drift from the shared curated list as soon as anyone added a new CDN, ISP, or probe. Now the curated list is the **base**, your edits live in a **patch** (YAML, git-committable), and `render` composes them on demand. When upstream evolves, your patch keeps applying — and `diff-base` tells you which of your paths drifted.

## Quick start — web

Pick targets at <https://hydai.github.io/smokepingconfig/> (or your own deploy), edit as needed, then:

- **Download** — get the final monolithic `Targets` file.
- **Export patch** — save a `patch.yaml` you can commit to your own repo.
- **Import patch** — paste or upload an existing patch; the modal previews drift before applying.
- **Share** — copy a URL that encodes your patch (`#s=...`) for quick hand-off.

## Quick start — CLI

```sh
# install — pick one
cargo install smokeping-config
# or grab a prebuilt static binary from the GitHub Releases page:
#   smokeping-config-linux-x86_64, -linux-aarch64,
#   -macos-x86_64, -macos-aarch64, -windows-x86_64.exe

smokeping-config init                        # writes patch.yaml pinned to the bundled catalogue
# ... edit patch.yaml ...
smokeping-config render patch.yaml --out Targets
smokeping-config diff-base patch.yaml
```

Base resolution cascade: `--base <file>` → `--base-url <url>` → bundled snapshot.
Drift modes: `--on-drift=ignore | warn (default) | error`.

Running `smokeping-config --version` prints both the CLI version and the bundled catalogue's `{date, sha}` stamp, so CI logs record exactly which base was rendered against.

## Architecture

```
config.txt                       curated catalogue, source of truth
    │
    ▼  (prebuild)
packages/core/src/catalog.json   stamped with version = { date, sha }
    │
    ├─ @smokepingconf/core       pure logic — parser, serializer, patch model,
    │                            path ↔ id helpers, URL hash v:1/v:2
    │
    ├─ @smokepingconf/web        SvelteKit app — tree UI, Import/Export Patch
    │                            modal, live preview, share URL
    │
    └─ smokeping-config          clap CLI (Rust crate) — render / diff-base /
                                 init, ships as a static single binary with
                                 catalog.json embedded at compile time
```

`web` consumes `@smokepingconf/core` directly; `smokeping-config` embeds a build-time copy of `core`'s `catalog.json` via `build.rs`. Both are swappable front-ends over the same patch schema and merge algorithm.

## Development

Two toolchains, split by package:

- **Node 24** (see `.nvmrc`) for `packages/core/` (catalogue + TypeScript library) and `packages/web/` (SvelteKit app).
- **Rust 1.85+** (2024 edition) for `packages/cli-rs/` (the `smokeping-config` binary).

First-time setup:

```sh
npm install
npx playwright install chromium   # one-time, for E2E
```

Common Node commands (run from the repo root — they orchestrate across workspaces):

```sh
npm run dev           # SvelteKit dev server on :5173
npm run check         # tsc for core + svelte-check for web
npm test              # vitest in core and web
npm run build         # regenerates catalog.json + builds web
npm run test:e2e      # Playwright smoke flow (incl. Import/Export round-trip)
```

Rust CLI (run inside `packages/cli-rs/`):

```sh
cargo build --release          # produces target/release/smokeping-config
cargo test --release           # assert_cmd-based integration tests
cargo fmt --check
cargo clippy -- -D warnings
```

The CLI's `build.rs` copies `packages/core/src/catalog.json` into the build directory and embeds it via `include_str!`, so rerun `npm -w @smokepingconf/core run prebuild` before `cargo build --release` whenever `config.txt` changes.

## Project layout

```
config.txt                           curated catalogue source

packages/core/
├── src/
│   ├── types.ts                     Catalog, Node, Probe, CatalogVersion
│   ├── parser.ts / serializer.ts    SmokePing Targets ↔ Catalog
│   ├── probes.ts                    probe metadata + probesFileSnippet
│   ├── tree.ts                      findNode, freshTree, idToPath, pathToId
│   ├── url-state.ts                 TreeDiff + encodeTree/decodeTree (v:1)
│   ├── patch.ts                     Patch + encodePatch/applyPatch + YAML I/O
│   ├── catalog.json                 generated, version-stamped
│   └── index.ts                     barrel re-export
├── tests/                           parser, serializer, patch, probes,
│                                    roundtrip, tree, catalog-version
└── scripts/parse-config.ts          prebuild: config.txt → catalog.json

packages/web/
├── src/
│   ├── lib/store.ts                 Svelte writable + exportPatchYaml / previewPatchYaml
│   ├── lib/components/
│   │   ├── Actions.svelte           Copy / Download / Share / Export / Import / Reset
│   │   ├── ImportPatchModal.svelte  paste / upload + drift preview + apply
│   │   └── …                        TreeView, TreeNode, EditForm, Preview,
│   │                                ProbesNotice, AddButton, LangToggle
│   ├── lib/i18n/                    en.json, zh-TW.json, index.ts (loader)
│   └── routes/                      +layout.svelte, +layout.ts (SSR off),
│                                    +page.svelte
├── tests/unit/                      store, url-state
└── tests/e2e/flow.spec.ts           Playwright

packages/cli-rs/
├── src/
│   ├── main.rs                      clap entry (init / render / diff-base)
│   ├── base_resolver.rs             --base / --base-url / bundled cascade
│   ├── commands/                    init.rs · render.rs · diff_base.rs
│   ├── diff.rs · patch.rs           drift detection + YAML I/O
│   ├── serializer.rs · tree.rs      Targets emission + path helpers
│   └── types.rs                     Catalog / Node / Probe mirroring core
├── tests/cli_integration.rs         assert_cmd + tempfile
├── build.rs                         embeds catalog.json via include_str!
└── Cargo.toml                       release profile: strip, lto, opt-level=z
```

## Deployment

Push to `main` / `master` — GitHub Actions builds `packages/web/` and deploys to Pages via `actions/deploy-pages`. The workflow sets `BASE_PATH=/<repo-name>` so SvelteKit emits hashed assets under the right sub-path.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to add curated targets, new probe kinds, defaults, or translations. TL;DR: edit `config.txt` and run `npm run build` to regenerate `packages/core/src/catalog.json`; rerun `cargo build --release` inside `packages/cli-rs/` to re-embed it into the binary.

## License

[MIT](./LICENSE) © 2026 hydai
