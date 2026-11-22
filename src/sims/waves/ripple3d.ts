/* Waves Lab, Ripple tank in 3D. The water is one grid mesh whose height is worked out on the graphics card, every
   frame, as the superposition of every source's circular wave (ripple.ts gives the sources and the physics). The
   vertex shader adds the waves up as h = C cos ωt + S sin ωt, so it gets the local amplitude √(C² + S²) for free:
   the "time-averaged" view colours the water by that amplitude instead (dark nodal lines, bright antinodal ones).
   Heights are clamped near the dippers, where 1/√r grows without limit.

   Overlays: the antinodal and nodal lines for two sources (exact hyperbolas, labelled with their path difference),
   Huygens' wavelets from points across a gap with the new wavefront as their envelope, and a probe pin with its
   paths to the sources. Clicking the water (without dragging) moves the probe. */

import { THREE, Stage3D, label } from '../particles/gl';
import { TANK, ZS, ZB, Z0, MAXSRC, hyperbola, lineSet, lamText, type RMode, type Src } from './ripple';

export interface RLook {
  mode: RMode;
  lambda: number;
  d: number; phi: number; gap: number; obs: number;
  src: Src[]; rmin: number; obl: boolean;
  shade: 'wave' | 'amp';
  incoh: boolean;
  lines: boolean;
  huygens: boolean;
  probe: [number, number];
}

const S = 0.35;                     // world units per cm
const HS = 0.3;                     // drawn height per unit of wave height / cm
const P = (x: number, y: number, z: number) => new THREE.Vector3(x * S, y * S, (z - TANK.z / 2) * S);

const VERT = /* glsl */ `
#define MAXS ${MAXSRC}
uniform vec4 uSrc[MAXS];
uniform int uN; uniform int uPlane; uniform int uObl; uniform int uFlat;
uniform float uK; uniform float uPh; uniform float uRmin; uniform float uHs; uniform float uZb; uniform float uZ0; uniform float uMaxH;
varying float vH; varying vec2 vG; varying float vAmp; varying float vInc; varying vec3 vW;
void main(){
  vec2 p = position.xz;
  float C = 0., Sn = 0., Cx = 0., Sx = 0., Cz = 0., Sz = 0., I = 0.;
  if (uPlane == 1 && p.y < uZb) {
    if (p.y > uZ0) {
      float th = uK * (p.y - uZ0);
      C = cos(th); Sn = sin(th); Cz = -uK * Sn; Sz = uK * C; I = 1.;
    }
  } else {
    for (int i = 0; i < MAXS; i++) {
      if (i >= uN) break;
      vec4 s = uSrc[i];
      vec2 d = p - s.xy;
      float r = max(uRmin, length(d));
      float a = s.z / sqrt(r);
      if (uObl == 1) a *= (1. + d.y / r) * .5;
      float th = uK * r + s.w;
      float c = cos(th), sn = sin(th);
      vec2 u = d / r;
      C += a * c; Sn += a * sn; I += a * a;
      Cx -= a * sn * uK * u.x; Sx += a * c * uK * u.x;
      Cz -= a * sn * uK * u.y; Sz += a * c * uK * u.y;
    }
  }
  float cp = cos(uPh), sp = sin(uPh);
  float h = C * cp + Sn * sp;
  vH = h;
  vG = vec2(Cx * cp + Sx * sp, Cz * cp + Sz * sp);
  vAmp = sqrt(C * C + Sn * Sn);
  vInc = sqrt(I);
  float y = uFlat == 1 ? 0. : clamp(h, -uMaxH, uMaxH) * uHs;
  vec4 w = modelMatrix * vec4(p.x, y, p.y, 1.);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform int uShade; uniform int uIncoh; uniform int uNorm; uniform float uHs;
varying float vH; varying vec2 vG; varying float vAmp; varying float vInc; varying vec3 vW;
vec3 ramp(float v){
  v = clamp(v, 0., 1.);
  vec3 a = vec3(0.005, 0.01, 0.03), b = vec3(0.09, 0.10, 0.40), c = vec3(0.10, 0.50, 0.70), d = vec3(0.62, 0.80, 0.78);
  return v < .4 ? mix(a, b, v / .4) : v < .75 ? mix(b, c, (v - .4) / .35) : mix(c, d, (v - .75) / .25);
}
void main(){
  float ref = uNorm == 1 ? max(vInc, 1e-4) * 1.41421 : 1.5;
  if (uShade == 1) {
    float v = uIncoh == 1 ? (uNorm == 1 ? 0.5 : vInc / 1.5) : vAmp / ref;
    gl_FragColor = vec4(ramp(v), 1.);
    return;
  }
  vec3 n = normalize(vec3(-vG.x * uHs, 1., -vG.y * uHs));
  vec3 L = normalize(vec3(-0.35, 1.0, 0.45));
  vec3 V = normalize(cameraPosition - vW);
  float diff = max(dot(n, L), 0.);
  float spec = pow(max(dot(n, normalize(L + V)), 0.), 80.);
  float crest = clamp(vH / ref * 0.5 + 0.5, 0., 1.);
  vec3 deep = vec3(0.012, 0.07, 0.13), hi = vec3(0.30, 0.80, 0.98);
  vec3 col = mix(deep, hi, crest * crest) * (0.45 + 0.7 * diff) + spec * vec3(0.55, 0.62, 0.7);
  float fres = pow(1. - max(dot(n, V), 0.), 3.);
  col += fres * vec3(0.05, 0.09, 0.14);
  gl_FragColor = vec4(col, 1.);
}`;

