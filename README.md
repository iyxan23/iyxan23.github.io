<h1>
<pre>nurihsanag.id</pre>
</h1>

Static Astro site (SSG, `output: 'static'`) rendered from TOML. The site and the CV share one source of CV content.

## Updating content

1. Edit `data/cv.toml` (CV content) or `data/site.toml` (site-only: handle, links, note, featured project tags/URLs, SEO).
2. Rebuild: `pnpm build` (or `pnpm dev` for local preview).
3. Deploy `dist/` to Cloudflare Pages or GitHub Pages (no adapter).

Environment: `CV_TOML_PATH` overrides the CV path (default `./data/cv.toml` in repo root).

## Scripts

- `pnpm dev` — dev server
- `pnpm build` — static build to `dist/`
- `pnpm check` — breakpoint-literal, class-contract, reveal-order, whitelist/privacy checks (see `tests/check.mjs`)

## Bundle

~900K `dist/` total, most of it three.js + self-hosted fonts (Inter 400–800 latin, JetBrains Mono 500 latin). No CDN or render-blocking third-party requests at runtime.
