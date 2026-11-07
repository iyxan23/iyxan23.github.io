# TOML → Page Mapping (Phase 0)

> Source CV: `cv.toml` in repo root. Generator (`build.py` / `cv.tex`, not in this repo) left untouched.
> Site-only data: separate `data/site.toml` merged at build time (see §1 Q1).

## 1. Plan table, filled with real key paths

| Page element | Source key path | Notes |
|---|---|---|
| Eyebrow: "Software engineer · City, Country" | `meta.contacts[0].text` = `"Surakarta, Indonesia\n"` + `meta.tagline` | Legacy: `"Software engineer · Surakarta, Indonesia"`. CV tagline is `"Software Engineer · Computer Science Undergraduate"`. Derivable as `tagline's first segment + contacts[0]` but mismatch in casing/wording. **Decision:** keep eyebrow in `site.toml` as override; loader prefers `site.toml` eyebrow if present, else `tagline` + ` · ` + contact city. Trim trailing `\n`. |
| Title: full name + blue dot | `meta.name` | Legacy: `"Nur Ihsan Al Ghifari"` + `<span class="dot">.</span>` |
| Intro paragraph | `section[0].text` (type=text, title="") | CV text contains `**bold**` markup. Loader strips `**` / `*` → plain text. Length ~3 lines. Optional override via `site.toml.intro` (precedence if present). |
| Hero wordmark `iyxan23.` | `site.toml.handle` | Not in CV TOML. Trailing `.` added by template. |
| Experience | `section[1]` title="Experience", type="entries" | See §2 below for field mapping. 5 items. |
| Selected projects | `section[3]` title="Selected Projects", type="entries" | 6 items incl. Paring (no url). Order/limited by `site.toml.featured`. See §2. |
| Education | `section[2]` title="Education", type="entries" | 2 items. First uses `when`/`when_id` pre-formatted; second uses `start`/`end`. |
| Awards & competitions | `section[4]` title="Awards & Competitions", type="rows" | `date` + `text` with `**bold**` markup. |
| Leadership & community | `section[5]` type="rows" | |
| Speaking & teaching | `section[6]` type="rows" | |
| Skills | `section[7]` title="Skills", type="rows" | `label` → `date`-like `.when`, `text` → `.role`. Also includes Interests + Spoken rows (labels "Interests", "Spoken"). |
| Footer: email + © name | `meta.contacts[1]` (email `hi@nurihsanag.id`, url `mailto:`) + `meta.name` | `mailto` link; `© <year> <name>` computed at build (year = current year). |
| Top links | `site.toml.links` + derivable from `meta.contacts` | Contacts include LinkedIn `in/nurihsanag` and GitHub `github.com/iyxan23`. Instagram (`instagram.com/iyxan23`) is present only in legacy HTML, **unverified** (Q5). Order from `site.toml`. |
| Hover note text | `site.toml.note` | head `// About the mark`, body paragraph, tags `["Est. 2020","Made in GIMP"]`. Legacy also had a `.note-head`? **No** — legacy note has only `.note-text` paragraph. The plan §3.5 says head exists; legacy HTML shows just paragraph. **Follow legacy** (no head element) unless `site.toml.note.head` used elsewhere. Wire `head` if present, else skip. |
| SEO | `site.toml.seo` + `meta.name` | title `iyxan23`, description `iyxan23 (Nur Ihsan Al Ghifari): full-stack and backend engineer from Indonesia.` (from legacy meta). |

## 2. Entries section item mapping

Each `section.item` may have: `title`, `org`, `where`, `start`, `end`, `date`, `when`, `url`, `text`, `bullets[]`, `priority`, plus `*_id` variants (ignored for English site), and `label_width` is on the section.

Experience (legacy `.timeline`):
- `when`: from `start`/`end` → `"Mon YYYY – Mon YYYY"` or `"Mon YYYY – Present"` if `end = "present"` / missing. If `when` key exists, use verbatim. If `start`/`end` are `"2024-11"` etc., format via `languages.en.months`.
- `role`: `title`
- `org`: `org + " · " + where` (joined with ` · ` if both present). Legacy: `"Sketchub · Remote, International"`.
- `bullets[]`: `<ul><li>…</li></ul>` with `**` stripped.

