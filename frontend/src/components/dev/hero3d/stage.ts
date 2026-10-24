import * as THREE from 'three';

export type Pointer = {
  /** Smoothed cursor position relative to the stage center, about -1..1 across the viewport (for tilting) */
  look: THREE.Vector2;
  /** Cursor in the stage's normalized device coordinates (can go past ±1 when outside) */
  ndc: THREE.Vector2;
  /** 0..1, eases up while the cursor moves and fades when it stops */
  activity: number;
  /** True while a pointer drag started on the canvas is in progress */
  dragging: boolean;
  /** Horizontal drag movement since the last frame, in pixels */
  dragDX: number;
  /** Smoothed page scroll, in viewport heights (0 at the top) */
  scroll: number;
};

export type StageContext = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pointer: Pointer;
  canvas: HTMLCanvasElement;
};

export type StageHooks = {
  frame: (time: number, dt: number) => void;
  /** Custom render (e.g. through a post-processing composer); defaults to renderer.render */
  render?: () => void;
  resize?: (width: number, height: number) => void;
  dispose?: () => void;
};

/**
 * Mounts a WebGL canvas in `container` and runs `setup`'s frame loop.
 * Handles DPR, resizing, pointer tracking and pausing while off screen or in
 * a background tab. Returns a cleanup function.
 */
export function runStage(
  container: HTMLElement,
  setup: (ctx: StageContext) => StageHooks | Promise<StageHooks>,
  { fov = 35, z = 4.2, background }: { fov?: number; z?: number; background?: string } = {},
): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !background, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  if (background) scene.background = new THREE.Color(background);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(0, 0, z);

  const pointer: Pointer = { look: new THREE.Vector2(), ndc: new THREE.Vector2(9, 9), activity: 0, dragging: false, dragDX: 0, scroll: 0 };
  const lookTarget = new THREE.Vector2();
  let lastMove = -1e9;
  let lastDragX = 0;

  const onMove = (e: PointerEvent) => {
    if (pointer.dragging) {
      pointer.dragDX += e.clientX - lastDragX;
      lastDragX = e.clientX;
    }
    // A finger is not a cursor: on touch screens the look comes from tilting the phone
    if (e.pointerType === 'touch') return;
    const r = container.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    lookTarget.set(
      THREE.MathUtils.clamp((e.clientX - cx) / (window.innerWidth / 2), -1, 1),
      THREE.MathUtils.clamp(-(e.clientY - cy) / (window.innerHeight / 2), -1, 1),
    );
    pointer.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    lastMove = performance.now();
  };

  // Phone tilt -> look. Neutral is however the phone is held: the baseline slowly follows it.
  let tiltBase: { b: number; g: number } | null = null;
  const onTilt = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    if (!tiltBase) tiltBase = { b: e.beta, g: e.gamma };
    tiltBase.b += (e.beta - tiltBase.b) * 0.01;
    tiltBase.g += (e.gamma - tiltBase.g) * 0.01;
    lookTarget.set(
      THREE.MathUtils.clamp((e.gamma - tiltBase.g) / 18, -1, 1),
      THREE.MathUtils.clamp(-(e.beta - tiltBase.b) / 18, -1, 1),
    );
  };
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  type OrientationWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
  const needsPermission = typeof (window.DeviceOrientationEvent as OrientationWithPermission)?.requestPermission === 'function';
  let tiltOn = false;
  const enableTilt = () => {
    if (tiltOn) return;
    tiltOn = true;
    window.addEventListener('deviceorientation', onTilt);
  };
  // Android: just works. iOS: asks once, on the first tap on the helmet.
  if (coarse && !needsPermission) enableTilt();

  const onDown = (e: PointerEvent) => {
    pointer.dragging = true;
    lastDragX = e.clientX;
    if (coarse && needsPermission && !tiltOn) {
      (window.DeviceOrientationEvent as OrientationWithPermission)
        .requestPermission!()
        .then((state) => state === 'granted' && enableTilt())
        .catch(() => {});
    }
  };
  const onUp = () => (pointer.dragging = false);
  window.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  let hooks: StageHooks | null = null;
  let disposed = false;
  let visible = true;
  let raf = 0;
  let last = performance.now();
  const start = last;

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    hooks?.resize?.(w, h);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) loop();
  });
  io.observe(container);
  const onVisibility = () => !document.hidden && visible && loop();
  document.addEventListener('visibilitychange', onVisibility);

  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }
  function tick(now: number) {
    if (disposed || !hooks) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    pointer.look.lerp(lookTarget, 1 - Math.pow(0.0015, dt));
    pointer.scroll += (window.scrollY / window.innerHeight - pointer.scroll) * (1 - Math.pow(0.002, dt));
    const moving = now - lastMove < 120 ? 1 : 0;
    pointer.activity += (moving - pointer.activity) * (1 - Math.pow(moving ? 0.02 : 0.3, dt));
    hooks.frame((now - start) / 1000, dt);
    if (hooks.render) hooks.render();
    else renderer.render(scene, camera);
    pointer.dragDX = 0;
    if (visible && !document.hidden) raf = requestAnimationFrame(tick);
  }

  Promise.resolve(setup({ renderer, scene, camera, pointer, canvas })).then((h) => {
    if (disposed) {
      h.dispose?.();
      return;
    }
    hooks = h;
    resize();
    loop();
  });

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('deviceorientation', onTilt);
    hooks?.dispose?.();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((mat) => mat.dispose());
    });
    renderer.dispose();
    canvas.remove();
  };
}

/** A div the stage canvas fills; edges fade into the section background. */
export const STAGE_MASK = {
  maskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, black 62%, transparent 100%)',
  WebkitMaskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, black 62%, transparent 100%)',
} as const;
