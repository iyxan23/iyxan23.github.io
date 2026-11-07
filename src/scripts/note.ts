import { GAP, MARGIN } from '../lib/config.ts';

const f = (n: number) => n.toFixed(1);

function leader(A: { x: number; y: number }, B: { x: number; y: number }, vertical: boolean) {
  if (!vertical) {
    const dy = B.y - A.y;
    const sx = B.x >= A.x ? 1 : -1;
    const ex = A.x + sx * Math.abs(dy);
    if (sx * (B.x - ex) > 12) return `M${f(A.x)} ${f(A.y)} L${f(ex)} ${f(B.y)} L${f(B.x)} ${f(B.y)}`;
  } else {
    const dx = B.x - A.x;
    const sy = B.y >= A.y ? 1 : -1;
    const ey = A.y + sy * Math.abs(dx);
    if (sy * (B.y - ey) > 12) return `M${f(A.x)} ${f(A.y)} L${f(B.x)} ${f(ey)} L${f(B.x)} ${f(B.y)}`;
  }
  return `M${f(A.x)} ${f(A.y)} L${f(B.x)} ${f(B.y)}`;
}

export function createNote({ root, getAnchors, getBounds, isEnabled }: {
  root: HTMLElement;
  getAnchors: () => { pivot: { x: number; y: number }; center: { x: number; y: number }; ppu: number };
  getBounds: () => { left: number; top: number; right: number; bottom: number };
  isEnabled: () => boolean;
}) {
  const el = root.querySelector('.note') as HTMLElement | null;
  if (!el) return { hover() {}, tap() {} };
  const box = el.querySelector('.note-box') as HTMLElement;
  const path = el.querySelector('.note-path') as SVGPathElement;
  const dot = el.querySelector('.note-dot') as SVGCircleElement;
  const ring = el.querySelector('.note-ring') as SVGCircleElement;

  let want = false;
  let shown = false;
  let t = 0;
  let raf = 0;
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let autoHide: ReturnType<typeof setTimeout> | undefined;
  let side = 'right';
  let bw = 0;
  let bh = 0;

  const measure = () => {
    bw = box.offsetWidth;
    bh = box.offsetHeight;
  };
  window.addEventListener('resize', () => shown && measure());

  function place(a: { pivot: { x: number; y: number }; ppu: number }) {
    const R = a.ppu;
    const p = a.pivot;
    const top = p.y - 0.84 * R - MARGIN;
    const candidates = [
      { side: 'right', x: p.x + 1.15 * R + GAP, y: top },
      { side: 'left', x: p.x - 0.84 * R - GAP - bw, y: top },
      { side: 'above', x: p.x - bw / 2, y: p.y - 0.7 * R - GAP - bh },
    ];
    const b = getBounds();
    const fits = (c: { x: number; y: number }) => c.x >= b.left && c.y >= b.top && c.x + bw <= b.right && c.y + bh <= b.bottom;
    let pick = candidates.find((c) => c.side === side && fits(c)) || candidates.find(fits);
    if (!pick) {
      const c = candidates[2];
      pick = { ...c, x: Math.min(Math.max(c.x, b.left), Math.max(b.left, b.right - bw)), y: Math.max(c.y, b.top) };
    }
    side = pick.side;
    return pick;
  }

  function draw() {
    const a = getAnchors();
    const c = place(a);
    box.style.translate = `${f(c.x)}px ${f(c.y)}px`;

    const A = a.center;
    const B =
      c.side === 'right' ? { x: c.x, y: c.y + MARGIN }
      : c.side === 'left' ? { x: c.x + bw, y: c.y + MARGIN }
      : { x: c.x + bw / 2, y: c.y + bh };

    path.setAttribute('d', leader(A, B, c.side === 'above'));
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len * (1 - t)}`;
    for (const n of [dot, ring]) {
      n.setAttribute('cx', f(A.x));
      n.setAttribute('cy', f(A.y));
    }
    dot.style.opacity = String(Math.min(1, t * 5));
  }

  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (shown && !isEnabled()) hide();

    const target = shown ? 1 : 0;
    t += (target - t) * (1 - Math.exp(-dt / (shown ? 0.1 : 0.05)));
    if (Math.abs(target - t) < 0.003) t = target;

    if (t > 0) {
      draw();
    } else {
      path.setAttribute('d', '');
      dot.style.opacity = '0';
    }
    if (!shown && t === 0) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function show() {
    if (!isEnabled()) return;
    measure();
    shown = true;
    el.classList.add('is-on');
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function hide() {
    shown = false;
    el.classList.remove('is-on');
  }

  function request(v: boolean) {
    if (v === want) return;
    want = v;
    clearTimeout(timer);
    timer = setTimeout(() => (v ? show() : hide()), v ? 70 : 160);
  }

  return {
    hover(v: boolean) {
      clearTimeout(autoHide);
      request(v);
    },
    tap(hit: boolean) {
      clearTimeout(autoHide);
      if (hit && !want) {
        request(true);
        autoHide = setTimeout(() => request(false), 5000);
      } else {
        request(false);
      }
    },
  };
}
