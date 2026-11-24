/* Particle Lab: the shared 3D stage (three.js). Each view (accelerators, detectors, scattering) extends Stage3D and
   fills in build() and update(dt); this class owns the renderer, the bloom, the orbiting camera, resizing, pausing
   when off screen, wheel zoom only after a click (so the page still scrolls), and clean disposal.

   Safety, learned the hard way in Star Lab: point sprites are capped in size (uMaxPt), any non-finite camera value
   snaps back, and a lost WebGL context stops the loop at once (View3D then rebuilds on a fresh canvas). */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createBloomRig, type BloomRig } from '../../lib/bloom';
import { FpsMeter, getDpr, getMinFrameMs, getPerf, isReducedMotion, onPerf } from '../../lib/perf';

export { THREE };

/** Capped point size, shared by every points material (pixels × device pixel ratio). */
export const MAXPT = { value: 64 };

/** Soft round point sprite; vColor and vAlpha come from the vertex shader. */
export const SOFT_F = /* glsl */ `
varying vec3 vColor; varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d); a *= a;
  if (a * vAlpha < 0.004) discard;
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;

/** The size helper every points vertex shader should use: s in world units, z the view-space depth. */
export const PS = /* glsl */ `
uniform float uPx; uniform float uMaxPt;
float ps(float s, float z){ return -z < 0.05 ? 0.0 : min(s * uPx / -z, uMaxPt); }`;

/** Plain points with per-point position, colour (aColor), size in world units (aSize) and alpha (aAlpha). */
export const BASIC_V = /* glsl */ `
attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
${PS}
varying vec3 vColor; varying float vAlpha;
void main(){
  vColor = aColor; vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = ps(aSize, mv.z);
  gl_Position = projectionMatrix * mv;
}`;

export const rand = (() => { let s = 7654321; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
export const gauss = () => { let u = 0; while (u === 0) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); };
export const sphereDir = (): [number, number, number] => { const z = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), z, r * Math.sin(a)]; };
export const fin = (x: number, d = 0) => (Number.isFinite(x) ? x : d);

export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.12, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.14)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.03)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A text label as a sprite (for parts of an apparatus). Height h in world units. */
export function label(text: string, h = 0.4, color = '#dfe6ff') {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const fs = 48;
  g.font = `600 ${fs}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  const w = Math.ceil(g.measureText(text).width) + 24;
  c.width = w; c.height = fs + 20;
  g.font = `600 ${fs}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  g.fillStyle = 'rgba(6,8,18,0.55)';
  g.beginPath(); g.roundRect(0, 0, w, fs + 20, 14); g.fill();
  g.fillStyle = color; g.textBaseline = 'middle';
  g.fillText(text, 12, (fs + 20) / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
  s.scale.set((h * w) / (fs + 20), h, 1);
  s.renderOrder = 10;
  return s;
}

/** A buffer of n points drawn with BASIC_V; write into .pos/.col/.size/.alpha then call .flush(). */
export function pointCloud(n: number, px: { value: number }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const mat = new THREE.ShaderMaterial({
    vertexShader: BASIC_V, fragmentShader: SOFT_F, uniforms: { uPx: px, uMaxPt: MAXPT },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const obj = new THREE.Points(geo, mat);
  obj.frustumCulled = false;
  return {
    obj, pos, col, size, alpha, n,
    flush(count = n) {
      geo.setDrawRange(0, count);
      for (const k of ['position', 'aColor', 'aSize', 'aAlpha']) (geo.getAttribute(k) as THREE.BufferAttribute).needsUpdate = true;
    },
  };
}

export interface StageOpts { bloom?: [strength: number, radius: number, threshold: number]; fov?: number; cam?: [number, number, number]; target?: [number, number, number]; bg?: number }

export abstract class Stage3D<L> {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  autoRotate = false;
  /** world-to-pixel factor for point sizes (pass to pointCloud and custom shaders as uPx) */
  readonly px = { value: 600 };
  readonly time = { value: 0 };
  protected look: L | null = null;
  protected zoom = 1;
  protected readonly small: boolean;
  protected readonly tex = glowTexture();
  #rig: BloomRig | null = null;
  #rigLoading = false;
  #bloomOpts: [number, number, number];
  #bloomOn = true;
  #minMs = 0;
  #fps: FpsMeter;
  #offPerf: () => void;
  #raf = 0;
  #last = 0;
  #visible = true;
  #dead = false;
  #armed = false;
  #io: IntersectionObserver;
  #ro: ResizeObserver;
  #home: THREE.Vector3;
  #target: THREE.Vector3;

  constructor(readonly canvas: HTMLCanvasElement, small = false, o: StageOpts = {}) {
    this.small = small;
    const perf = getPerf();
    this.#bloomOn = perf.bloom;
    this.#minMs = getMinFrameMs();
    const eco = perf.resolution === 'eco';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !small && !eco, powerPreference: eco ? 'low-power' : 'high-performance' });
    this.renderer.setPixelRatio(getDpr(small));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.background = new THREE.Color(o.bg ?? 0x03040a);
    this.camera = new THREE.PerspectiveCamera(o.fov ?? 45, 1, 0.01, 4000);
    this.#home = new THREE.Vector3(...(o.cam ?? [0, 6, 14]));
    this.#target = new THREE.Vector3(...(o.target ?? [0, 0, 0]));
    this.camera.position.copy(this.#home);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(this.#target);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.rotateSpeed = 0.6;
    this.controls.update();

    this.#bloomOpts = o.bloom ?? [0.6, 0.45, 0.72];
    if (this.#bloomOn) this.#ensureBloom();

    this.#ro = new ResizeObserver(() => this.resize());
    this.#ro.observe(canvas);
    this.#io = new IntersectionObserver(([e]) => { this.#visible = e.isIntersecting; this.kick(); });
    this.#io.observe(canvas);
    document.addEventListener('visibilitychange', this.kick);
    canvas.addEventListener('wheel', this.#wheel, { passive: false });
    canvas.addEventListener('pointerdown', this.#arm);
    canvas.addEventListener('pointerleave', this.#disarm);
    this.#fps = new FpsMeter(canvas.parentElement);
    this.#offPerf = onPerf((p) => {
      this.#bloomOn = p.bloom;
      if (this.#bloomOn) this.#ensureBloom();
      this.#minMs = getMinFrameMs();
      const dpr = getDpr(this.small);
      if (this.renderer.getPixelRatio() !== dpr) { this.renderer.setPixelRatio(dpr); this.resize(); }
      this.kick();
    });
  }

  #ensureBloom() {
    if (this.#rig || this.#rigLoading || this.#dead) return;
    this.#rigLoading = true;
    createBloomRig(this.renderer, this.scene, this.camera, this.#bloomOpts, this.canvas.clientWidth, this.canvas.clientHeight)
      .then((rig) => {
        if (this.#dead) { rig.composer.dispose(); return; }
        this.#rig = rig;
        this.resize();
      })
      .catch(() => {})
      .finally(() => { this.#rigLoading = false; });
  }

  /** Call at the end of the subclass constructor. */
  protected start() { this.resize(); }

  #arm = () => { this.#armed = true; };
  #disarm = () => { this.#armed = false; };
  #wheel = (e: WheelEvent) => { if (!this.#armed && !e.ctrlKey) return; e.preventDefault(); this.zoomBy(Math.exp(e.deltaY * 0.0012)); };

  zoomBy(f: number) {
    this.zoom = Math.max(0.3, Math.min(3, this.zoom * f));
    const d = this.camera.position.clone().sub(this.controls.target);
    const want = this.#home.distanceTo(this.#target) * this.zoom;
    if (d.lengthSq() > 1e-9) this.camera.position.copy(this.controls.target).add(d.setLength(want));
    this.kick();
  }
  resetView() { this.zoom = 1; this.camera.position.copy(this.#home); this.controls.target.copy(this.#target); this.controls.update(); this.kick(); }
  /** Move the camera's home (and go there). */
  setHome(cam: [number, number, number], target: [number, number, number] = [0, 0, 0]) {
    this.#home.set(...cam); this.#target.set(...target); this.resetView();
  }

  set(look: L) { this.look = look; this.kick(); }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.#rig?.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    MAXPT.value = 64 * this.renderer.getPixelRatio();
    this.px.value = (h * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.kick();
  }

  /** Screen point (client px) → normalised device coordinates, for raycasting picks. */
  ndc(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }

  kick = () => {
    if (this.#dead || this.#raf || !this.#visible || document.hidden) return;
    this.#last = performance.now();
    this.#raf = requestAnimationFrame(this.#frame);
  };
  #frame = (now: number) => {
    this.#raf = 0;
    if (this.#dead || this.renderer.getContext().isContextLost()) return;
    if (this.#minMs > 0 && now - this.#last < this.#minMs) {
      if (this.#visible && !document.hidden) this.#raf = requestAnimationFrame(this.#frame);
      return;
    }
    const dt = Math.min(0.05, Math.max(0, (now - this.#last) / 1000));
    this.#last = now;
    this.time.value += dt;
    if (this.look) this.update(dt);
    const p = this.camera.position;
    if (!Number.isFinite(p.x + p.y + p.z)) this.resetView();
    this.controls.autoRotate = this.autoRotate && !isReducedMotion();
    this.controls.update(dt);
    if (this.#bloomOn && this.#rig) this.#rig.composer.render(dt); else this.renderer.render(this.scene, this.camera);
    this.#fps.tick(now);
    if (this.#visible && !document.hidden) this.#raf = requestAnimationFrame(this.#frame);
  };

  protected abstract update(dt: number): void;

  get dead() { return this.#dead; }

  dispose() {
    this.#dead = true;
    this.#offPerf();
    this.#fps.dispose();
    cancelAnimationFrame(this.#raf);
    this.#io.disconnect();
    this.#ro.disconnect();
    document.removeEventListener('visibilitychange', this.kick);
    this.canvas.removeEventListener('wheel', this.#wheel);
    this.canvas.removeEventListener('pointerdown', this.#arm);
    this.canvas.removeEventListener('pointerleave', this.#disarm);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      const each = (x: THREE.Material) => { (x as THREE.SpriteMaterial).map?.dispose(); x.dispose(); };
      if (Array.isArray(mat)) mat.forEach(each); else if (mat) each(mat);
    });
    this.tex.dispose();
    this.#rig?.composer.dispose();
    this.renderer.dispose();
  }
}
