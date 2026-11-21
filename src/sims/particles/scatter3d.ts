/* Particle Lab: the α-scattering apparatus in 3D, and a close-up of one nucleus.

   Experiment: a radium source in a lead block sends a narrow beam of α particles at a thin gold foil inside an
   evacuated chamber (a few cm of air would stop them). Around the foil, a zinc-sulphide screen and microscope can be
   moved to any angle θ in the horizontal plane; each α that hits the screen makes a tiny flash (a scintillation),
   which Geiger and Marsden counted by eye in the dark. Here every α that reaches the sphere round the foil flashes
   where it lands. The foil is drawn as a lattice of atoms: faint electron clouds with tiny bright nuclei (not to scale:
   a real nucleus is about 1/20 000 of its atom's width). The deflections themselves are sampled in Scatter.svelte
   from Rutherford's law; this view only flies the α particles out at those angles.

   Close-up: α particles approach one nucleus at different impact parameters b and follow the Coulomb hyperbolas,
   integrated step by step (lengths in units of d, the head-on distance of closest approach, so the shapes are the
   same for every energy and target; only the nucleus's size relative to d changes). The head-on one stops at d and
   comes straight back. With the plum-pudding model the close-up shows the whole atom instead: a ball of spread-out
   positive charge with electrons in it, which barely bends any α. */

import { THREE, Stage3D, pointCloud, label, rand, gauss, fin } from './gl';

export interface SLook {
  view: 'exp' | 'zoom';
  nuclear: boolean;
  rn: number;          // nucleus radius / d
  det: number;         // microscope angle / degrees
  touch: boolean;      // the α reaches the nucleus (Coulomb law alone fails)
  playing: boolean;
  speed: number;       // flight speed multiplier
}

const RS = 5.4;        // radius of the detector sphere round the foil
const SRC = -8.6;      // x of the source
const S = 1.05;        // close-up: world units per d

interface Alpha { y: number; z: number; dir: THREE.Vector3; s: number; big: boolean }
interface Flash { p: THREE.Vector3; age: number }

/** Coulomb repulsion path for impact parameter b (units of d, α from far left at speed 1): ½v² = 0.5 at infinity, U = 0.5/r. */
function hyperbola(b: number): THREE.Vector3[] {
  let x = -13, y = b, vx = 1, vy = 0;
  const dt = 0.004, out: THREE.Vector3[] = [];
  const acc = (px: number, py: number) => { const r = Math.max(1e-3, Math.hypot(px, py)); const f = 0.5 / (r * r * r); return [f * px, f * py]; };
  let [ax, ay] = acc(x, y);
  for (let i = 0; i < 40000; i++) {
    if (i % 5 === 0) out.push(new THREE.Vector3(x * S, y * S, 0));
    vx += 0.5 * dt * ax; vy += 0.5 * dt * ay;
    x += dt * vx; y += dt * vy;
    [ax, ay] = acc(x, y);
    vx += 0.5 * dt * ax; vy += 0.5 * dt * ay;
    if (i > 100 && Math.hypot(x, y) > 13.5) break;
  }
  out.push(new THREE.Vector3(x * S, y * S, 0));
  return out;
}
const BS = [0, 0.12, -0.25, 0.42, -0.65, 0.95, -1.35, 1.9, -2.6, 3.5, -4.6];