function box(w: number, h: number, d: number, color: number, at: THREE.Vector3, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w * S, h * S, d * S), new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, ...opts }));
  m.position.copy(at);
  return m;
}

export class RippleScene extends Stage3D<RLook> {
  onPick: ((x: number, z: number) => void) | null = null;
  #ph = 0;
  #extra = [0, 0];
  #uni: Record<string, THREE.IUniform>;
  #water: THREE.Mesh;
  #srcArr: THREE.Vector4[] = Array.from({ length: MAXSRC }, () => new THREE.Vector4());
  #key = '';
  // hardware
  #two = new THREE.Group();
  #dips: THREE.Mesh[] = [];
  #plane = new THREE.Group();
  #bar: THREE.Mesh;
  #barrier = new THREE.Group();
  // overlays
  #lines = new THREE.Group();
  #probe = new THREE.Group();
  #paths: THREE.Line;
  #ahead: THREE.Line;
  #wavelets: THREE.LineSegments;
  #envelope: THREE.LineSegments;
  #down: [number, number] | null = null;
  #ray = new THREE.Raycaster();

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: small ? [0, 12.5, 9.6] : [0, 10.5, 10.8], target: [0, -0.6, 0.6], bloom: [0.35, 0.4, 0.86], fov: 42 });
    this.scene.add(new THREE.AmbientLight(0x8a92b0, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-4, 9, 5);
    this.scene.add(sun);

    // ---- water ----
    const nx = small ? 170 : 280, nz = small ? 128 : 210;
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const k = (j * (nx + 1) + i) * 3;
      pos[k] = -TANK.x + (2 * TANK.x * i) / nx; pos[k + 1] = 0; pos[k + 2] = (TANK.z * j) / nz;
    }
    const idx: number[] = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    this.#uni = {
      uSrc: { value: this.#srcArr }, uN: { value: 0 }, uPlane: { value: 0 }, uObl: { value: 0 }, uFlat: { value: 0 },
      uK: { value: 1 }, uPh: { value: 0 }, uRmin: { value: 0.5 }, uHs: { value: HS }, uZb: { value: ZB }, uZ0: { value: Z0 }, uMaxH: { value: 2.2 },
      uShade: { value: 0 }, uIncoh: { value: 0 }, uNorm: { value: 1 },
    };
    this.#water = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.#uni, side: THREE.DoubleSide }));
    this.#water.scale.setScalar(S);
    this.#water.position.z = (-TANK.z / 2) * S;
    this.#water.frustumCulled = false;
    this.scene.add(this.#water);

    // ---- the tank ----
    const rim = 0x323b4e, H = 2.4;
    this.scene.add(
      box(2 * TANK.x + 2, H, 1, rim, P(0, -0.4, -0.5)),
      box(2 * TANK.x + 2, H, 1, rim, P(0, -0.4, TANK.z + 0.5)),
      box(1, H, TANK.z, rim, P(-TANK.x - 0.5, -0.4, TANK.z / 2)),
      box(1, H, TANK.z, rim, P(TANK.x + 0.5, -0.4, TANK.z / 2)),
    );

    // two dippers on one vibrating bar
    const steel = { metalness: 0.75, roughness: 0.3 };
    this.#two.add(box(34, 0.7, 0.9, 0x8a93a8, P(0, 4.2, ZS), steel));
    for (let i = 0; i < 2; i++) {
      const dip = new THREE.Mesh(new THREE.SphereGeometry(0.55 * S, 18, 12), new THREE.MeshStandardMaterial({ color: i ? 0xff7aa2 : 0x7aa2ff, emissive: i ? 0x501828 : 0x182850, roughness: 0.35 }));
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * S, 0.12 * S, 3.6 * S, 8), new THREE.MeshStandardMaterial({ color: 0xb8c0d0, ...steel }));
      rod.position.y = 1.9 * S;
      dip.add(rod);
      this.#dips.push(dip);
      this.#two.add(dip);
    }
    const motor = box(3, 2.2, 2.2, 0x3a4256, P(18.5, 4.2, ZS), { metalness: 0.5 });
    this.#two.add(motor);
    this.scene.add(this.#two);

    // straight dipper (plane waves)
    this.#bar = box(2 * TANK.x - 1, 1.1, 0.9, 0x8a93a8, P(0, 0.2, Z0), steel);
    this.#plane.add(this.#bar);
    const l3 = label('straight dipper: plane waves', 0.3); l3.position.copy(P(-8, 3.4, Z0)); this.#plane.add(l3);
    this.scene.add(this.#plane, this.#barrier);

    // ---- overlays ----
    this.scene.add(this.#lines);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * S, 0.08 * S, 5 * S, 8), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
    pin.position.y = 2.5 * S;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45 * S, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 0.5) }));
    head.position.y = 5 * S;
    const xl = label('X', 0.36, '#ffe08a'); xl.position.y = 6.6 * S;
    this.#probe.add(pin, head, xl);
    this.scene.add(this.#probe);
    const lm = (c: number) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.95, depthTest: false });
    this.#paths = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), lm(0xffe08a));
    this.#paths.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([0.48, 0.64, 1, 1, 0.88, 0.54, 1, 0.48, 0.64]), 3));
    (this.#paths.material as THREE.LineBasicMaterial).vertexColors = true;
    (this.#paths.material as THREE.LineBasicMaterial).color.set(0xffffff);
    this.#paths.renderOrder = 5;
    this.#ahead = new THREE.Line(new THREE.BufferGeometry().setFromPoints([P(0, 0.9, ZB), P(0, 0.9, TANK.z)]),
      new THREE.LineDashedMaterial({ color: 0x9fb4ff, dashSize: 0.15, gapSize: 0.12, depthTest: false, transparent: true }));
    this.#ahead.computeLineDistances();
    this.#ahead.renderOrder = 5;
    this.scene.add(this.#paths, this.#ahead);
    for (const l of [this.#paths, this.#ahead]) l.frustumCulled = false;
    const seg = (n: number, c: number, o: number) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const s = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false }));
      s.frustumCulled = false; s.renderOrder = 6;
      return s;
    };
    this.#wavelets = seg(9 * 3 * 32 * 2, 0xbfe6ff, 0.55);
    this.#envelope = seg(3 * (2 + 2 * 20 * 2), 0xfff3a0, 1);
    this.scene.add(this.#wavelets, this.#envelope);

    canvas.addEventListener('pointerdown', this.#pd);
    canvas.addEventListener('pointerup', this.#pu);
    this.start();
  }

  #pd = (e: PointerEvent) => { this.#down = [e.clientX, e.clientY]; };
  #pu = (e: PointerEvent) => {
    const d = this.#down; this.#down = null;
    if (!d || Math.hypot(e.clientX - d[0], e.clientY - d[1]) > 6 || !this.onPick) return;
    this.#ray.setFromCamera(this.ndc(e.clientX, e.clientY), this.camera);
    const hit = new THREE.Vector3();
    if (!this.#ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return;
    const x = hit.x / S, z = hit.z / S + TANK.z / 2;
    if (Math.abs(x) <= TANK.x && z >= 0 && z <= TANK.z) this.onPick(x, z);
  };

  /** ωt for the water (radians), and extra phase lags per source (incoherent sources). */
  setPhase(ph: number, extra: number[] = [0, 0]) { this.#ph = ph; this.#extra = extra; }

  #rebuild(o: RLook) {
    // sources
    const u = this.#uni;
    o.src.forEach((s, i) => this.#srcArr[i].set(s.x, s.z, s.amp, s.psi));
    u.uN.value = o.src.length;
    u.uK.value = (2 * Math.PI) / o.lambda;
    u.uRmin.value = o.rmin;
    u.uObl.value = o.obl ? 1 : 0;
    u.uPlane.value = o.mode === 'two' ? 0 : 1;
    u.uNorm.value = o.mode === 'two' ? 1 : 0;
    u.uMaxH.value = o.mode === 'two' ? 2.0 : 1.8;
    this.#two.visible = o.mode === 'two';
    this.#plane.visible = o.mode !== 'two';
    if (o.mode === 'two') o.src.forEach((s, i) => this.#dips[i].position.copy(P(s.x, 0.4, s.z)));

    // barrier
    for (const c of [...this.#barrier.children]) { this.#barrier.remove(c); (c as THREE.Mesh).geometry?.dispose(); }
    const wall = 0x5a6274;
    if (o.mode === 'gap') {
      const w = TANK.x - o.gap / 2;
      this.#barrier.add(box(w, 2.2, 0.7, wall, P(-TANK.x + w / 2, 0.2, ZB)), box(w, 2.2, 0.7, wall, P(TANK.x - w / 2, 0.2, ZB)));
      const l = label(`gap ${+o.gap.toFixed(1)} cm`, 0.3); l.position.copy(P(0, 3.2, ZB - 1)); this.#barrier.add(l);
    } else if (o.mode === 'obstacle') {
      this.#barrier.add(box(o.obs, 2.2, 0.9, wall, P(0, 0.2, ZB)));
      const l = label(`obstacle ${+o.obs.toFixed(1)} cm`, 0.3); l.position.copy(P(0, 3.2, ZB - 1)); this.#barrier.add(l);
    }

    // nodal and antinodal lines
    for (const c of [...this.#lines.children]) { this.#lines.remove(c); (c as THREE.Line).geometry?.dispose(); }
    if (o.mode === 'two') {
      const { max, min } = lineSet(o.lambda, o.d, o.phi);
      const few = max.length + min.length <= 16;
      const add = (D: number, anti: boolean) => {
        const pts = hyperbola(D, o.d);
        if (pts.length < 2) return;
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => P(x, 2.3, z))),
          anti ? new THREE.LineBasicMaterial({ color: 0xffd479, transparent: true, opacity: 0.9, depthTest: false })
            : new THREE.LineDashedMaterial({ color: 0xff6b8a, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0.95, depthTest: false }));
        l.renderOrder = 4;
        if (!anti) l.computeLineDistances();
        this.#lines.add(l);
        if (few) {
          const end = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
          const t = label(lamText(D, o.lambda), 0.26, anti ? '#ffd479' : '#ff9ab5');
          t.position.copy(P(Math.max(-TANK.x + 1.5, Math.min(TANK.x - 1.5, end[0])), 2.5, Math.min(TANK.z - 1, end[1])));
          this.#lines.add(t);
        }
      };
      max.forEach((D) => add(D, true));
      min.forEach((D) => add(D, false));
    }
  }

  protected update() {
    const o = this.look!;
    const key = JSON.stringify([o.mode, o.lambda, o.d, o.phi, o.gap, o.obs, o.src.length, o.rmin]);
    if (key !== this.#key) { this.#key = key; this.#rebuild(o); }
    const u = this.#uni;
    // incoherent: the sources' extra phases wander (set by the component)
    if (o.mode === 'two') o.src.forEach((s, i) => { this.#srcArr[i].w = s.psi + (this.#extra[i] ?? 0); });
    u.uPh.value = this.#ph;
    u.uShade.value = o.shade === 'amp' ? 1 : 0;
    u.uFlat.value = o.shade === 'amp' ? 1 : 0;
    u.uIncoh.value = o.incoh && o.mode === 'two' ? 1 : 0;
    this.#lines.visible = o.lines && o.mode === 'two';

    // dippers bob in step with their own source
    if (o.mode === 'two') {
      o.src.forEach((s, i) => { this.#dips[i].position.y = (0.35 + 0.25 * Math.cos(this.#ph - s.psi - (this.#extra[i] ?? 0))) * S; });
    } else this.#bar.position.y = (0.25 + 0.2 * Math.cos(this.#ph)) * S;

    // probe
    const [px, pz] = o.probe;
    this.#probe.position.copy(P(px, 0, pz));
    const pa = this.#paths.geometry.attributes.position as THREE.BufferAttribute;
    if (o.mode === 'two') {
      const a = P(o.src[0].x, 1.2, o.src[0].z), b = P(px, 1.2, pz), c = P(o.src[1].x, 1.2, o.src[1].z);
      pa.setXYZ(0, a.x, a.y, a.z); pa.setXYZ(1, b.x, b.y, b.z); pa.setXYZ(2, c.x, c.y, c.z);
    } else {
      const a = P(0, 1.2, ZB), b = P(px, 1.2, pz);
      pa.setXYZ(0, a.x, a.y, a.z); pa.setXYZ(1, b.x, b.y, b.z); pa.setXYZ(2, b.x, b.y, b.z);
    }
    pa.needsUpdate = true;
    this.#paths.visible = o.mode === 'two' || pz > ZB;
    this.#ahead.visible = o.mode !== 'two' && pz > ZB;

    // Huygens: wavelets from points across the gap, and their envelope (the new wavefront)
    const hv = o.huygens && o.mode === 'gap';
    this.#wavelets.visible = this.#envelope.visible = hv;
    if (hv) {
      const k = (2 * Math.PI) / o.lambda;
      let r0 = ((this.#ph - k * (ZB - Z0) + Math.PI / 4) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) / k;
      if (r0 < 0.05) r0 += o.lambda;
      const M = Math.max(3, Math.min(9, Math.round((o.gap / o.lambda) * 2) + 1));
      const wp = this.#wavelets.geometry.attributes.position as THREE.BufferAttribute;
      let n = 0;
      const y = 1.0;
      for (let m = 0; m < M; m++) {
        const cx = -o.gap / 2 + (o.gap * m) / (M - 1);
        for (let j = 0; j < 3; j++) {
          const r = r0 + j * o.lambda;
          for (let s = 0; s < 32; s++) {
            const a1 = -Math.PI / 2 + (Math.PI * s) / 32, a2 = -Math.PI / 2 + (Math.PI * (s + 1)) / 32;
            const p1 = P(cx + r * Math.sin(a1), y, ZB + r * Math.cos(a1)), p2 = P(cx + r * Math.sin(a2), y, ZB + r * Math.cos(a2));
            wp.setXYZ(n++, p1.x, p1.y, p1.z); wp.setXYZ(n++, p2.x, p2.y, p2.z);
          }
        }
      }
      this.#wavelets.geometry.setDrawRange(0, n);
      wp.needsUpdate = true;
      const ep = this.#envelope.geometry.attributes.position as THREE.BufferAttribute;
      n = 0;
      for (let j = 0; j < 3; j++) {
        const r = r0 + j * o.lambda;
        const a = P(-o.gap / 2, y + 0.1, ZB + r), b = P(o.gap / 2, y + 0.1, ZB + r);
        ep.setXYZ(n++, a.x, a.y, a.z); ep.setXYZ(n++, b.x, b.y, b.z);
        for (const side of [-1, 1]) {
          const cx = (side * o.gap) / 2;
          for (let s = 0; s < 20; s++) {
            const a1 = (Math.PI / 2) * (s / 20), a2 = (Math.PI / 2) * ((s + 1) / 20);
            const p1 = P(cx + side * r * Math.sin(a1), y + 0.1, ZB + r * Math.cos(a1)), p2 = P(cx + side * r * Math.sin(a2), y + 0.1, ZB + r * Math.cos(a2));
            ep.setXYZ(n++, p1.x, p1.y, p1.z); ep.setXYZ(n++, p2.x, p2.y, p2.z);
          }
        }
      }
      this.#envelope.geometry.setDrawRange(0, n);
      ep.needsUpdate = true;
    }
  }

  dispose() {
    this.canvas.removeEventListener('pointerdown', this.#pd);
    this.canvas.removeEventListener('pointerup', this.#pu);
    super.dispose();
  }
}
