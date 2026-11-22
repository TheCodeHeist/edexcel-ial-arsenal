/* Waves Lab, Light tab: the 3D views.

   Refraction: an optics bench seen from above at an angle. A ray box (or an underwater lamp) sends a ray at the chosen
   block; every branch the tracer finds is drawn as a glowing beam whose brightness is its share of the light, with
   dashed normals and the angles at each interface on the main path. Wave crests ride along the main path at a speed
   proportional to 1/n, so they bunch up inside the block: the frequency stays the same, the speed and the wavelength
   both drop by the factor n.

   Polarisation: light travels along the bench through two Polaroid filters. The electric field is drawn as arrows
   from the axis. Unpolarised light is a stream of short wave trains, each vibrating in its own random plane; behind
   the polariser only the component along its transmission axis is left (one plane: plane-polarised), and behind the
   analyser only the component of that along the analyser's axis. Radio from a vertical aerial is already polarised;
   sound is longitudinal, so filters cannot select a plane and it is drawn as air layers moving back and forth.

   Intensity: a lamp radiating in all directions, its wavefronts spreading over spheres of area 4πr², and a detector
   panel; or a laser whose beam keeps the same area. */

import { THREE, Stage3D, pointCloud, label, fin } from '../particles/gl';
import { trace, type Setup, type Trace, type V2, RECT, SEMI_R, PRISM, CORE, CLAD, TANK, LAMP } from './light';
import { lambdaRGB } from './consts';

export type LMode = 'refract' | 'polar' | 'intensity';
export interface LLook {
  mode: LMode;
  setup: Setup;
  white: boolean;
  src: 'light' | 'radio' | 'sound';
  pol: boolean; ana: boolean; polA: number; anaA: number;
  lamp: 'bulb' | 'laser'; r: number;
  playing: boolean;
}

const S = 0.5;                  // world units per cm on the bench
const BH = 0.55;                // beam height above the bench
const W2 = (p: V2, y = BH) => new THREE.Vector3(p[0] * S, y, -p[1] * S);
const WAVES = [410, 450, 490, 530, 570, 610, 650];

