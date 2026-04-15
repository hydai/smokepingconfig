# Contributing

Thanks for wanting to extend the SmokePing Config Builder. The app ships with
several layers of "defaults" — the curated target catalogue, probe metadata,
root-level seed values, and UI strings — and the sections below map each one to
the exact files you'll touch.

## Where do I add what?

| I want to add… | Go to |
| --- | --- |
| A new CDN, ISP, cloud, or other preset target | [Curated catalogue entries](#curated-catalogue-entries) |
| A new SmokePing probe kind | [Probe kinds](#probe-kinds) |
| A new default menu / title / starter-node seed | [Root-level defaults](#root-level-defaults) |
| A new UI string or translation fix | [i18n strings](#i18n-strings) |
| A user-facing feature (saved presets, alerts, etc.) | [Feature ideas](#feature-ideas) |

## Dev setup

Node version is pinned in `.nvmrc` (currently Node 24).

```sh
npm install
npx playwright install chromium   # one-time, for E2E
npm run dev                       # http://localhost:5173
```

Before opening a PR (these mirror the commands CI runs in
`.github/workflows/ci.yml`):

```sh
npm run check     # svelte-check + tsc
npm test          # vitest unit suite
npm run build     # includes prebuild → regenerates src/lib/catalog.json
npm run test:e2e  # Playwright (builds + previews)
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

To add a new provider under `CDN`, append another `++` block:

```smokeping
++ MyProvider
menu = My Provider
title = my-provider.com
host = my-provider.com
```

Recognised per-node attributes (see `src/lib/parser.ts:92` `KNOWN_ATTRS`):
`menu`, `title`, `host`, `probe`, `lookup`, `recordtype`, `url`, `pingport`,
`remark`. Any unknown attribute is preserved verbatim and round-trips on save
via `extraAttrs`.

Regenerate the catalogue with either command — `prebuild` is a lifecycle hook
of `build`, so CI does this automatically:

```sh
npm run prebuild   # writes src/lib/catalog.json
npm run build      # full static build, regenerates first
```

**Gotcha**: `tests/unit/parser.test.ts:20` locks the list of top-level
categories. If you add, remove, or rename a `+`-level entry, update that
expectation at `tests/unit/parser.test.ts:23-32`.

## Probe kinds

Adding a new probe (e.g. `Curl`, `EchoPingIcmp`) currently touches several
files. Go through the checklist in order:

1. `src/lib/types.ts:3` — extend the `ProbeKind` union and add a new variant
   to the `Probe` discriminated union (lines 7–12) with the attributes the
   probe needs.
2. `src/lib/probes.ts:8` — append the kind to `PROBE_KINDS`.
3. `src/lib/probes.ts:19` — if your probe exposes a new editable attribute,
   extend `ProbeField.key`.
4. `src/lib/probes.ts:45` — add a `PROBE_META` entry: `label`, `description`,
   `fields`, and a `probesSnippet` (this snippet is what the ProbesNotice
   banner emits into the user's `*** Probes ***` section).
5. `src/lib/probes.ts:122` — handle the new kind in `defaultProbe()`,
   `probeToFields()` (line 138), and `fieldsToProbe()` (line 157).
6. `src/lib/parser.ts` — extend `buildProbe()` so `config.txt` lines for your
   probe parse correctly (add the attribute keys to `KNOWN_ATTRS` at line 92
   if needed).
7. `src/lib/serializer.ts` — emit the probe's attributes when serialising.
8. `tests/unit/probes.test.ts:24` — add a `defaultProbe` shape assertion for
   the new kind; add a case to the `probeToFields / fieldsToProbe` round-trip
   block starting at line 34.
9. `tests/unit/roundtrip.test.ts` — add a fixture that parses and serialises
   a sample target using your new probe without drift.

Use `EchoPingHttp` (defined at `src/lib/probes.ts:68`) as a minimal pattern
to copy: one required string field, one snippet, one default.

> **Maintainer note.** If probe additions become frequent, the natural
> follow-up is to collapse these files into a single registry
> (`src/lib/probes/<kind>.ts` exporting a full `ProbeSpec`). That refactor is
> out of scope for a single-probe PR — flag it in the PR description and we
> can plan it separately.

## Root-level defaults

Two distinct layers use similar-looking code but serve different purposes.

**Catalogue-missing fallbacks** — used only when `config.txt` omits the root
`menu` / `title` / `probe`. Rare to change; touch only if you want the
*behaviour* when the catalogue source is minimal to differ.

- `src/lib/parser.ts:104` — `rawToCatalog()` (the `?? 'FPing'`, `?? 'Top'`,
  `?? 'Network Latency Grapher'` fallbacks).

**New-user-node seeds** — the initial values for nodes the user creates via
the "+ Add category" and "+ Add target" buttons. This is what most
contributors actually want to tweak.

- `src/lib/store.ts:167` — `newCustomCategory()`.
- `src/lib/store.ts:180` — `newCustomTarget()`.

## i18n strings

Strings live in `src/lib/i18n/en.json` and `src/lib/i18n/zh-TW.json`. Both
files **must stay key-in-sync**; svelte-i18n falls back silently if a key is
missing in one language. When adding a key:

1. Append it at the end of the nearest nesting group in `en.json`.
2. Add the same key to `zh-TW.json` with the Traditional Chinese translation.
3. Reference the key in your component via `$_('your.key.here')`.

Loading is set up in `src/routes/+layout.svelte`.

## Feature ideas

PRs welcome for these — open an issue first if they're non-trivial.

- **Saveable named presets.** Today the tree autosaves to localStorage (see
  `src/lib/store.ts` `autosave`) and the URL hash holds a delta-encoded snapshot
  (`src/lib/url-state.ts`). A preset feature can build on both: store a map of
  `{ name → delta }` in localStorage, surface Save/Load/Delete in
  `src/lib/components/Actions.svelte`.
- **Alert modelling.** Alerts currently round-trip as opaque `extraAttrs` (see
  `src/lib/types.ts:51`). First-class alert editing would expand the type and
  add an `AlertEditor` component.
- **IPv6 toggle per target.** Add a per-node boolean that flips the probe or
  emits `probe = FPing6` / equivalent on serialise.
- **CSV import.** A one-shot importer that creates custom categories/targets
  from a pasted CSV.

## Workflow & commit conventions

- Follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`, `ci:`.
- One concern per commit — split logically.
- Branch off `master`; open PRs against `master`.
- CI (`.github/workflows/ci.yml`) runs lint, unit, build, and E2E on every PR
  and must be green to merge.
- The GitHub Pages deploy (`deploy.yml`) runs on push to `main`/`master` and
  will regenerate `catalog.json` itself, so a slightly stale committed copy
  won't block deployment — but please still run `npm run build` locally to
  confirm there's no drift.

## PR checklist

Copy this into your PR description:

```
- [ ] Ran `npm run check && npm test`
- [ ] Ran `npm run build` (regenerates `src/lib/catalog.json` if `config.txt` changed)
- [ ] Ran `npm run test:e2e` if UI behaviour changed
- [ ] Updated i18n keys in both `en.json` and `zh-TW.json`
- [ ] Updated `tests/unit/parser.test.ts:20` if top-level categories changed
- [ ] Commit messages follow Conventional Commits
```
