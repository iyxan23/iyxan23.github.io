import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "smol-toml";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");

// import TS modules via strip-types loader (node --experimental-strip-types)
const { loadContent } = await import("../src/lib/content.ts");
const { DESKTOP_MIN_WIDTH_CSS, PHONE_MAX_CSS } =
  await import("../src/lib/config.ts");

const cssTexts = ["src/styles/desktop.css", "src/styles/glow.css"]
  .map((f) => readFileSync(resolve(root, f), "utf-8"))
  .join("\n");
const mainTs = readFileSync(resolve(root, "src/scripts/main.ts"), "utf-8");

assert.ok(
  cssTexts.includes(DESKTOP_MIN_WIDTH_CSS),
  `desktop breakpoint "${DESKTOP_MIN_WIDTH_CSS}" not found in CSS`,
);
assert.ok(
  mainTs.includes("DESKTOP_MIN_WIDTH_CSS"),
  "main.ts must reference the shared desktop breakpoint",
);
assert.ok(
  cssTexts.includes(PHONE_MAX_CSS),
  `phone breakpoint "${PHONE_MAX_CSS}" not found in CSS`,
);

const html = readFileSync(resolve(root, "dist/index.html"), "utf-8");
for (const token of [
  'id="loader"',
  'id="scene"',
  'id="sheet"',
  'class="note"',
  'class="note-box"',
  'class="note-path"',
  'class="cue"',
  'class="sheet-scroll"',
  'class="hero"',
  'class="name"',
  'class="links"',
]) {
  assert.ok(html.includes(token), `rendered HTML missing ${token}`);
}

const dValues = [...html.matchAll(/--d:(\d+)/g)].map((m) => parseInt(m[1], 10));
assert.ok(dValues.length > 0, "no reveal indices found");
const sorted = [...dValues].sort((a, b) => a - b);
assert.deepEqual(
  dValues,
  sorted,
  `reveal indices must be non-decreasing in DOM order, got ${dValues.join(",")}`,
);

const vm = loadContent();
assert.equal(vm.name, "Nur Ihsan Al Ghifari");
assert.ok(vm.email.includes("@"));
assert.ok(vm.experience.length > 0);
assert.ok(vm.projects.length > 0);
assert.equal(vm.links.length, 4);

const cv = parse(readFileSync(resolve(root, "data/cv.toml"), "utf-8"));
const cssFile = readdirSync(resolve(root, "dist/_astro")).find((f) =>
  f.endsWith(".css"),
);
const distText =
  html + readFileSync(resolve(root, "dist/_astro", cssFile), "utf-8");
const privateValues = [];
if (Array.isArray(cv?.meta?.contacts)) {
  for (const c of cv.meta.contacts) {
    if (c.url && c.url.startsWith("tel:")) privateValues.push(c.text, c.url);
  }
}
for (const v of privateValues.filter(Boolean)) {
  assert.ok(!distText.includes(v), `private value leaked into dist: ${v}`);
}

for (const href of [
  "https://github.com/iyxan23",
  "https://blog.nurihsanag.id",
  "https://instagram.com/nurihsanag",
  "https://linkedin.com/in/nurihsanag",
]) {
  assert.ok(distText.includes(`href="${href}"`), `link ${href} missing`);
}

assert.ok(
  !distText.includes("fonts.googleapis.com"),
  "google fonts must not be linked",
);
assert.ok(!distText.includes("cdn.jsdelivr"), "cdn importmap must be gone");

console.log("all checks passed");
