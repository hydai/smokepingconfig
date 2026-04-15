# SmokePing Config Builder

A bilingual (EN / 繁體中文) static web app for composing a SmokePing `Targets` file.
Pick from curated bundles (CDN, DNS, Cloud, Streaming, Taiwan ISPs, hosting providers),
add your own categories and hosts, preview live, then copy / download / share the result.

**Status:** Scaffolding — full plan at `/Users/hydai/.claude/plans/indexed-beaming-hanrahan.md`.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # svelte-check
npm run test       # vitest unit
npm run test:e2e   # playwright
npm run build      # static output in ./build/
```

## Deploy

GitHub Pages via `.github/workflows/deploy.yml` (see Step 15). `BASE_PATH=/smokepingconf` sets the subpath for Pages.
