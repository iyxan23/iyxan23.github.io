import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'smol-toml';
import { CvSchema, SiteSchema } from './schema.ts';
import type { Cv, Site } from './schema.ts';

export interface TimelineItem {
  when: string;
  role: string;
  org?: string;
  bullets?: string[];
}

export interface ProjectItem {
  name: string;
  desc: string;
  tag: string;
  href?: string;
  static?: boolean;
}

export interface RowItem {
  when: string;
  role: string;
  org?: string;
}

export interface ViewModel {
  name: string;
  email: string;
  emailUrl: string;
  eyebrow: string;
  intro: string;
  handle: string;
  experience: TimelineItem[];
  projects: ProjectItem[];
  education: TimelineItem[];
  awards: RowItem[];
  leadership: RowItem[];
  speaking: RowItem[];
  skills: RowItem[];
  links: { label: string; href: string; verified: boolean }[];
  note: { head?: string; body: string; tags: string[] };
  seo: { title: string; description: string };
  year: number;
}

function stripInlineMarkup(s: string): string {
  return s
    .replace(/\*\*/g, '')
    .replace(/\*(?!\s)/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&/g, '&')
    .replace(/~/g, ' ');
}

function clean(s: string): string {
  return stripInlineMarkup(s).replace(/\\\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function fmtDate(raw: string | number, months: string[]): string {
  const s = String(raw).trim();
  if (/^present$/i.test(s)) return 'Present';
  const m = s.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
  if (!m) return clean(s);
  const year = m[1];
  if (m[2] === undefined) return year;
  const mon = months[parseInt(m[2], 10) - 1] ?? m[2];
  if (m[3] !== undefined) return `${parseInt(m[3], 10)} ${mon} ${year}`;
  return `${mon} ${year}`;
}

function fmtRange(start: string | number | undefined, end: string | number | undefined, months: string[], present = 'Present'): string {
  if (start === undefined) return end !== undefined ? fmtDate(end, months) : '';
  const a = fmtDate(start, months);
  if (end === undefined) return a;
  const b = /^present$/i.test(String(end).trim()) ? present : fmtDate(end, months);
  return `${a} – ${b}`;
}

function loadToml(path: string): unknown {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch {
    throw new Error(`TOML input not found: ${path}`);
  }
  try {
    return parse(raw);
  } catch (e) {
    throw new Error(`${path}: TOML parse error: ${(e as Error).message}`);
  }
}

export function loadContent(cvPath = process.env.CV_TOML_PATH ?? resolve(process.cwd(), 'data/cv.toml')): ViewModel {
  const sitePath = resolve(process.cwd(), 'data/site.toml');
  const cvRaw = loadToml(cvPath);
  const siteRaw = loadToml(sitePath);

  const cvParsed = CvSchema.safeParse(cvRaw);
  if (!cvParsed.success) {
    throw new Error(`cv.toml: schema error: ${cvParsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  const cv: Cv = cvParsed.data;

  const siteParsed = SiteSchema.safeParse(siteRaw);
  if (!siteParsed.success) {
    throw new Error(`site.toml: schema error: ${siteParsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  const site: Site = siteParsed.data;

  const enLang = (cv.languages as Record<string, { present?: string; months?: string[] }>)?.en ?? {};
  const months: string[] = enLang.months ?? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const present = enLang.present ?? 'Present';

  const introSection = cv.section.find((s) => s.type === 'text' && s.text);
  const intro = site.intro ? clean(site.intro) : introSection?.text ? clean(introSection.text) : '';

  const city = (cv.meta.contacts[0]?.text ?? '').trim().replace(/\n$/, '');
  const eyebrow = site.eyebrow ?? (cv.meta.tagline ? `${clean(cv.meta.tagline).split('·')[0].trim()} · ${city}` : city);

  const emailContact = cv.meta.contacts.find((c) => c.url?.startsWith('mailto:')) ?? cv.meta.contacts[1];
  const email = (emailContact?.text ?? '').trim();
  const emailUrl = emailContact?.url ?? `mailto:${email}`;

  function sectionByTitle(title: string) {
    return cv.section.find((s) => (s.title ?? '').toLowerCase() === title.toLowerCase());
  }

  function toTimeline(title: string): TimelineItem[] {
    const sec = sectionByTitle(title);
    if (!sec?.item) return [];
    return sec.item.map((it) => {
      const when = it.when ? clean(it.when) : fmtRange(it.start, it.end, months, present);
      const role = clean(it.title ?? it.text ?? '');
      const orgParts = [it.org, it.where].filter(Boolean).map((p) => clean(p as string));
      const org = orgParts.length ? orgParts.join(' · ') : undefined;
      const bullets = it.bullets?.map(clean);
      return { when, role, org, bullets };
    });
  }

  function toRows(title: string): RowItem[] {
    const sec = sectionByTitle(title);
    if (!sec?.item) return [];
    return sec.item.map((it) => {
      const when = it.label ? clean(it.label) : it.date !== undefined ? fmtDate(it.date, months) : '';
      const role = clean(it.text ?? it.title ?? '');
      return { when, role };
    });
  }

  const projectsSec = sectionByTitle('Selected Projects');
  const cvProjects = projectsSec?.item ?? [];
  const projects: ProjectItem[] = site.featured
    .map((f) => {
      const match = f.match.toLowerCase();
      const cvProj = cvProjects.find(
        (p) => (p.title ?? '').toLowerCase() === match || (p.title ?? '').toLowerCase().includes(match) || match === (p.title ?? '').toLowerCase().split(' ')[0],
      );
      if (!cvProj) throw new Error(`site.toml featured match "${f.match}" not found in cv.toml Selected Projects`);
      const desc = cvProj.bullets?.length ? clean(cvProj.bullets.join('. ')) : cvProj.text ? clean(cvProj.text) : clean(cvProj.org ?? '');
      const tag = f.tag ?? (cvProj.date !== undefined ? fmtDate(cvProj.date, months) : '');
      const href = f.href ?? cvProj.url;
      return { name: clean(cvProj.title ?? f.match), desc, tag, href, static: !href };
    })
    .filter(Boolean);

  return {
    name: cv.meta.name,
    email,
    emailUrl,
    eyebrow,
    intro,
    handle: site.handle,
    experience: toTimeline('Experience'),
    projects,
    education: toTimeline('Education'),
    awards: toRows('Awards & Competitions'),
    leadership: toRows('Leadership & Community'),
    speaking: toRows('Speaking & Teaching'),
    skills: toRows('Skills'),
    links: site.links,
    note: site.note,
    seo: site.seo,
    year: new Date().getFullYear(),
  };
}
