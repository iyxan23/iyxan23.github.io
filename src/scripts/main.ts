import { createScene } from './scene.ts';
import { createSheet } from './sheet.ts';
import { createNote } from './note.ts';
import { MIN_LOADER_MS, MAX_WAIT_MS, NAME_DELAY_MS, SETTLE_MS, DESKTOP_MIN_WIDTH_CSS } from '../lib/config.ts';

function assertEl<T extends HTMLElement>(el: T | null, name: string): T {
  if (!el) throw new Error(`main: missing #${name}`);
  return el;
}

async function boot() {
  const t0 = performance.now();
  const root = document.documentElement;

  const loader = assertEl(document.getElementById('loader'), 'loader');
  const canvas = assertEl(document.getElementById('scene') as HTMLCanvasElement | null, 'scene');
  if (!document.getElementById('sheet')) throw new Error('main: missing #sheet');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  let note: ReturnType<typeof createNote> | null = null;
  const scene = createScene(canvas, {
    reduceMotion,
    onHover: (over) => note?.hover(over),
    onTap: (onLogo) => note?.tap(onLogo),
  });
  const sheet = createSheet({
    root,
    sheet: document.getElementById('sheet')!,
    onProgress: (p) => scene.setProgress(p),
    reduceMotion,
  });

  const sheetEl = document.getElementById('sheet')!;
  const desktopMQ = matchMedia(DESKTOP_MIN_WIDTH_CSS);
  note = createNote({
    root,
    getAnchors: () => scene.getAnchors(),
    getBounds: () => {
      const b = { left: 16, top: 16, right: innerWidth - 16, bottom: innerHeight - 16 };
      if (sheet.isOpen() && desktopMQ.matches) b.right = sheetEl.getBoundingClientRect().left - 16;
      return b;
    },
    isEnabled: () => !(sheet.isOpen() && !desktopMQ.matches),
  });

  document.querySelector('.cue')?.addEventListener('click', () => sheet.open());

  canvas.addEventListener('click', () => {
    if (sheet.isOpen() && !scene.wasDrag()) sheet.close();
  });

  const assets = Promise.all([
    document.fonts.load('700 1em Inter'),
    document.fonts.load('400 1em Inter'),
    document.fonts.load('500 1em "JetBrains Mono"'),
  ]).catch(() => {});

  await Promise.race([assets, sleep(MAX_WAIT_MS)]);

  const elapsed = performance.now() - t0;
  if (elapsed < MIN_LOADER_MS) await sleep(MIN_LOADER_MS - elapsed);

  loader.classList.add('is-done');
  await sleep(reduceMotion ? 0 : 300);
  loader.remove();

  const intro = scene.intro();

  await sleep(reduceMotion ? 0 : NAME_DELAY_MS);
  root.classList.add('name-in');

  await intro;
  await sleep(reduceMotion ? 0 : SETTLE_MS);

  root.classList.add('is-settled');
  sheet.enable();
  document.dispatchEvent(new CustomEvent('intro:done'));
}

boot();


