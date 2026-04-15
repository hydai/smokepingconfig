// Disable SSR — this is a pure static SPA on GitHub Pages.
// adapter-static's `fallback: 'index.html'` serves the SPA shell on any path.
export const ssr = false;
export const prerender = true;