export class ScatterScene extends Stage3D<SLook> {
  #exp = new THREE.Group();
  #zoom = new THREE.Group();
  #view: SLook['view'] | '' = '';
  #alphas: Alpha[] = [];
  #flashes: Flash[] = [];
  #fly = pointCloud(320 * 16, this.px);
  #glow = pointCloud(500, this.px);
  #scope = new THREE.Group();
  #screen = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.5, 0.45), side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  #screenHeat = 0;
  // close-up
  #paths: THREE.Vector3[][] = BS.map(hyperbola);
  #heads = pointCloud(BS.length * 18, this.px);
  #nucleus: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  #nucGlow: THREE.Sprite;
  #dring: THREE.LineLoop;
  #nuclearBits = new THREE.Group();
  #pudding = new THREE.Group();
  #straight: THREE.Line[] = [];
  #zt = 0;

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [-3.2, 7.2, 12.5], target: [-1.4, 0, 0], bloom: [0.75, 0.5, 0.62] });
    this.scene.add(new THREE.AmbientLight(0x8a92b0, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-4, 8, 6);
    this.scene.add(sun);
    this.scene.add(this.#exp, this.#zoom);
    this.#buildExperiment();
    // close-up
    const nm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.15, 0.35) });
    this.#nucleus = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), nm);
    this.#nucGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xffc860, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    const ring = Array.from({ length: 96 }, (_, i) => new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2) * S, Math.sin((i / 96) * Math.PI * 2) * S, 0));
    this.#dring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineDashedMaterial({ color: 0x9fb4ff, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.8 }));
    this.#dring.computeLineDistances();
    this.#buildCloseUp();
    this.start();
  }

  #buildExperiment() {
    const g = this.#exp;
    // lead block with the source showing through its slit
    const lead = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 1.5), new THREE.MeshStandardMaterial({ color: 0x5a6070, roughness: 0.55, metalness: 0.6 }));
    lead.position.set(SRC - 0.1, 0, 0);
    g.add(lead);
    const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.42), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.2, 0.5) }));
    slit.rotation.y = Math.PI / 2; slit.position.set(SRC + 0.71, 0, 0);
    g.add(slit);
    const src = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xffa040, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    src.position.set(SRC + 0.75, 0, 0); src.scale.setScalar(0.7);
    g.add(src);
    const l1 = label('α source (radium) in lead', 0.32); l1.position.set(SRC + 1.2, 1.25, 0); g.add(l1);

    // the foil: a thin sheet and a lattice of atoms (three layers)
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshStandardMaterial({ color: 0xd8b040, metalness: 0.9, roughness: 0.3, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    sheet.rotation.y = Math.PI / 2;
    g.add(sheet);
    const n = 19, sp = 0.22, layers = 3;
    const lat = pointCloud(n * n * layers * 2, this.px);
    let k = 0;
    for (let L = 0; L < layers; L++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = (L - 1) * 0.07, y = (i - (n - 1) / 2) * sp + (L % 2) * sp * 0.5, z = (j - (n - 1) / 2) * sp + (L % 2) * sp * 0.5;
      lat.pos.set([x, y, z], k * 3); lat.col.set([0.35, 0.45, 0.9], k * 3); lat.size[k] = 0.26; lat.alpha[k] = 0.075; k++;
      lat.pos.set([x, y, z], k * 3); lat.col.set([1.7, 1.25, 0.45], k * 3); lat.size[k] = 0.035; lat.alpha[k] = 1; k++;
    }
    lat.flush();
    g.add(lat.obj);
    const l2 = label('gold foil (atoms: nuclei not to scale)', 0.3); l2.position.set(0, 2.55, 0); g.add(l2);

    // the evacuated chamber
    const cm = new THREE.LineBasicMaterial({ color: 0x8b98c8, transparent: true, opacity: 0.22 });
    for (const y of [-2.3, 2.3]) {
      const c = Array.from({ length: 128 }, (_, i) => new THREE.Vector3(Math.cos((i / 128) * Math.PI * 2) * 6.6, y, Math.sin((i / 128) * Math.PI * 2) * 6.6));
      g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(c), cm));
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a) * 6.6, -2.3, Math.sin(a) * 6.6), new THREE.Vector3(Math.cos(a) * 6.6, 2.3, Math.sin(a) * 6.6)]), cm));
    }
    const l3 = label('evacuated chamber', 0.28, '#aab4d8'); l3.position.set(-5.2, 2.6, -3.6); g.add(l3);

    // the sphere the detector can sweep: the horizontal circle brighter (the microscope's path)
    const hm = new THREE.LineBasicMaterial({ color: 0x7fe3c4, transparent: true, opacity: 0.35 });
    const hc = Array.from({ length: 160 }, (_, i) => new THREE.Vector3(Math.cos((i / 160) * Math.PI * 2) * RS, 0, Math.sin((i / 160) * Math.PI * 2) * RS));
    g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(hc), hm));
    const fm = new THREE.LineBasicMaterial({ color: 0x7fe3c4, transparent: true, opacity: 0.09 });
    for (const a of [Math.PI / 3, (2 * Math.PI) / 3]) {
      const c = Array.from({ length: 160 }, (_, i) => { const t = (i / 160) * Math.PI * 2; return new THREE.Vector3(Math.cos(t) * RS, Math.sin(t) * RS * Math.sin(a), Math.sin(t) * RS * Math.cos(a)); });
      g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(c), fm));
    }
    for (const [deg, text] of [[0, '0°'], [90, '90°'], [180, '180°']] as const) {
      const a = (deg * Math.PI) / 180;
      const t = label(text, 0.26, '#9feccf'); t.position.set(Math.cos(a) * (RS + 0.55), -0.25, Math.sin(a) * (RS + 0.55)); g.add(t);
    }

    // the microscope and zinc-sulphide screen
    this.#scope.add(this.#screen);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 1.5, 24), new THREE.MeshStandardMaterial({ color: 0x9aa3b8, metalness: 0.8, roughness: 0.3 }));
    tube.rotation.x = Math.PI / 2; tube.position.z = 0.78;
    this.#scope.add(tube);
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 24), new THREE.MeshStandardMaterial({ color: 0x30343f, metalness: 0.5, roughness: 0.5 }));
    eye.rotation.x = Math.PI / 2; eye.position.z = 1.6;
    this.#scope.add(eye);
    const l4 = label('ZnS screen + microscope', 0.28, '#9feccf'); l4.position.set(-0.9, 0.85, 0.6);
    this.#scope.add(l4);
    g.add(this.#scope);

    g.add(this.#fly.obj, this.#glow.obj);
  }

  #buildCloseUp() {
    const z = this.#zoom;
    // nuclear atom: nucleus, closest-approach ring, the hyperbolas
    this.#nuclearBits.add(this.#nucleus, this.#nucGlow, this.#dring);
    const pm = new THREE.LineBasicMaterial({ color: 0xffa860, transparent: true, opacity: 0.28 });
    for (const p of this.#paths) this.#nuclearBits.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), pm));
    const ln = label('nucleus (+Ze)', 0.36, '#ffd890'); ln.position.set(0.2, -1.6, 0); this.#nuclearBits.add(ln);
    const ld = label('d: a head-on α stops here, then turns back', 0.3, '#b9c8ff'); ld.position.set(1.0, 1.55, 0); this.#nuclearBits.add(ld);
    // the impact parameter of one path
    const bi = 3, bx = -9.5 * S;
    const bm = new THREE.LineBasicMaterial({ color: 0xdfe6ff, transparent: true, opacity: 0.7 });
    this.#nuclearBits.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(bx, 0, 0), new THREE.Vector3(bx, BS[bi] * S, 0)]), bm));
    const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-13 * S, 0, 0), new THREE.Vector3(0, 0, 0)]), new THREE.LineDashedMaterial({ color: 0xdfe6ff, dashSize: 0.2, gapSize: 0.15, transparent: true, opacity: 0.35 }));
    axis.computeLineDistances();
    this.#nuclearBits.add(axis);
    const lb = label('b (impact parameter)', 0.3); lb.position.set(bx - 0.2, BS[bi] * S + 0.45, 0); this.#nuclearBits.add(lb);
    z.add(this.#nuclearBits);

    // plum pudding: a big ball of positive charge with electrons in it; the α go almost straight through
    const ball = new THREE.Mesh(new THREE.SphereGeometry(5.2, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.35, 0.55), transparent: true, opacity: 0.14, depthWrite: false }));
    this.#pudding.add(ball);
    const pc = pointCloud(400, this.px);
    for (let i = 0; i < 400; i++) {
      const r = 5.1 * Math.cbrt(rand()), [x, y, w] = [gauss(), gauss(), gauss()], m = Math.hypot(x, y, w) || 1;
      pc.pos.set([(x / m) * r, (y / m) * r, (w / m) * r], i * 3);
      const e = i < 22;
      pc.col.set(e ? [0.5, 0.75, 1.6] : [1.2, 0.45, 0.7], i * 3);
      pc.size[i] = e ? 0.2 : 0.5; pc.alpha[i] = e ? 1 : 0.12;
    }
    pc.flush();
    this.#pudding.add(pc.obj);
    const sm = new THREE.LineBasicMaterial({ color: 0xffa860, transparent: true, opacity: 0.28 });
    for (const b of BS) {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-13 * S, b * 1.05, 0), new THREE.Vector3(13 * S, b * 1.05 + b * 0.004, 0)]), sm);
      this.#straight.push(l); this.#pudding.add(l);
    }
    const lp = label('plum-pudding atom: + charge spread out, electrons in it', 0.32, '#ffc0d8'); lp.position.set(0, 6.1, 0); this.#pudding.add(lp);
    z.add(this.#pudding);
    z.add(this.#heads.obj);
  }

  /** Launch α particles with these deflections (radians). big: drawn because it was deflected a lot. */
  fire(thetas: { th: number; big: boolean }[]) {
    for (const { th, big } of thetas) {
      if (this.#alphas.length >= 320) this.#alphas.shift();
      const ph = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 0.16, a = rand() * Math.PI * 2;
      const t = fin(th);
      this.#alphas.push({ y: r * Math.cos(a), z: r * Math.sin(a), dir: new THREE.Vector3(Math.cos(t), Math.sin(t) * Math.cos(ph), Math.sin(t) * Math.sin(ph)), s: 0, big });
    }
    this.kick();
  }
  clear() { this.#alphas = []; this.#flashes = []; }

  protected update(dt: number) {
    const L = this.look!;
    if (L.view !== this.#view) {
      this.#view = L.view;
      if (L.view === 'exp') this.setHome([-3.2, 7.2, 12.5], [-1.4, 0, 0]);
      else this.setHome([0.5, 4.5, 17], [-1.5, 0, 0]);
    }
    this.#exp.visible = L.view === 'exp';
    this.#zoom.visible = L.view === 'zoom';
    const mdt = L.playing ? dt * L.speed : 0;

    // the microscope
    const th = (L.det * Math.PI) / 180;
    this.#scope.position.set(Math.cos(th) * RS, 0, Math.sin(th) * RS);
    this.#scope.lookAt(Math.cos(th) * 20, 0, Math.sin(th) * 20);
    this.#screenHeat = Math.max(0, this.#screenHeat - dt * 1.6);
    const h = this.#screenHeat;
    this.#screen.material.color.setRGB(0.25 + 1.6 * h, 0.5 + 2.2 * h, 0.45 + 1.8 * h);

    if (L.view === 'exp') this.#updateExp(mdt, dt);
    else this.#updateZoom(mdt, L);
  }

  #updateExp(mdt: number, dt: number) {
    const L0 = -SRC - 0.75;
    const speed = 7.5;
    const f = this.#fly;
    let k = 0;
    const keep: Alpha[] = [];
    const tmp = new THREE.Vector3();
    const sp = new THREE.Vector3(this.#scope.position.x, 0, this.#scope.position.z);
    for (const a of this.#alphas) {
      a.s += mdt * speed;
      const out = a.s - L0;
      if (out > RS) {
        const p = new THREE.Vector3(0, a.y, a.z).addScaledVector(a.dir, RS);
        if (this.#flashes.length > 480) this.#flashes.shift();
        this.#flashes.push({ p, age: 0 });
        if (p.distanceTo(sp) < 0.6) this.#screenHeat = 1;
        continue;
      }
      keep.push(a);
      for (let j = 0; j < 15; j++) {
        const s = a.s - j * 0.13;
        if (s < 0) break;
        if (s < L0) tmp.set(SRC + 0.75 + s, a.y, a.z);
        else tmp.set(0, a.y, a.z).addScaledVector(a.dir, s - L0);
        const fade = 1 - j / 15;
        f.pos.set([tmp.x, tmp.y, tmp.z], k * 3);
        f.col.set(a.big && s > L0 ? [1.6, 0.75, 0.3] : [1.25, 0.62, 0.28], k * 3);
        f.size[k] = (j === 0 ? 0.16 : 0.1) * (0.4 + 0.6 * fade);
        f.alpha[k] = (j === 0 ? 1 : 0.55) * fade;
        k++;
      }
    }
    this.#alphas = keep;
    f.flush(k);
    // scintillations
    const g = this.#glow;
    let m = 0;
    this.#flashes = this.#flashes.filter((x) => (x.age += dt) < 1.4);
    for (const x of this.#flashes) {
      const life = 1 - x.age / 1.4;
      g.pos.set([x.p.x, x.p.y, x.p.z], m * 3);
      g.col.set([0.7, 1.7, 1.25], m * 3);
      g.size[m] = 0.24 + 0.3 * (1 - life);
      g.alpha[m] = life * life;
      m++;
    }
    g.flush(m);
  }

  #updateZoom(mdt: number, L: SLook) {
    this.#nuclearBits.visible = L.nuclear;
    this.#pudding.visible = !L.nuclear;
    const rn = Math.max(0.03, fin(L.rn, 0.2)) * S;
    this.#nucleus.scale.setScalar(rn);
    this.#nucleus.material.color.setRGB(L.touch ? 1.8 : 1.6, L.touch ? 0.7 : 1.15, L.touch ? 0.35 : 0.35);
    this.#nucGlow.scale.setScalar(rn * 7 + 0.9);
    this.#zt += mdt * 2.2;
    const hd = this.#heads;
    let k = 0;
    for (let i = 0; i < BS.length; i++) {
      const path = L.nuclear ? this.#paths[i] : null;
      const len = path ? path.length : 2;
      // stagger the starts; each run lasts its path (index steps are equal times)
      const steps = path ? len : 1300;
      const tt = (this.#zt * 50 + i * 137) % (steps + 220);
      for (let j = 0; j < 18; j++) {
        const idx = Math.floor(tt - j * 4);
        if (idx < 0 || idx >= steps) continue;
        let p: THREE.Vector3;
        if (path) p = path[idx];
        else { const u = idx / steps; p = new THREE.Vector3((-13 + 26 * u) * S, BS[i] * 1.05 + BS[i] * 0.004 * u, 0); }
        const fade = 1 - j / 18;
        hd.pos.set([p.x, p.y, p.z], k * 3);
        hd.col.set([1.4, 0.7, 0.3], k * 3);
        hd.size[k] = (j === 0 ? 0.22 : 0.13) * (0.4 + 0.6 * fade);
        hd.alpha[k] = (j === 0 ? 1 : 0.5) * fade;
        k++;
      }
    }
    hd.flush(k);
  }
}
