import * as THREE from 'three';
import { SPIN_SPEED, TILT_X, FOV, REST_Z, START_Z_RATIO, MIN_REST_WIDTH, DEPTH, SPIN_RELAX_S, MAX_OMEGA, HIT_RADIUS, INTRO_MS } from '../lib/config.ts';

const LOGO_PX: [number, number][] = [[373, 214], [810, 245], [214, 810]];

const LOGO_LOCAL: [number, number][] = (() => {
  const cx = LOGO_PX.reduce((t, q) => t + q[0], 0) / 3;
  const cy = LOGO_PX.reduce((t, q) => t + q[1], 0) / 3;
  return LOGO_PX.map(([x, y]) => [(x - cx) / 300, -(y - cy) / 300]);
})() as [number, number][];
const BBOX_CX = (Math.min(...LOGO_LOCAL.map((q) => q[0])) + Math.max(...LOGO_LOCAL.map((q) => q[0]))) / 2;
const BBOX_CY = (Math.min(...LOGO_LOCAL.map((q) => q[1])) + Math.max(...LOGO_LOCAL.map((q) => q[1]))) / 2;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function logoShape() {
  return new THREE.Shape(LOGO_LOCAL.map(([x, y]) => new THREE.Vector2(x, y)));
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface SceneCallbacks {
  reduceMotion?: boolean;
  onHover?: (over: boolean) => void;
  onTap?: (onLogo: boolean) => void;
}

export function createScene(canvas: HTMLCanvasElement, { reduceMotion = false, onHover, onTap }: SceneCallbacks = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

  const geometry = new THREE.ExtrudeGeometry(logoShape(), { depth: DEPTH, bevelEnabled: false });
  geometry.translate(0, 0, -DEPTH / 2);

  const fill = new THREE.Mesh(
    geometry,
    new THREE.MeshPhysicalMaterial({
      color: 0x8fa8ff,
      emissive: 0x2a3fff,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 1),
    new THREE.LineBasicMaterial({ transparent: true, opacity: 0 }),
  );
  fill.renderOrder = 1;
  edges.renderOrder = 2;

  const world = new THREE.Group();
  scene.add(world);

  const logo = new THREE.Group();
  logo.rotation.order = 'YXZ';
  logo.add(fill, edges);
  world.add(logo);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const blueLight = new THREE.PointLight(0x3b6bff, 60, 0, 2);
  blueLight.position.set(-3, -2, 3);
  const violetLight = new THREE.PointLight(0xa24dff, 60, 0, 2);
  violetLight.position.set(3, 3, 3);
  scene.add(blueLight, violetLight);

  const glowTex = makeGlowTexture();
  const makeGlow = (color: number, size: number) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0, depthWrite: false }),
    );
    sprite.scale.set(size, size, 1);
    sprite.renderOrder = 0;
    world.add(sprite);
    return sprite;
  };
  const glowBlue = makeGlow(0x2f63ff, 5.2);
  const glowViolet = makeGlow(0x9a4dff, 4.4);

  const applyTheme = () => {
    const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#ffffff';
    (edges.material as THREE.LineBasicMaterial).color.set(fg);
  };
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  const layout = { yClosed: 0.06, yOpen: 0.39, xOpen: 0, scaleOpen: 0.3 };
  const readLayout = () => {
    const cs = getComputedStyle(document.documentElement);
    const num = (name: string, fallback: number) => {
      const v = parseFloat(cs.getPropertyValue(name));
      return Number.isFinite(v) ? v : fallback;
    };
    layout.yClosed = num('--hero-y-closed', layout.yClosed);
    layout.yOpen = num('--hero-y-open', layout.yOpen);
    layout.xOpen = num('--hero-x-open', layout.xOpen);
    layout.scaleOpen = num('--hero-scale-open', layout.scaleOpen);
  };

  let restZ = REST_Z;
  let viewW = 1;
  let viewH = 1;
  const resize = () => {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(viewW, viewH, false);
    camera.aspect = viewW / viewH;
    camera.updateProjectionMatrix();
    const halfFov = THREE.MathUtils.degToRad(FOV / 2);
    restZ = Math.max(REST_Z, MIN_REST_WIDTH / (2 * Math.tan(halfFov) * camera.aspect));
    readLayout();
  };
  window.addEventListener('resize', resize);
  resize();

  let sheetP = 0;

  const introMs = reduceMotion ? 700 : INTRO_MS;
  let introStart: number | null = null;
  let introP = 0;
  let resolveIntro: (() => void) | null = null;
  let spin = 0;
  let last = 0;

  const baseSpin = reduceMotion ? 0.06 : SPIN_SPEED;
  let omega = baseSpin;
  let dragging = false;
  let dragMoved = 0;
  let hovering = false;
  let lastX = 0;
  let lastY = 0;
  let lastMoveT = 0;
  let velEma = 0;
  let downX = 0;
  let downY = 0;
  let downT = 0;
  let downHit = false;
  let pointer: { x: number; y: number } | null = null;

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const vTmp = new THREE.Vector3();

  const toScreen = (v: THREE.Vector3) => {
    v.project(camera);
    return { x: (v.x * 0.5 + 0.5) * viewW, y: (-v.y * 0.5 + 0.5) * viewH };
  };
  const pixelsPerUnit = () => {
    const halfFov = THREE.MathUtils.degToRad(FOV / 2);
    return (viewH / (2 * Math.tan(halfFov) * Math.max(camera.position.z, 0.1))) * world.scale.x;
  };
  const refreshMatrices = () => {
    camera.updateMatrixWorld();
    world.updateMatrixWorld(true);
  };

  const hitTest = (clientX: number, clientY: number): boolean => {
    if (introP < 1) return false;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    refreshMatrices();
    const c = toScreen(vTmp.set(BBOX_CX, BBOX_CY, 0).applyMatrix4(world.matrixWorld));
    if (Math.hypot(px - c.x, py - c.y) < pixelsPerUnit() * HIT_RADIUS) return true;
    ndc.set((px / viewW) * 2 - 1, -(py / viewH) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(fill, false).length > 0;
  };

  const setHover = (v: boolean) => {
    if (v === hovering) return;
    hovering = v;
    onHover?.(v);
  };
  const updateCursor = (over: boolean) => {
    canvas.style.cursor = dragging ? 'grabbing' : over ? 'grab' : '';
  };
  const radPerPx = () => Math.PI / (viewH * 0.4) / world.scale.x;
  const clampOmega = (v: number) => Math.max(-MAX_OMEGA, Math.min(MAX_OMEGA, v));

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    downX = lastX = e.clientX;
    downY = lastY = e.clientY;
    downT = lastMoveT = e.timeStamp;
    dragMoved = 0;
    downHit = hitTest(e.clientX, e.clientY);
    if (!downHit) return;
    dragging = true;
    velEma = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
    e.preventDefault();
    updateCursor(true);
    if (e.pointerType === 'mouse') setHover(true);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') pointer = { x: e.clientX, y: e.clientY };
    if (dragging) {
      const dx = e.clientX - lastX;
      const dtm = Math.max((e.timeStamp - lastMoveT) / 1000, 0.004);
      const dTheta = dx * radPerPx();
      spin += dTheta;
      velEma = velEma * 0.55 + (dTheta / dtm) * 0.45;
      dragMoved += Math.hypot(dx, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
      lastMoveT = e.timeStamp;
      return;
    }
    if (e.pointerType === 'mouse') {
      const over = hitTest(e.clientX, e.clientY);
      setHover(over);
      updateCursor(over);
    }
  });

  const endPress = (e: PointerEvent) => {
    if (dragging) {
      dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      if (dragMoved > 4) {
        omega = e.timeStamp - lastMoveT > 90 ? 0 : clampOmega(velEma);
      }
      if (e.pointerType === 'mouse') {
        const over = hitTest(e.clientX, e.clientY);
        setHover(over);
        updateCursor(over);
      } else {
        updateCursor(false);
      }
    }
    const travel = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (e.type === 'pointerup' && e.pointerType === 'touch' && travel < 8 && e.timeStamp - downT < 500) {
      onTap?.(downHit);
    }
  };
  canvas.addEventListener('pointerup', endPress);
  canvas.addEventListener('pointercancel', endPress);
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse' || dragging) return;
    pointer = null;
    setHover(false);
    updateCursor(false);
  });

  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    if (introStart === null && introP === 0) return;

    if (introStart !== null) {
      introP = clamp01((now - introStart) / introMs);
      if (introP === 1) {
        introStart = null;
        resolveIntro?.();
      }
    }

    const zoom = reduceMotion ? easeOutCubic(introP) : easeOutExpo(introP);
    const settle = reduceMotion ? 1 : easeOutQuart(introP);
    const fade = easeOutCubic(clamp01(introP / 0.45));

    const shift = layout.yClosed + (layout.yOpen - layout.yClosed) * sheetP;
    const shiftX = -layout.xOpen * sheetP;
    camera.setViewOffset(viewW, viewH, Math.round(viewW * shiftX), Math.round(viewH * shift), viewW, viewH);
    world.scale.setScalar(1 + (layout.scaleOpen - 1) * sheetP);

    const startZ = restZ * (reduceMotion ? 0.8 : START_Z_RATIO);
    camera.position.z = THREE.MathUtils.lerp(startZ, restZ, zoom);

    if (!dragging) {
      spin += dt * omega;
      omega += (baseSpin - omega) * (1 - Math.exp(-dt / SPIN_RELAX_S));
    }
    logo.rotation.y = spin + (1 - settle) * -Math.PI * 1.1;
    logo.rotation.x = TILT_X + (1 - settle) * 0.45;
    logo.position.y = Math.sin(now * 0.0008) * 0.04 * introP;

    (fill.material as THREE.MeshPhysicalMaterial).opacity = 0.22 * fade;
    (edges.material as THREE.LineBasicMaterial).opacity = 0.95 * fade;

    glowBlue.material.opacity = 0.5 * fade * (0.85 + 0.15 * Math.sin(now * 0.0009));
    glowViolet.material.opacity = 0.45 * fade * (0.85 + 0.15 * Math.sin(now * 0.0011 + 1.7));
    glowBlue.position.set(-0.6 + Math.sin(now * 0.0004) * 0.25, -0.7 + Math.cos(now * 0.0005) * 0.2, -1);
    glowViolet.position.set(0.8 + Math.cos(now * 0.00045) * 0.25, 0.9 + Math.sin(now * 0.0004) * 0.2, -1);

    renderer.render(scene, camera);

    if (pointer && !dragging && sheetP > 0.001 && sheetP < 0.999) {
      const over = hitTest(pointer.x, pointer.y);
      setHover(over);
      updateCursor(over);
    }
  });

  return {
    setProgress(p: number) {
      sheetP = p;
    },
    hitTest,
    wasDrag: () => dragMoved > 6,
    getAnchors() {
      refreshMatrices();
      const pivot = toScreen(vTmp.set(0, 0, 0).applyMatrix4(world.matrixWorld));
      const center = toScreen(vTmp.set(0, 0, 0).applyMatrix4(logo.matrixWorld));
      return { pivot, center, ppu: pixelsPerUnit() };
    },
    intro() {
      return new Promise<void>((resolve) => {
        resolveIntro = resolve;
        introStart = performance.now();
      });
    },
  };
}
