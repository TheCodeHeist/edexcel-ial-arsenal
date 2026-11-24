/* Star Lab: the 3D view of a binary system (three.js), sharing its shaders with the life-cycle view (cosmos.ts).

   The orbit lies in the x–z plane; the arrow points to the Earth (inclination i from the orbit's axis), and
   "From the Earth" puts the camera on that arrow, so you see exactly the eclipses and the motion along the line of
   sight that the graphs show. The separation is always drawn the same size; stars are to scale with it when they
   can be (Algol, Spica, Cygnus X-1), otherwise drawn bigger so you can see them (and the HUD says so).
   Gas streams (type Ia, X-ray binary) are drawn in the frame turning with the stars: from the inner Lagrange point
   of the stretched donor, curving behind the orbit into the accretor's disc. */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createBloomRig, type BloomRig } from '../../lib/bloom';
import { FpsMeter, getDpr, getMinFrameMs, getPerf, isReducedMotion, onPerf } from '../../lib/perf';
import { STAR_V, STAR_F, SOFT_F, SHELL_V, DISC_V, FIELD_V, MAXPT, points, glowTexture, vivid, rand, gauss, sphereDir } from './cosmos';
import { bbColor, RSUN, AU } from './data';
import { positions, type Sys } from './binary';

export interface BLook { sys: Sys; phi: number; earth: boolean; boom: number /* 0, or 0–1 through a type Ia explosion */; feed: number /* 0–1 how close the white dwarf is to 1.4 M☉ */ }

const SEP = 6; // drawn separation

const STREAM_V = /* glsl */ `
attribute float aSeed; attribute vec3 aJit;
uniform float uTime; uniform float uAlpha; uniform float uPx; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
uniform float uMaxPt;
float ps(float s, float z){ return -z < 0.05 ? 0.0 : min(s * uPx / -z, uMaxPt); }
varying vec3 vColor; varying float vAlpha;
void main(){
  float f = fract(aSeed + uTime * 0.32);
  vec3 p = mix(mix(uA, uB, f), mix(uB, uC, f), f) + aJit * (0.04 + 0.12 * f);
  vColor = mix(vec3(1.3, 0.6, 0.3), vec3(1.5, 1.3, 1.6), f * f);
  vAlpha = uAlpha * 0.5 * smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.9, 1.0, f));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = ps(0.07, mv.z);
  gl_Position = projectionMatrix * mv;
}`;

interface Part {
  group: THREE.Group;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.Material>;
  glow: THREE.Sprite;
  disc?: THREE.Points;
  r: number;
}

