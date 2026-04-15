# SmokePing Config Builder

A bilingual (English / 繁體中文) static web app for composing a [SmokePing](https://oss.oetiker.ch/smokeping/) `Targets` file.

Pick from a curated catalogue (CDN, DNS, Cloud, Streaming, Taiwan ISPs, hosting providers), edit any entry, add your own categories and hosts, and preview the generated config live. Copy, download, or share via URL — all in the browser, no backend.

## Features

- Tree of curated targets parsed at build time from `config.txt`
- Per-item or per-category toggle, drill-down to opt out individual entries
- Inline editing of any node (curated or custom): name / menu / title / host / probe with probe-specific fields (DNS lookup, EchoPingHttps URL, EchoPingPlugin port, …)
- Add your own categories and targets; nest as deeply as needed
- Comparison graph picker for category parents (`host = /Path/A /Path/B …`)
- Drag-and-drop reorder within siblings
- Live serialized preview with line / byte counters
- Copy, Download (`Targets`), Share (URL with delta-encoded state, ≤6 KB)
- localStorage autosave so a refresh keeps your edits
- Bilingual UI; the curated data keeps its source language (mostly Mandarin where applicable)
- Probes prerequisite banner emits the matching `*** Probes ***` snippet for whichever probes you used

## Stack

- SvelteKit + `@sveltejs/adapter-static`, TypeScript
- `svelte-i18n`, `svelte-dnd-action`, `lz-string`
- Vitest (unit) + Playwright (E2E)
- GitHub Pages via `actions/deploy-pages`

## Development

Requires Node 24 (see `.nvmrc`).

```sh
npm install
npm run dev          # http://localhost:5173
npm run check        # svelte-check + tsc
npm test             # vitest unit suite
npx playwright install chromium   # one-time
npm run test:e2e     # Playwright (boots `npm run build && npm run preview`)
npm run build        # static output in ./build/
```

## Project layout

```
src/
├── lib/
│   ├── catalog.json          ← generated from config.txt at build time
│   ├── parser.ts             ← config.txt → Catalog
│   ├── serializer.ts         ← Catalog → SmokePing text
│   ├── url-state.ts          ← delta state ↔ URL hash
│   ├── store.ts              ← reactive WorkingTree + helpers
│   ├── probes.ts             ← probe metadata + Probes-file snippets
│   ├── types.ts              ← Node, Probe, Catalog
│   ├── i18n/                 ← en.json, zh-TW.json + svelte-i18n init
│   └── components/
│       ├── TreeView.svelte   ← top-level dndzone, "Add category"
│       ├── TreeNode.svelte   ← recursive; checkbox, edit, dnd, add-children
│       ├── EditForm.svelte   ← inline editor incl. comparison picker
│       ├── Preview.svelte    ← live serialized output
│       ├── Actions.svelte    ← Copy / Download / Share / Reset
│       ├── ProbesNotice.svelte ← Probes prerequisite snippet
│       ├── LangToggle.svelte ← EN / 中
│       └── AddButton.svelte  ← reusable "+ Add …" affordance
├── routes/
│   ├── +layout.svelte        ← app.css + i18n + URL hash hydration
│   ├── +layout.ts            ← prerender + ssr=false
│   └── +page.svelte          ← page composition
└── app.html, app.css, app.d.ts

scripts/parse-config.ts       ← prebuild: config.txt → src/lib/catalog.json
tests/unit/                   ← parser, serializer, round-trip, store, probes, url-state
tests/e2e/                    ← Playwright smoke flow
.github/workflows/
├── ci.yml                    ← check + unit + build + e2e on PR/push
└── deploy.yml                ← build + actions/deploy-pages on main
```

## Deployment

Push to `main` (or `master`) and GitHub Actions builds + deploys to Pages.

The workflow sets `BASE_PATH=/<repo-name>` so SvelteKit emits hashed assets under the right subpath. If you fork to a different repo name, no config change is needed; the workflow reads from `${{ github.event.repository.name }}`.

To enable Pages: in your repository settings, set Pages → Source to **GitHub Actions**.

## Updating the curated catalogue

Edit `config.txt` at the repo root. The next `npm run build` (or `npm run prebuild`) regenerates `src/lib/catalog.json`. CI runs the build, so a stale committed catalog will be regenerated on deploy regardless.

## License

Choose your own; not yet provided.
