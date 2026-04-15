# SmokePing Config Builder

A bilingual (English / 繁體中文) toolkit for composing a [SmokePing](https://oss.oetiker.ch/smokeping/) `Targets` file from a shared curated catalogue plus your own patches.

- **Web app** — pick targets from the tree, edit any entry, export a committable `patch.yaml` or share via URL. Runs entirely in the browser.
- **CLI** (`@smokepingconf/cli`) — render the same patch against the bundled (or custom) base catalogue from the command line. Scripts cleanly into Ansible, cron, GitHub Actions.

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
npx @smokepingconf/cli init           # writes patch.yaml pinned to the bundled catalogue
# ... edit patch.yaml ...
npx @smokepingconf/cli render patch.yaml --out Targets
npx @smokepingconf/cli diff-base patch.yaml
```

Base resolution cascade: `--base <file>` → `--base-url <url>` → bundled snapshot.
Drift modes: `--on-drift=ignore | warn (default) | error`.

Running `npx @smokepingconf/cli --version` prints both the CLI version and the bundled catalogue's `{date, sha}` stamp, so CI logs record exactly which base was rendered against.

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
    └─ @smokepingconf/cli        commander CLI — render / diff-base / init,
                                 ships as self-contained ESM bundle
```

`web` and `cli` both depend on `core`; they are swappable front-ends over the same patch schema and merge algorithm.

## Development

Node 24 (see `.nvmrc`). First-time setup:

```sh
npm install
npx playwright install chromium   # one-time, for E2E
```

Common commands (run from the repo root — they orchestrate across workspaces):

```sh
npm run dev           # SvelteKit dev server on :5173
npm run check         # tsc for core/cli + svelte-check for web
npm test              # vitest in core, web, cli
npm run build         # regenerates catalog.json + builds web + bundles cli
npm run test:e2e      # Playwright smoke flow (incl. Import/Export round-trip)
```

Per-package operations:

```sh
npm -w @smokepingconf/core run prebuild   # regenerate catalog.json from config.txt
npm -w @smokepingconf/cli run build       # rebuild the CLI bundle only
```

## Project layout

```
config.txt                           curated catalogue source
docs/superpowers/specs/…             design notes (if present)

packages/core/
├── src/
│   ├── types.ts                     Catalog, Node, Probe, CatalogVersion
│   ├── parser.ts / serializer.ts    SmokePing Targets ↔ Catalog
│   ├── probes.ts                    probe metadata + probesFileSnippet
│   ├── tree.ts                      findNode, freshTree, idToPath, pathToId
│   ├── url-state.ts                 TreeDiff + encodeTree/decodeTree (v:1)
│   ├── patch.ts                     Patch + encodePatch/applyPatch + YAML I/O
│   └── catalog.json                 generated, version-stamped
└── scripts/parse-config.ts          prebuild: config.txt → catalog.json

packages/web/
├── src/
│   ├── lib/store.ts                 Svelte writable + exportPatchYaml / previewPatchYaml
│   ├── lib/components/
│   │   ├── Actions.svelte           Copy / Download / Share / Export / Import / Reset
│   │   ├── ImportPatchModal.svelte  paste / upload + drift preview + apply
│   │   └── …                        TreeView, TreeNode, EditForm, Preview, ProbesNotice
│   ├── lib/i18n/                    en.json + zh-TW.json
│   └── routes/                      +layout.svelte + +page.svelte
├── tests/unit/                      store, url-state
└── tests/e2e/flow.spec.ts           Playwright

packages/cli/
├── src/
│   ├── index.ts                     commander entry
│   ├── base-resolver.ts             --base / --base-url / bundled cascade
│   └── commands/render · diff-base · init
├── tests/cli.test.ts                spawn-based integration
└── tsup.config.ts                   ESM single-file bundle (node20)
```

## Deployment

Push to `main` / `master` — GitHub Actions builds `packages/web/` and deploys to Pages via `actions/deploy-pages`. The workflow sets `BASE_PATH=/<repo-name>` so SvelteKit emits hashed assets under the right sub-path.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to add curated targets, new probe kinds, defaults, or translations. TL;DR: edit `config.txt` and run `npm run build` to regenerate `packages/core/src/catalog.json`.

## License

[MIT](./LICENSE) © 2026 hydai