export class BinaryScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  autoRotate = false;
  toScale = true;
  #rig: BloomRig | null = null;
  #rigLoading = false;
  #small: boolean;
  #bloomOn = true;
  #minMs = 0;
  #fps: FpsMeter;
  #offPerf: () => void;
  #raf = 0;
  #last = 0;
  #time = { value: 0 };
  #px = { value: 600 };
  #visible = true;
  #dead = false;
  #io: IntersectionObserver;
  #ro: ResizeObserver;
  #look: BLook | null = null;
  #built = '';
  #parts: Part[] = [];
  #sys = new THREE.Group();
  #rings: THREE.LineLoop[] = [];
  #arrow: THREE.ArrowHelper;
  #stream: THREE.Points;
  #shell: THREE.Points;
  #flash: THREE.Sprite;
  #tex = glowTexture();
  #zoom = 1;
  #armed = false;

  constructor(readonly canvas: HTMLCanvasElement, small = false) {
    this.#small = small;
    const perf = getPerf();
    this.#bloomOn = perf.bloom;
    this.#minMs = getMinFrameMs();
    const eco = perf.resolution === 'eco';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !small && !eco, powerPreference: eco ? 'low-power' : 'high-performance' });
    this.renderer.setPixelRatio(getDpr(small));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.background = new THREE.Color(0x03040a);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 4000);
    this.camera.position.set(0, 7, 15);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.rotateSpeed = 0.6;

    // background stars
    {
      const n = small ? 1500 : 2800;
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const [x, y, z] = sphereDir(), R = 900 + rand() * 300;
        pos.set([x * R, y * R, z * R], i * 3);
        const [r, g, b] = bbColor(3000 + rand() ** 2 * 20000), br = 0.35 + rand() ** 3 * 0.9;
        col.set([r * br, g * br, b * br], i * 3);
        size[i] = 0.8 + rand() ** 4 * 2.6;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      this.scene.add(new THREE.Points(geo, new THREE.ShaderMaterial({
        vertexShader: FIELD_V, fragmentShader: SOFT_F, uniforms: { uDpr: { value: this.renderer.getPixelRatio() * 1.6 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      })));
    }
    this.scene.add(this.#sys);

    // the line of sight to the Earth
    this.#arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 9, 0x7fb2ff, 0.6, 0.3);
    this.scene.add(this.#arrow);

    // gas stream
    {
      const n = small ? 1500 : 3000;
      const aSeed = new Float32Array(n), aJit = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { aSeed[i] = rand(); aJit.set([gauss(), gauss() * 0.5, gauss()], i * 3); }
      this.#stream = points(n, { aSeed: [aSeed, 1], aJit: [aJit, 3] }, STREAM_V, {
        uTime: this.#time, uAlpha: { value: 0 }, uPx: this.#px, uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() },
      });
      this.scene.add(this.#stream);
    }
    // supernova shell and flash
    {
      const n = small ? 7000 : 14000;
      const aDir = new Float32Array(n * 3), aR = new Float32Array(n), aSeed = new Float32Array(n), aSize = new Float32Array(n);
      for (let i = 0; i < n; i++) { aDir.set(sphereDir(), i * 3); aR[i] = 1 - rand() ** 2.2; aSeed[i] = rand(); aSize[i] = 0.25 + rand() ** 3 * 0.9; }
      this.#shell = points(n, { aDir: [aDir, 3], aR: [aR, 1], aSeed: [aSeed, 1], aSize: [aSize, 1] }, SHELL_V,
        { uTime: this.#time, uRadius: { value: 1 }, uMode: { value: 1 }, uAlpha: { value: 0 }, uPx: this.#px });
      this.scene.add(this.#shell);
      this.#flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.#tex, color: 0xdde6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.scene.add(this.#flash);
    }

    if (this.#bloomOn) this.#ensureBloom();

    this.#ro = new ResizeObserver(() => this.resize());
    this.#ro.observe(canvas);
    this.#io = new IntersectionObserver(([e]) => { this.#visible = e.isIntersecting; this.#kick(); });
    this.#io.observe(canvas);
    document.addEventListener('visibilitychange', this.#kick);
    canvas.addEventListener('wheel', this.#wheel, { passive: false });
    canvas.addEventListener('pointerdown', this.#arm);
    canvas.addEventListener('pointerleave', this.#disarm);
    this.#fps = new FpsMeter(canvas.parentElement);
    this.#offPerf = onPerf((p) => {
      this.#bloomOn = p.bloom;
      if (this.#bloomOn) this.#ensureBloom();
      this.#minMs = getMinFrameMs();
      const dpr = getDpr(this.#small);
      if (this.renderer.getPixelRatio() !== dpr) { this.renderer.setPixelRatio(dpr); this.resize(); }
      this.#kick();
    });
    this.resize();
  }

  #ensureBloom() {
    if (this.#rig || this.#rigLoading || this.#dead) return;
    this.#rigLoading = true;
    createBloomRig(this.renderer, this.scene, this.camera, [0.7, 0.5, 0.7], this.canvas.clientWidth, this.canvas.clientHeight)
      .then((rig) => {
        if (this.#dead) { rig.composer.dispose(); return; }
        this.#rig = rig;
        this.resize();
      })
      .catch(() => {})
      .finally(() => { this.#rigLoading = false; });
  }

  #arm = () => { this.#armed = true; };
  #disarm = () => { this.#armed = false; };
  #wheel = (e: WheelEvent) => { if (!this.#armed && !e.ctrlKey) return; e.preventDefault(); this.zoomBy(Math.exp(e.deltaY * 0.0012)); };
  zoomBy(f: number) { this.#zoom = Math.max(0.35, Math.min(3, this.#zoom * f)); this.#kick(); }
  resetView() { this.#zoom = 1; this.camera.position.set(0, 7, 15); this.controls.update(); this.#kick(); }

  set(look: BLook) { this.#look = look; this.#kick(); }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.#rig?.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    MAXPT.value = 72 * this.renderer.getPixelRatio();
    this.#px.value = (h * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.#kick();
  }

  #kick = () => {
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
    this.#time.value += dt;
    this.#update(dt);
    this.controls.autoRotate = this.autoRotate && !isReducedMotion();
    this.controls.update(dt);
    if (this.#bloomOn && this.#rig) this.#rig.composer.render(dt); else this.renderer.render(this.scene, this.camera);
    this.#fps.tick(now);
    if (this.#visible && !document.hidden) this.#raf = requestAnimationFrame(this.#frame);
  };

  /** (Re)build the two bodies for a new system. */
  #build(s: Sys) {
    for (const p of this.#parts) {
      this.#sys.remove(p.group);
      p.group.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.(); });
    }
    for (const r of this.#rings) { this.#sys.remove(r); r.geometry.dispose(); (r.material as THREE.Material).dispose(); }
    this.#parts = []; this.#rings = [];
    const S = SEP / s.a;
    this.toScale = true;
    for (const b of s.bodies) {
      const group = new THREE.Group();
      const real = ((b.R * RSUN) / AU) * S;
      const min = b.kind === 'whitedwarf' ? 0.1 : b.kind === 'blackhole' ? 0.12 : 0.35;
      if (real < min * 0.98) this.toScale = false;
      const r = Math.max(real, min);
      let mesh: Part['mesh'];
      if (b.kind === 'blackhole') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      } else {
        const [cr, cg, cb] = vivid(b.T);
        mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.ShaderMaterial({
          vertexShader: STAR_V, fragmentShader: STAR_F,
          uniforms: {
            uColor: { value: new THREE.Color(cr, cg, cb) }, uTime: this.#time, uCells: { value: b.kind === 'giant' ? 4 : b.kind === 'whitedwarf' ? 16 : 10 },
            uContrast: { value: b.kind === 'giant' ? 0.6 : 0.25 }, uBright: { value: b.kind === 'whitedwarf' ? 1.2 : 0.9 }, uDark: { value: 0 }, uBands: { value: 0 },
          },
        }));
        mesh.scale.setScalar(r);
      }
      group.add(mesh);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.#tex, transparent: true, opacity: b.kind === 'blackhole' ? 0 : 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
      const [gr, gg, gb] = vivid(b.T || 6000);
      (glow.material as THREE.SpriteMaterial).color.setRGB(gr, gg, gb);
      glow.scale.setScalar(r * 2.8 + (b.kind === 'whitedwarf' ? 0.4 : 0.1));
      group.add(glow);
      let disc: THREE.Points | undefined;
      if (s.stream && (b.kind === 'blackhole' || b.kind === 'whitedwarf')) {
        const n = 9000;
        const aR = new Float32Array(n), aA = new Float32Array(n), aH = new Float32Array(n), aS = new Float32Array(n);
        for (let i = 0; i < n; i++) { aR[i] = rand(); aA[i] = rand() * Math.PI * 2; aH[i] = gauss(); aS[i] = rand(); }
        disc = points(n, { aR: [aR, 1], aA: [aA, 1], aH: [aH, 1], aSeed: [aS, 1] }, DISC_V,
          { uTime: this.#time, uIn: { value: r * 1.6 }, uOut: { value: SEP * 0.22 }, uAlpha: { value: 1 }, uPx: this.#px });
        group.add(disc);
      }
      this.#sys.add(group);
      this.#parts.push({ group, mesh, glow, disc, r });
    }
    // the two orbits round the centre of mass
    const tot = s.bodies[0].M + s.bodies[1].M;
    for (const [k, b] of s.bodies.entries()) {
      const rr = (SEP * s.bodies[1 - k].M) / tot;
      const pts = Array.from({ length: 96 }, (_, i) => new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2) * rr, 0, Math.sin((i / 96) * Math.PI * 2) * rr));
      const [cr, cg, cb] = vivid(b.T || 6000);
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(cr * 0.5, cg * 0.5, cb * 0.5), transparent: true, opacity: 0.55 }));
      this.#sys.add(ring);
      this.#rings.push(ring);
    }
    const i = (s.inc * Math.PI) / 180;
    this.#arrow.setDirection(new THREE.Vector3(0, Math.cos(i), Math.sin(i)));
    this.#arrow.position.set(0, 0, 0);
  }

  #update(dt: number) {
    const L = this.#look;
    if (!L) return;
    const s = L.sys;
    if (this.#built !== s.id) { this.#build(s); this.#built = s.id; }
    const S = SEP / s.a;
    const [p1, p2] = positions(s, L.phi).map((p) => new THREE.Vector3(p[0] * S, p[1] * S, p[2] * S));
    const [a, b] = this.#parts;
    a.group.position.copy(p1);
    b.group.position.copy(p2);
    // a star feeding its companion is pulled into a teardrop (it fills its Roche lobe)
    if (s.stream && s.bodies[0].kind !== 'blackhole') {
      a.mesh.lookAt(p2);
      a.mesh.scale.set(a.r, a.r, a.r * 1.18);
    }
    for (const p of this.#parts) { p.mesh.rotation.y += dt * 0.1; if (p.disc) p.disc.rotation.set(0.15, 0, 0); }

    // the stream: from the inner Lagrange point, curving behind the orbit into the disc
    const sm = this.#stream.material as THREE.ShaderMaterial;
    const exploded = L.boom > 0;
    const gas = s.stream && !exploded;
    sm.uniforms.uAlpha.value = gas ? 1 : 0;
    this.#stream.visible = !!gas;
    if (gas) {
      const dir = p2.clone().sub(p1).normalize();
      const tang = new THREE.Vector3(-dir.z, 0, dir.x);   // the direction the accretor moves in, relative to the donor
      const A = p1.clone().addScaledVector(dir, a.r * 1.18);
      const C = p2.clone().addScaledVector(tang, -SEP * 0.12).addScaledVector(dir, -SEP * 0.06);
      const B = A.clone().lerp(C, 0.5).addScaledVector(tang, -SEP * 0.2);
      sm.uniforms.uA.value.copy(A); sm.uniforms.uB.value.copy(B); sm.uniforms.uC.value.copy(C);
      if (b.disc) (b.disc.material as THREE.ShaderMaterial).uniforms.uAlpha.value = s.kind === 'typeIa' ? 0.5 + 0.5 * L.feed : 1;
    }

    // type Ia: the white dwarf is gone in a flash; the companion is left behind
    const shm = this.#shell.material as THREE.ShaderMaterial, fm = this.#flash.material as THREE.SpriteMaterial;
    if (exploded) {
      const u = L.boom;
      b.group.visible = false;
      shm.uniforms.uRadius.value = 0.5 + 16 * u ** 0.6;
      shm.uniforms.uAlpha.value = Math.min(1, u * 12) * (1 - 0.6 * u);
      this.#shell.position.copy(p2);
      fm.opacity = Math.exp(-((u - 0.04) ** 2) / 0.003) + 0.15 * (1 - u);
      this.#flash.position.copy(p2);
      this.#flash.scale.setScalar(10 + 30 * Math.min(1, u * 4));
    } else {
      b.group.visible = true;
      shm.uniforms.uAlpha.value = 0;
      fm.opacity = 0;
    }
    this.#shell.visible = shm.uniforms.uAlpha.value > 0.01;
    this.#flash.visible = fm.opacity > 0.01;

    // camera: from the Earth (on the line of sight) or free
    const i = (s.inc * Math.PI) / 180;
    const dist = (exploded ? 30 : SEP * 2.3) * this.#zoom * (this.camera.aspect < 1 ? 1.4 / Math.max(0.55, this.camera.aspect) : 1);
    this.controls.enabled = !L.earth;
    this.#arrow.visible = !L.earth;
    if (L.earth) {
      this.camera.position.set(0, Math.cos(i), Math.sin(i)).multiplyScalar(dist);
      this.camera.lookAt(0, 0, 0);
    } else {
      const dir = this.camera.position.clone();
      if (dir.lengthSq() < 1e-6 || !isFinite(dir.x + dir.y + dir.z)) dir.set(0, 0.45, 1);
      const cur = dir.length();
      this.camera.position.copy(dir.normalize().multiplyScalar(cur + (dist - cur) * (1 - Math.exp(-dt * 3))));
    }
  }

  dispose() {
    this.#dead = true;
    this.#offPerf();
    this.#fps.dispose();
    cancelAnimationFrame(this.#raf);
    this.#io.disconnect();
    this.#ro.disconnect();
    document.removeEventListener('visibilitychange', this.#kick);
    this.canvas.removeEventListener('wheel', this.#wheel);
    this.canvas.removeEventListener('pointerdown', this.#arm);
    this.canvas.removeEventListener('pointerleave', this.#disarm);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
    });
    this.#tex.dispose();
    this.#rig?.composer.dispose();
    this.renderer.dispose();
  }
}