export class LightScene extends Stage3D<LLook> {
  #refract = new THREE.Group();
  #polar = new THREE.Group();
  #inten = new THREE.Group();
  #mode = '';
  #key = '';
  // refraction
  #blocks = new THREE.Group();
  #beams = new THREE.Group();
  #marks = new THREE.Group();
  #box = new THREE.Group();
  #crests = pointCloud(600, this.px);
  #path: { a: THREE.Vector3; b: THREE.Vector3; len: number; n: number }[] = [];
  #pathT = 0;
  #cyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  #t = 0;
  // polarisation
  #evec: THREE.LineSegments;
  #etips = pointCloud(400, this.px);
  #filters: THREE.Group[] = [];
  #screen: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  #screenGlow: THREE.Sprite;
  // intensity
  #shells: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = [];
  #panel = new THREE.Group();
  #cone: THREE.LineSegments;
  #laser: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  #bulb: THREE.Group = new THREE.Group();
  #panelGlow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [0, 11, 8.5], target: [0, 0, 0.3], bloom: [0.85, 0.5, 0.5] });
    this.scene.add(new THREE.AmbientLight(0x9aa2c0, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-4, 9, 5);
    this.scene.add(sun);
    this.scene.add(this.#refract, this.#polar, this.#inten);
    this.#buildBench();
    const ev = new THREE.BufferGeometry();
    ev.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 6), 3));
    ev.setAttribute('color', new THREE.BufferAttribute(new Float32Array(400 * 6), 3));
    this.#evec = new THREE.LineSegments(ev, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }));
    this.#evec.frustumCulled = false;
    this.#screen = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ color: 0x222633, side: THREE.DoubleSide }));
    this.#screenGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xfff2c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.#buildPolar();
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
    this.#cone = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.35 }));
    this.#laser = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.25, 0.2), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.#panelGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.#buildIntensity();
    this.start();
  }

  /* ---------- refraction ---------- */
  #buildBench() {
    const g = this.#refract;
    const table = new THREE.Mesh(new THREE.BoxGeometry(17, 0.3, 11.5), new THREE.MeshStandardMaterial({ color: 0x1b1f2b, roughness: 0.9 }));
    table.position.y = -0.16;
    g.add(table);
    // a sheet of paper with a faint grid, as on a real ray-tracing bench
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(15.4, 10.2), new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 1 }));
    paper.rotation.x = -Math.PI / 2; paper.position.y = 0.001;
    g.add(paper);
    const gp: number[] = [];
    for (let x = -7.5; x <= 7.51; x += 0.5) gp.push(x, 0.004, -5, x, 0.004, 5);
    for (let z = -5; z <= 5.01; z += 0.5) gp.push(-7.5, 0.004, z, 7.5, 0.004, z);
    const grid = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)), new THREE.LineBasicMaterial({ color: 0x5a6788, transparent: true, opacity: 0.22 }));
    g.add(grid);
    g.add(this.#blocks, this.#beams, this.#marks, this.#box, this.#crests.obj);
    // the ray box
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.75, 0.9), new THREE.MeshStandardMaterial({ color: 0x3a4152, metalness: 0.5, roughness: 0.45 }));
    body.position.set(-0.75, 0.4, 0);
    const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.3, 1.8) }));
    slit.rotation.y = Math.PI / 2; slit.position.set(0.005, BH, 0);
    this.#box.add(body, slit);
  }

  #blockMesh(shape: THREE.Shape, h: number, color: number, opacity: number, y0 = 0) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 48 });
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.1, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = y0;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.55 }));
    edges.rotation.x = -Math.PI / 2; edges.position.y = y0;
    return [mesh, edges];
  }
  #clear(g: THREE.Group) {
    for (const o of [...g.children]) {
      g.remove(o);
      o.traverse((x) => {
        const m = x as THREE.Mesh;
        if (m.geometry && m.geometry !== this.#cyl) m.geometry.dispose();
        const mat = m.material as THREE.Material | undefined;
        if (mat) { (mat as THREE.SpriteMaterial).map?.dispose(); mat.dispose(); }
      });
    }
  }

  #rebuild(L: LLook) {
    const s = L.setup;
    // blocks
    this.#clear(this.#blocks);
    const tint = s.n > 2 ? 0xd8f0ff : s.shape === 'tank' || s.n < 1.4 ? 0x4aa0ff : 0x9fd8ff;
    const sh = (pts: V2[]) => { const x = new THREE.Shape(); pts.forEach(([a, b], i) => (i ? x.lineTo(a * S, b * S) : x.moveTo(a * S, b * S))); x.closePath(); return x; };
    if (s.shape === 'rect') this.#blocks.add(...this.#blockMesh(sh(RECT), 1.1, tint, 0.2));
    else if (s.shape === 'prism') this.#blocks.add(...this.#blockMesh(sh(PRISM), 1.1, tint, 0.2));
    else if (s.shape === 'semi') {
      const x = new THREE.Shape(); x.moveTo(-SEMI_R * S, 0); x.lineTo(SEMI_R * S, 0); x.absarc(0, 0, SEMI_R * S, 0, -Math.PI, true); x.closePath();
      this.#blocks.add(...this.#blockMesh(x, 1.1, tint, 0.2));
    } else if (s.shape === 'fibre') {
      this.#blocks.add(...this.#blockMesh(sh([[CORE.x0, -CLAD], [CORE.x1, -CLAD], [CORE.x1, CLAD], [CORE.x0, CLAD]]), 1.1, 0x7fa6c8, 0.1));
      this.#blocks.add(...this.#blockMesh(sh([[CORE.x0, -CORE.h], [CORE.x1, -CORE.h], [CORE.x1, CORE.h], [CORE.x0, CORE.h]]), 1.1, tint, 0.22));
      const l1 = label('core', 0.3, '#bfe6ff'); l1.position.copy(W2([CORE.x0 + 2.2, 0], 1.55)); this.#blocks.add(l1);
      const l2 = label('cladding (lower n)', 0.28, '#9fb8d0'); l2.position.copy(W2([CORE.x0 + 6.4, -CLAD - 0.9], 0.3)); this.#blocks.add(l2);
    } else {
      this.#blocks.add(...this.#blockMesh(sh([[TANK.x0, TANK.y0], [TANK.x1, TANK.y0], [TANK.x1, TANK.y1], [TANK.x0, TANK.y1]]), 1.1, 0x3a8cff, 0.22));
      const l = label('water surface', 0.28, '#a8d4ff'); l.position.copy(W2([TANK.x1 - 2.4, TANK.y1 + 0.8], 0.4)); this.#blocks.add(l);
    }
    // the ray box (or the lamp in the tank)
    const tr = trace(s);
    const p0 = W2(tr.ray.p, 0), d = new THREE.Vector3(tr.ray.d[0], 0, -tr.ray.d[1]);
    this.#box.visible = s.shape !== 'tank';
    this.#box.position.copy(p0);
    this.#box.rotation.set(0, Math.atan2(-d.z, d.x), 0);
    if (s.shape === 'tank') {
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xfff0c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      lamp.position.copy(W2(LAMP)); lamp.scale.setScalar(1.1); this.#blocks.add(lamp);
      const ll = label('lamp under water', 0.28, '#ffe8b0'); ll.position.copy(W2([LAMP[0], LAMP[1] - 0.9], 0.9)); this.#blocks.add(ll);
    }
    // beams
    this.#clear(this.#beams);
    const traces: Trace[] = L.white ? WAVES.map((nm) => trace(s, nm)) : [tr];
    const rad = this.small ? 0.04 : 0.03;
    for (const t of traces) for (const sg of t.segs) {
      const a = W2(sg.a), b = W2(sg.b), len = a.distanceTo(b);
      if (len < 1e-4) continue;
      const [r, gg, bb] = L.white ? lambdaRGB(sg.nm) : [1, 0.86, 0.55];
      const k = L.white ? 1.3 : 1.25;
      const m = new THREE.Mesh(this.#cyl, new THREE.MeshBasicMaterial({ color: new THREE.Color(r * k, gg * k, bb * k), transparent: true, opacity: Math.min(1, 0.08 + Math.sqrt(sg.I) * (L.white ? 0.55 : 0.6)), blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.scale.set(rad * (0.5 + 0.5 * Math.sqrt(sg.I)), len, rad * (0.5 + 0.5 * Math.sqrt(sg.I)));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      this.#beams.add(m);
    }
    // normals and angles on the main path
    this.#clear(this.#marks);
    const dm = new THREE.LineDashedMaterial({ color: 0xdfe6ff, dashSize: 0.12, gapSize: 0.09, transparent: true, opacity: 0.75 });
    tr.hits.slice(0, s.shape === 'fibre' ? 3 : 4).forEach((h, i) => {
      const p = W2(h.p), n = new THREE.Vector3(h.nrm[0], 0, -h.nrm[1]);
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p.clone().addScaledVector(n, 1.3), p.clone().addScaledVector(n, -1.3)]), i ? dm.clone() : dm);
      ln.computeLineDistances();
      this.#marks.add(ln);
      if (h.i < 0.5 && !h.tir) return;
      const tx = `${h.i.toFixed(1)}°${h.tir ? ' TIR' : h.t !== null ? ` → ${h.t.toFixed(1)}°` : ''}`;
      const lb = label(tx, 0.26, h.tir ? '#ffd58a' : '#dfe6ff');
      lb.position.copy(p).addScaledVector(n, 0.9).add(new THREE.Vector3(0, 0.75, 0));
      this.#marks.add(lb);
    });
    // the main path, for the crests
    this.#path = [];
    const main = tr.segs.filter((x) => x.main);
    let cur: V2 = tr.ray.p;
    for (let guard = 0; guard < 80; guard++) {
      const nx = main.find((x) => Math.hypot(x.a[0] - cur[0], x.a[1] - cur[1]) < 1e-6);
      if (!nx) break;
      const a = W2(nx.a, BH + 0.002), b = W2(nx.b, BH + 0.002);
      this.#path.push({ a, b, len: a.distanceTo(b), n: nx.n });
      cur = nx.b;
      main.splice(main.indexOf(nx), 1);
    }
    this.#pathT = this.#path.reduce((t, x) => t + x.len * x.n, 0);
  }

  #crestsUpdate(dt: number, playing: boolean) {
    if (playing) this.#t += dt;
    const c = this.#crests;
    let k = 0;
    const T = this.#pathT;
    if (T > 0) {
      const gap = 0.42, speed = 2.4;                  // optical-path spacing of the crests, and their speed in air
      const off = ((this.#t * speed) % gap + gap) % gap;
      const tmp = new THREE.Vector3();
      for (let tau = off; tau < T && k < c.n; tau += gap) {
        let acc = 0;
        for (const sg of this.#path) {
          const dtau = sg.len * sg.n;
          if (tau <= acc + dtau) {
            tmp.copy(sg.a).lerp(sg.b, (tau - acc) / dtau);
            c.pos.set([tmp.x, tmp.y, tmp.z], k * 3);
            c.col.set(sg.n > 1.01 ? [0.6, 1.4, 2.4] : [2.2, 1.9, 1.3], k * 3);
            c.size[k] = 0.2; c.alpha[k] = 1;
            k++;
            break;
          }
          acc += dtau;
        }
      }
    }
    c.flush(k);
  }

  /* ---------- polarisation ---------- */
  #filter(name: string) {
    const f = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.08, 12, 64), new THREE.MeshStandardMaterial({ color: 0x40475a, metalness: 0.6, roughness: 0.4 }));
    ring.rotation.y = Math.PI / 2;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), new THREE.MeshBasicMaterial({ color: 0x5a4a8a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    disc.rotation.y = Math.PI / 2;
    const axis = new THREE.Group();       // rotates about x: lines along the transmission axis, and an arrow
    const lp: number[] = [];
    for (let i = -6; i <= 6; i++) { const z = i * 0.22, h = Math.sqrt(Math.max(0, 1.48 * 1.48 - z * z)); lp.push(0, -h, z, 0, h, z); }
    axis.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)), new THREE.LineBasicMaterial({ color: 0xb9a8ff, transparent: true, opacity: 0.45 })));
    const arrowM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 2.2) });
    for (const sgn of [1, -1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 16), arrowM);
      cone.position.set(0, sgn * 1.9, 0); cone.rotation.z = sgn > 0 ? 0 : Math.PI;
      axis.add(cone);
    }
    axis.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.85, 0), new THREE.Vector3(0, 1.85, 0)]), new THREE.LineBasicMaterial({ color: 0xd8ccff })));
    axis.name = 'axis';
    const l = label(name, 0.3, '#d8ccff'); l.position.set(0, 2.55, 0);
    f.add(ring, disc, axis, l);
    return f;
  }
  #buildPolar() {
    const g = this.#polar;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(18, 0.25, 2.4), new THREE.MeshStandardMaterial({ color: 0x1b1f2b, roughness: 0.9 }));
    bench.position.y = -2.1; g.add(bench);
    const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-8.2, 0, 0), new THREE.Vector3(8, 0, 0)]), new THREE.LineDashedMaterial({ color: 0x8b98c8, dashSize: 0.2, gapSize: 0.15, transparent: true, opacity: 0.5 }));
    axis.computeLineDistances(); g.add(axis);
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xfff0c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    lamp.position.set(-8.4, 0, 0); lamp.scale.setScalar(1.8); lamp.name = 'lamp'; g.add(lamp);
    const p = this.#filter('polariser'); p.position.x = -2.6;
    const a = this.#filter('analyser'); a.position.x = 2.6;
    this.#filters = [p, a];
    g.add(p, a);
    this.#screen.position.x = 8.2; this.#screen.rotation.y = -Math.PI / 2;
    this.#screenGlow.position.set(8.1, 0, 0);
    g.add(this.#screen, this.#screenGlow, this.#evec, this.#etips.obj);
    const ls = label('screen', 0.3, '#c9d0e6'); ls.position.set(8.2, 2.25, 0); g.add(ls);
  }

  #polarUpdate(L: LLook, dt: number) {
    if (L.playing) this.#t += dt;
    const [pf, af] = this.#filters;
    pf.visible = L.pol; af.visible = L.ana;
    const pa = (L.polA * Math.PI) / 180, aa = (L.anaA * Math.PI) / 180;
    (pf.getObjectByName('axis') as THREE.Object3D).rotation.x = -pa;
    (af.getObjectByName('axis') as THREE.Object3D).rotation.x = -aa;
    const lamp = this.#polar.getObjectByName('lamp') as THREE.Sprite;
    (lamp.material as THREE.SpriteMaterial).color.set(L.src === 'light' ? 0xfff0c0 : L.src === 'radio' ? 0x9fd0ff : 0xa0ffcf);
    const pos = this.#evec.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = this.#evec.geometry.getAttribute('color') as THREE.BufferAttribute;
    const tip = this.#etips;
    const N = 150, x0 = -7.8, x1 = 7.9, k = 2.6, w = 6.5, Lt = 1.25, A = 1.25;
    const xP = -2.6, xA = 2.6;
    const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    const ct = this.#t * (w / k);    // the pattern moves at w/k
    let m = 0;
    for (let i = 0; i < N; i++) {
      const x = x0 + ((x1 - x0) * i) / (N - 1);
      const ph = k * x - w * this.#t;
      let amp = A, ang = 0, along = false;
      if (L.src === 'sound') { along = true; amp = 0.28; }
      else if (L.src === 'radio') ang = 0;
      else ang = hash(Math.floor((x - ct) / Lt)) * Math.PI;                       // each wave train its own plane
      if (!along) {
        if (L.pol && x > xP) { amp *= Math.cos(ang - pa); ang = pa; }
        if (L.ana && x > xA) { amp *= Math.cos(ang - aa); ang = aa; }
      }
      const e = amp * Math.cos(ph);
      const base = new THREE.Vector3(x, 0, 0);
      const vec = along ? new THREE.Vector3(e, 0, 0) : new THREE.Vector3(0, Math.cos(ang) * e, -Math.sin(ang) * e);
      const [r, gg, b] = L.src === 'light' ? [1.0, 0.85, 0.45] : L.src === 'radio' ? [0.45, 0.75, 1.0] : [0.45, 1.0, 0.75];
      if (along) {
        // air layers: short vertical bars displaced along x
        const xb = x + e;
        pos.setXYZ(m * 2, xb, -0.9, 0); pos.setXYZ(m * 2 + 1, xb, 0.9, 0);
        const c = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(ph));
        col.setXYZ(m * 2, r * c, gg * c, b * c); col.setXYZ(m * 2 + 1, r * c, gg * c, b * c);
        tip.pos.set([xb, 0, 0], m * 3); tip.alpha[m] = 0;
      } else {
        const t = base.clone().add(vec);
        pos.setXYZ(m * 2, x, 0, 0); pos.setXYZ(m * 2 + 1, t.x, t.y, t.z);
        col.setXYZ(m * 2, r * 0.3, gg * 0.3, b * 0.3); col.setXYZ(m * 2 + 1, r, gg, b);
        tip.pos.set([t.x, t.y, t.z], m * 3); tip.alpha[m] = Math.min(1, Math.abs(e) * 1.2);
      }
      tip.col.set([r * 1.5, gg * 1.5, b * 1.5], m * 3); tip.size[m] = 0.09;
      m++;
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    this.#evec.geometry.setDrawRange(0, m * 2);
    tip.flush(m);
    const I = transmitted(L);
    const c = L.src === 'light' ? [1, 0.93, 0.7] : L.src === 'radio' ? [0.55, 0.8, 1] : [0.55, 1, 0.8];
    this.#screen.material.color.setRGB(0.13 + c[0] * 0.9 * I, 0.15 + c[1] * 0.9 * I, 0.2 + c[2] * 0.9 * I);
    this.#screenGlow.material.opacity = 0.9 * I;
    this.#screenGlow.scale.setScalar(2 + 3 * I);
  }

  /* ---------- intensity ---------- */
  #buildIntensity() {
    const g = this.#inten;
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.1, 1.4) }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xffe4a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(2.6);
    this.#bulb.add(glass, halo);
    g.add(this.#bulb);
    for (let i = 0; i < 5; i++) {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), new THREE.MeshBasicMaterial({ color: 0xffd890, wireframe: true, transparent: true, opacity: 0.08, depthWrite: false }));
      this.#shells.push(sh); g.add(sh);
    }
    // the detector: a 1 m² panel facing the lamp
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.08, 1.08), new THREE.MeshStandardMaterial({ color: 0x2c3448, metalness: 0.4, roughness: 0.5 }));
    this.#panelGlow.rotation.y = Math.PI / 2; this.#panelGlow.position.x = -0.04;
    const lp = label('detector, area A', 0.28, '#dfe6ff'); lp.position.set(0, 0.95, 0);
    this.#panel.add(frame, this.#panelGlow, lp);
    g.add(this.#panel, this.#cone, this.#laser);
    const floor = new THREE.GridHelper(20, 20, 0x3a4560, 0x232a3a);
    floor.position.y = -2.2; g.add(floor);
  }
  #intenUpdate(L: LLook, dt: number) {
    if (L.playing) this.#t += dt;
    const M = 1.4;                       // world units per metre
    const r = Math.max(0.3, fin(L.r, 2)) * M;
    const laser = L.lamp === 'laser';
    this.#panel.position.set(r, 0, 0);
    const side = 1.0;                    // panel is 1 m² → but drawn as 1 world unit: shown, not to scale with M
    const pos = this.#cone.geometry.getAttribute('position') as THREE.BufferAttribute;
    const corners = [[side / 2, side / 2], [side / 2, -side / 2], [-side / 2, -side / 2], [-side / 2, side / 2]];
    corners.forEach(([y, z], i) => { pos.setXYZ(i * 2, 0, 0, 0); pos.setXYZ(i * 2 + 1, r, y, z); });
    pos.needsUpdate = true;
    this.#cone.visible = !laser;
    this.#laser.visible = laser;
    this.#laser.scale.set(1, r, 1); this.#laser.position.set(r / 2, 0, 0); this.#laser.rotation.z = Math.PI / 2;
    (this.#bulb.children[1] as THREE.Sprite).material.color.set(laser ? 0xff6050 : 0xffe4a0);
    (this.#bulb.children[0] as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>).material.color.set(laser ? new THREE.Color(2.4, 0.5, 0.4) : new THREE.Color(2.4, 2.1, 1.4));
    const rmax = 6.8;
    this.#shells.forEach((s, i) => {
      s.visible = !laser;
      const rr = (((this.#t * 1.1 + (i * rmax) / this.#shells.length) % rmax) + rmax) % rmax + 0.2;
      s.scale.setScalar(rr);
      // fade in as a shell leaves the bulb and out as it reaches the edge, so the cycle never pops: a tiny new
      // wireframe sphere is a dense knot of lines, and at full opacity the bloom made it flash every lap
      // x must stay ≤ 1: rr runs up to rmax + 0.2, and (negative)^1.5 is NaN, which the bloom pass smears over the
      // whole frame (that was the blink: one black frame each time a shell reached the edge)
      const birth = Math.min(1, Math.max(0, (rr - 0.35) / 1.4)), x = Math.min(1, rr / rmax);
      s.material.opacity = 0.11 * birth * birth * (3 - 2 * birth) * (1 - x) ** 1.5;
    });
    const I = laser ? 1 : Math.min(1, (1.4 / r) ** 2);
    this.#panelGlow.material.color.set(laser ? 0xff8070 : 0xffe9b0);
    this.#panelGlow.material.opacity = 0.08 + 0.85 * I;
  }

  set(look: LLook) {
    super.set(look);
    if (look.mode === 'refract') {
      const k = JSON.stringify([look.setup, look.white]);
      if (k !== this.#key) { this.#key = k; this.#rebuild(look); }
    }
  }

  /** Go to a camera home, standing further back on a phone's narrow view. */
  #home(cam: [number, number, number], tgt: [number, number, number]) {
    const k = this.small ? 1.35 : 1;
    this.setHome([tgt[0] + (cam[0] - tgt[0]) * k, tgt[1] + (cam[1] - tgt[1]) * k, tgt[2] + (cam[2] - tgt[2]) * k], tgt);
  }

  protected update(dt: number) {
    const L = this.look!;
    const cam = L.mode === 'refract' ? `r-${L.setup.shape}` : L.mode;
    if (cam !== this.#mode) {
      this.#mode = cam;
      if (L.mode === 'polar') this.#home([-3.5, 4.2, 12.5], [0.3, 0, 0]);
      else if (L.mode === 'intensity') this.#home([3.2, 4.2, 9.5], [3.2, -0.2, 0]);
      else if (L.setup.shape === 'fibre') this.#home([0.8, 10.5, 6.5], [0.8, 0, 0]);
      else if (L.setup.shape === 'tank') this.#home([0, 9.5, 9], [0, 0, 1.0]);
      else this.#home([0, 11, 8.5], [0, 0, 0.3]);
    }
    this.#refract.visible = L.mode === 'refract';
    this.#polar.visible = L.mode === 'polar';
    this.#inten.visible = L.mode === 'intensity';
    if (L.mode === 'refract') this.#crestsUpdate(dt, L.playing);
    else if (L.mode === 'polar') this.#polarUpdate(L, dt);
    else this.#intenUpdate(L, dt);
  }
}

/** The share of the source's intensity reaching the screen (time-averaged). */
export function transmitted(L: Pick<LLook, 'src' | 'pol' | 'ana' | 'polA' | 'anaA'>) {
  if (L.src === 'sound') return 1;
  const c2 = (d: number) => Math.cos((d * Math.PI) / 180) ** 2;
  if (L.src === 'radio') {               // vertical aerial: polarised at 0°
    let I = 1, a = 0;
    if (L.pol) { I *= c2(L.polA - a); a = L.polA; }
    if (L.ana) I *= c2(L.anaA - a);
    return I;
  }
  if (L.pol && L.ana) return 0.5 * c2(L.anaA - L.polA);
  return L.pol || L.ana ? 0.5 : 1;
}