Projects (legacy `.projects`):
- `p-name`: `title`
- `desc`: `bullets[0]` if present else `text` else `org` (legacy condenses). Stripped of `**`/`*`/backticks. If both `bullets` and `text`, join with ` — `.
- `tag`: `date` formatted (`"2026-02"` → `"Feb 2026"`; `"2022"` → `"2022"`) plus `· XXX` suffix from `org` metadata? Legacy tags: `"2022 · 74 stars"`, `"Feb 2026"`, `"Mar 2022 · Rust"`, `"2021 · Kotlin"`. The `· 74 stars` and `· Rust/Kotlin` come from `org` field (e.g. `"Open-source library · 74 GitHub stars · used to fix…"`). **Derivation:** use `site.toml.featured[i].tag` if provided; else compute `fmt(date) + (org contains "stars" ? " · 74 stars" : (org contains "Rust"/"Kotlin" ? " · Rust/Kotlin" : ""))`. Prefer explicit `site.toml` tags (Phase 0 data includes them).
- `href`: `url` key. No `url` → `<div class="row is-static">` with empty arrow.
- Note: `Blokkok` URL differs: CV says `https://github.com/Blokkok/blokkok`, legacy says `https://github.com/blokkok`. Use CV value (source of truth), flag `verified=false` until user confirms. `swrs` CV URL is `https://github.com/iyxan23/swrs`, legacy is `https://crates.io/crates/swrs`. Use CV; flag unverified (Q5).

Education:
- Same as Experience, but first item has `when = "Aug 2025 -- Aug 2029 (expected)"` (verbatim, normalized `--` → `–`). Second uses start/end.
- `org` join with `where` if present.

Rows (Awards/Leadership/Speaking/Skills) → `.timeline.compact`:
- `when`: `date` formatted (`"2026-09"` → `"Sep 2026"`; `"2026-09-16"` → `"16 Sep 2026"`; `"2026"` → `"2026"`), or for Skills the `label` (e.g. `"Languages"`).
- `role`: `text` with `**` stripped. For awards, legacy splits `role="Finalist, PIN UNILA…"` and `org="10th of 162"` derived from parentheses in CV `text` — **do not split**: render full text as `.role` (no `.org`) to preserve CV wording. Diff vs legacy is intentional content change, not a bug.
- Skills label_width ignored (CSS fixed).

## 3. Normalization requirements

- **Markdown residue:** `**bold**` → plain, `*italic*` → plain, `` `code` `` → plain, `[label](url)` → label. `\&` → `&`, `~` → non-breaking space, `--`/`---` → en/em dash where used as date range. Curly quotes kept.
- **Dates:** ISO `YYYY-MM` / `YYYY-MM-DD` / `YYYY` / `present` → `Mon YYYY` / `D Mon YYYY` / `YYYY` / `Present`. `when` verbatim except `--` → `–`.
- **Ordering:** TOML file order preserved. Section order by file order; section title from `title` English.
- **Whitespace:** collapse `\` line continuations and `\n` in `text` blocks; trim contacts `\n`.

## 4. Whitelist (loader output)

Only these fields reach components; everything else (phone if present, `contacts[0..]`, variants, languages, `*_id`, `priority`, `label_width`) is dropped:
`name`, `email`, `emailUrl`, `eyebrow`, `intro`, `sections[] {title, kind, items[] {when, role, org?, bullets?, name?, desc?, tag?, href?, static?}}`, `links[] {label, href, verified}`, `note {head?, body, tags}`, `seo {title, description}`.

## 5. Ambiguities / missing

1. Eyebrow sourcing: CV `tagline` ≠ legacy eyebrow → `site.toml` override (default per §1 Q1).
2. Note head: plan §3.5 says head `// About the mark` exists; legacy has no head. Implement optional `site.toml.note.head`; render if set, else paragraph only. Confirm with user if `// About the mark` should be added.
3. Project `tag` derivation fragile → use explicit `site.toml.featured.tag` per project (included in proposal).
4. `Blokkok` org URL case and `swrs` crates.io vs github URL mismatch → flagged `verified=false`.
5. Instagram URL unverified → `verified=false`.
6. `meta.contacts[0]` has trailing `\n`; strip.
7. Education first item `when` vs start/end inconsistency in TOML → prefer `when` verbatim.
8. Awards role/org split in legacy is hand-authored; CV has single `text` → render as single `.role`.
9. Speaking order: CV order differs from legacy (legacy reorders Sep/Apr/etc.). TOML order wins.
10. No phone number in current `cv.toml` (it's `REDACTED` comment), but whitelist guards future leaks anyway.
