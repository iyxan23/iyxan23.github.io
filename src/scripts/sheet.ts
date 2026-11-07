import { OPEN_MS, CLOSE_MS, REDUCED_MS, WHEEL_MIN, TOUCH_MIN, LOCK_MS, GESTURE_GAP_MS, FADE_PX } from '../lib/config.ts';

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

export function createSheet({ root, sheet, onProgress, reduceMotion = false }: {
  root: HTMLElement;
  sheet: HTMLElement;
  onProgress?: (p: number) => void;
  reduceMotion?: boolean;
}) {
  const scroller = sheet.querySelector('.sheet-scroll') as HTMLElement;

  let p = 0;
  let from = 0;
  let to = 0;
  let t0 = 0;
  let dur = 1;
  let raf = 0;
  let open = false;
  let enabled = false;
  let lockUntil = 0;

  const apply = (v: number) => {
    p = v;
    root.style.setProperty('--p', v.toFixed(4));
    onProgress?.(v);
  };

  function tick(now: number) {
    const t = Math.max(0, Math.min(1, (now - t0) / dur));
    apply(from + (to - from) * easeOutExpo(t));
    if (t < 1) {
      raf = requestAnimationFrame(tick);
      return;
    }
    raf = 0;
    if (!open) {
      (sheet as any).inert = true;
      scroller.scrollTop = 0;
      updateFade();
    }
  }

  function setOpen(next: boolean) {
    if (next === open) return;
    open = next;
    lockUntil = performance.now() + LOCK_MS;
    root.classList.toggle('sheet-open', open);
    if (open) {
      (sheet as any).inert = false;
      scroller.focus({ preventScroll: true });
    }

    from = p;
    to = open ? 1 : 0;
    const base = reduceMotion ? REDUCED_MS : open ? OPEN_MS : CLOSE_MS;
    dur = base * (0.4 + 0.6 * Math.abs(to - from));
    t0 = performance.now();
    if (!raf) raf = requestAnimationFrame(tick);
  }

  const atTop = () => scroller.scrollTop <= 0;

  const updateFade = () => {
    const max = scroller.scrollHeight - scroller.clientHeight;
    const top = Math.min(FADE_PX, Math.max(0, scroller.scrollTop));
    const bottom = Math.min(FADE_PX, Math.max(0, max - scroller.scrollTop));
    scroller.style.setProperty('--ft', `${top.toFixed(1)}px`);
    scroller.style.setProperty('--fb', `${bottom.toFixed(1)}px`);
  };
  scroller.addEventListener('scroll', updateFade, { passive: true });
  window.addEventListener('resize', updateFade);
  updateFade();

  let lastWheel = 0;
  let gestureAtTop = true;
  window.addEventListener(
    'wheel',
    (e) => {
      if (!enabled) return;
      const now = performance.now();
      if (now - lastWheel > GESTURE_GAP_MS) gestureAtTop = atTop();
      lastWheel = now;

      if (now < lockUntil) {
        e.preventDefault();
        return;
      }
      if (!open) {
        e.preventDefault();
        if (e.deltaY > WHEEL_MIN) setOpen(true);
        return;
      }
      if (gestureAtTop && e.deltaY < -WHEEL_MIN && atTop()) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (!sheet.contains(e.target as Node)) {
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? scroller.clientHeight : 1;
        scroller.scrollTop += e.deltaY * unit;
      }
    },
    { passive: false },
  );

  let startX = 0;
  let startY = 0;
  let startAtTop = true;
  let handled = false;
  window.addEventListener(
    'touchstart',
    (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startAtTop = atTop();
      handled = false;
    },
    { passive: true },
  );
  window.addEventListener(
    'touchmove',
    (e) => {
      if (!enabled) return;
      const dy = startY - e.touches[0].clientY;
      const dx = startX - e.touches[0].clientX;
      const vertical = Math.abs(dy) > Math.abs(dx) * 1.2;
      if (!open) {
        if (e.cancelable) e.preventDefault();
        if (!handled && dy > TOUCH_MIN && vertical) {
          handled = true;
          setOpen(true);
        }
        return;
      }
      if (!handled && startAtTop && dy < -TOUCH_MIN && vertical && atTop()) {
        handled = true;
        setOpen(false);
      }
    },
    { passive: false },
  );

  window.addEventListener('keydown', (e) => {
    if (!enabled || e.altKey || e.ctrlKey || e.metaKey) return;
    const interactive = e.target instanceof Element && e.target.closest('a, button, input, textarea, select');
    if (!open) {
      if (['ArrowDown', 'PageDown', 'End'].includes(e.key) || (e.key === ' ' && !interactive)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape' || (['ArrowUp', 'PageUp', 'Home'].includes(e.key) && atTop())) {
      e.preventDefault();
      setOpen(false);
    }
  });

  return {
    enable() {
      enabled = true;
    },
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => open,
  };
}
