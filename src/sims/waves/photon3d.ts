/* Waves Lab, Photons tab: three pieces of apparatus in 3D.

   Photocell: a lamp shines on a curved metal cathode inside an evacuated glass bulb; a thin anode (collector) wire
   sits at its centre of curvature. Light arrives as discrete photons (short wave packets in the light's colour). A
   photon with hf ≥ φ can free one electron, which leaves with any kinetic energy up to hf − φ and slows in the
   retarding field between cathode and anode: it reaches the anode only if its kinetic energy is more than eV. The
   field is treated as uniform across the gap, so an electron's kinetic energy falls linearly with distance.

   Electroscope: a zinc plate on a gold-leaf electroscope. Charged negatively, the leaf stands out; ultraviolet light
   frees electrons from the zinc, the plate loses charge and the leaf falls. Charged positively, freed electrons are
   pulled straight back, so nothing changes. Visible light, however bright, does nothing to zinc.

   Discharge tube: electrons accelerated along a low-pressure gas collide with atoms, exciting them; each atom then
   drops back and emits a photon of one of its line wavelengths. The light passes through a diffraction grating and
   each wavelength lands at its own angle (sin θ = λ/d) on a screen: the line spectrum builds up photon by photon. */

import { THREE, Stage3D, pointCloud, label, rand, fin } from '../particles/gl';

export interface PLine { nm: number; rgb: [number, number, number]; w: number }
export interface PLook {
  mode: 'cell' | 'scope' | 'tube';
  nm: number;                         // lamp wavelength
  rgb: [number, number, number];      // lamp colour (already dimmed for UV/IR)
  intensity: number;                  // 0–1
  emit: boolean;                      // hf ≥ φ
  ek: number;                         // max kinetic energy / eV
  V: number;                          // stopping p.d. / V
  metal: [number, number, number];    // cathode colour
  charge: number;                     // electroscope: −1…1
  lines: PLine[];                     // tube: every line (nm, colour, weight)
  glow: [number, number, number];     // tube glow colour
  playing: boolean;
  speed: number;
}

const D_GAP = 1.8;               // cathode–anode gap (world units)
const LAMP = new THREE.Vector3(-6.2, 1.4, 0);
const SCOPE_PLATE = new THREE.Vector3(0, 1.9, 0);
const SCOPE_LAMP = new THREE.Vector3(-3.4, 5.0, 0);
const GRATE_Z = 3.2, SCREEN_Z = 7.4, GRATE_D = 1.667e-6;   // 600 lines per mm

interface Photon { a: THREE.Vector3; b: THREE.Vector3; t: number; dur: number; hit: boolean; c: [number, number, number] }
interface Electron { p0: THREE.Vector3; dir: THREE.Vector3; t: number; K: number; v0: number; acc: number; done: number; back: boolean }
interface TubePhoton { a: THREE.Vector3; m: THREE.Vector3; b: THREE.Vector3; t: number; c: [number, number, number]; bar: number }

export class PhotonScene extends Stage3D<PLook> {
  #cell = new THREE.Group();
  #scope = new THREE.Group();
  #tube = new THREE.Group();
  #mode: PLook['mode'] | '' = '';
  #photons: Photon[] = [];
  #electrons: Electron[] = [];
  #pc = pointCloud(220 * 10, this.px);
  #ec = pointCloud(600 * 6, this.px);
  #flash = pointCloud(80, this.px);
  #flashes: { p: THREE.Vector3; age: number; c: [number, number, number] }[] = [];
  #lampGlow: THREE.Sprite;
  #lampGlow2: THREE.Sprite;
  #beam: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  #beam2: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  #cathode: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  #plate: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  #leaf = new THREE.Group();
  #leafMat = new THREE.MeshStandardMaterial({ color: 0xffd060, metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide, emissive: 0x332200 });
  #chargeMarks = pointCloud(40, this.px);
  #carry = 0;
  // tube
  #tubeGlow: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  #tubeAtoms = pointCloud(260, this.px);
  #tubeElec = pointCloud(90, this.px);
  #tubeElecX = Array.from({ length: 90 }, () => rand());
  #tp: TubePhoton[] = [];
  #tpc = pointCloud(260 * 4, this.px);
  #bars: { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; heat: number; nm: number }[] = [];
  #barKey = '';
  #barGroup = new THREE.Group();
  #atomFlash = pointCloud(60, this.px);
  #atomFlashes: { p: THREE.Vector3; age: number; c: [number, number, number] }[] = [];
  #tcarry = 0;
  #vcarry = 0;

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [-2.5, 4.2, 11], target: [-1.2, 0.4, 0], bloom: [0.85, 0.5, 0.55] });
    this.scene.add(new THREE.AmbientLight(0x8a92b0, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(-3, 8, 7);
    this.scene.add(sun);
    this.scene.add(this.#cell, this.#scope, this.#tube);

    const glowMat = () => new THREE.SpriteMaterial({ map: this.tex, color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
    this.#lampGlow = new THREE.Sprite(glowMat());
    this.#lampGlow2 = new THREE.Sprite(glowMat());
    const beamMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.#beam = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1, 32, 1, true), beamMat());
    this.#beam2 = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1, 32, 1, true), beamMat());
    this.#cathode = new THREE.Mesh(new THREE.CylinderGeometry(D_GAP, D_GAP, 2.4, 40, 1, true, Math.PI / 2 - Math.PI / 2.6, (2 * Math.PI) / 2.6),
      new THREE.MeshStandardMaterial({ color: 0xb0b6c8, metalness: 0.35, roughness: 0.45, side: THREE.DoubleSide, emissive: 0x1a1d26 }));
    this.#plate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 2.4), new THREE.MeshStandardMaterial({ color: 0xaab4c4, metalness: 0.35, roughness: 0.45, emissive: 0x1a1d26 }));
    this.#tubeGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 7.2, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff6a9a, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));

    this.#buildCell();
    this.#buildScope();
    this.#buildTube();
    this.start();
  }

  #lamp(g: THREE.Group, at: THREE.Vector3, to: THREE.Vector3, glow: THREE.Sprite, beam: THREE.Mesh, text: string) {
    const dir = to.clone().sub(at).normalize();
    const house = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 1.1, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a4050, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide }));
    house.position.copy(at).addScaledVector(dir, -0.35);
    house.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.add(house);
    const back = new THREE.Mesh(new THREE.CircleGeometry(0.56, 28), new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.5, roughness: 0.6, side: THREE.DoubleSide }));
    back.position.copy(at).addScaledVector(dir, -0.9);
    back.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    g.add(back);
    glow.position.copy(at);
    glow.scale.setScalar(1.6);
    g.add(glow);
    const len = at.distanceTo(to);
    beam.geometry.dispose();
    beam.geometry = new THREE.ConeGeometry(0.9, len, 32, 1, true);
    beam.position.copy(at).addScaledVector(dir, len / 2);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    g.add(beam);
    const l = label(text, 0.3); l.position.copy(at).add(new THREE.Vector3(0, 1.0, 0)); g.add(l);
  }

  #buildCell() {
    const g = this.#cell;
    // glass bulb
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(3.0, 48, 32), new THREE.MeshPhysicalMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.09, roughness: 0.05, metalness: 0, depthWrite: false, side: THREE.DoubleSide }));
    bulb.position.set(0.4, 0, 0);
    g.add(bulb);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.015, 8, 96), new THREE.MeshBasicMaterial({ color: 0x8fa6e0, transparent: true, opacity: 0.35 }));
    rim.position.set(0.4, 0, 0); rim.rotation.y = Math.PI / 2;
    g.add(rim);
    // the cathode: concave side faces the lamp (−x); centre of curvature at the anode (origin)
    this.#cathode.rotation.y = 0;
    g.add(this.#cathode);
    // anode wire
    const anode = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 12), new THREE.MeshStandardMaterial({ color: 0xffd28a, metalness: 0.9, roughness: 0.3, emissive: 0x221100 }));
    g.add(anode);
    // stem and leads
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.2, 24), new THREE.MeshStandardMaterial({ color: 0x232733, metalness: 0.3, roughness: 0.7 }));
    stem.position.set(0.4, -3.3, 0);
    g.add(stem);
    const lead = new THREE.LineBasicMaterial({ color: 0x9aa6c8, transparent: true, opacity: 0.55 });
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.3, 0), new THREE.Vector3(0, -2.8, 0)]), lead));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(D_GAP, -1.2, 0), new THREE.Vector3(0.8, -2.8, 0)]), lead));
    const la = label('anode (collector)', 0.28, '#ffd9a0'); la.position.set(-0.6, 1.65, 0); g.add(la);
    const lc = label('metal cathode', 0.28); lc.position.set(2.5, 1.55, 0.3); g.add(lc);
    const lv = label('vacuum', 0.26, '#aab4d8'); lv.position.set(1.0, -2.2, 1.6); g.add(lv);
    this.#lamp(g, LAMP, new THREE.Vector3(D_GAP * 0.95, 0, 0), this.#lampGlow, this.#beam, 'lamp');
    g.add(this.#pc.obj, this.#ec.obj, this.#flash.obj);
  }

  #buildScope() {
    const g = this.#scope;
    // case: glass-fronted box
    const box = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.0, 1.6), new THREE.MeshPhysicalMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.08, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    box.position.set(0, -0.9, 0);
    g.add(box);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: 0x8b98c8, transparent: true, opacity: 0.4 }));
    edges.position.copy(box.position);
    g.add(edges);
    // rod, insulating collar, plate
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 14), new THREE.MeshStandardMaterial({ color: 0xc9a060, metalness: 0.9, roughness: 0.3 }));
    rod.position.set(0, 0.2, 0);
    g.add(rod);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.35, 20), new THREE.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.8 }));
    collar.position.set(0, 0.6, 0);
    g.add(collar);
    this.#plate.position.copy(SCOPE_PLATE);
    g.add(this.#plate);
    // the leaf hangs from the bottom of the rod and swings out
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 1.25), this.#leafMat);
    leaf.position.set(0, -0.62, 0);
    this.#leaf.add(leaf);
    this.#leaf.position.set(0.07, -0.6, 0);
    g.add(this.#leaf);
    const lp = label('zinc plate', 0.28); lp.position.set(1.9, 2.25, 0); g.add(lp);
    const ll = label('gold leaf', 0.26, '#ffe2a0'); ll.position.set(1.4, -1.3, 0.85); g.add(ll);
    this.#lamp(g, SCOPE_LAMP, SCOPE_PLATE, this.#lampGlow2, this.#beam2, 'lamp');
    g.add(this.#chargeMarks.obj);
  }

  #buildTube() {
    const g = this.#tube;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 7.6, 40, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.1, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide }));
    glass.rotation.z = Math.PI / 2;
    g.add(glass);
    this.#tubeGlow.rotation.z = Math.PI / 2;
    g.add(this.#tubeGlow);
    for (const x of [-3.9, 3.9]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.4, 32), new THREE.MeshStandardMaterial({ color: 0x3a4050, metalness: 0.7, roughness: 0.4 }));
      cap.rotation.z = Math.PI / 2; cap.position.x = x;
      g.add(cap);
      const el = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0xd0d6e4, metalness: 0.9, roughness: 0.25 }));
      el.rotation.z = Math.PI / 2; el.position.x = x * 0.9;
      g.add(el);
    }
    const lm = label('− cathode', 0.26); lm.position.set(-3.9, 1.0, 0); g.add(lm);
    const lp = label('+ anode', 0.26); lp.position.set(3.9, 1.0, 0); g.add(lp);
    const lg = label('low-pressure gas, a few kV across it', 0.28, '#d8def4'); lg.position.set(0, 1.25, 0); g.add(lg);
    // atoms
    const A = this.#tubeAtoms;
    for (let i = 0; i < A.n; i++) {
      const r = 0.5 * Math.sqrt(rand()), a = rand() * Math.PI * 2;
      A.pos.set([-3.5 + 7 * rand(), r * Math.cos(a), r * Math.sin(a)], i * 3);
      A.col.set([0.55, 0.6, 0.8], i * 3); A.size[i] = 0.07; A.alpha[i] = 0.5;
    }
    A.flush();
    g.add(A.obj, this.#tubeElec.obj, this.#atomFlash.obj);
    // slit, grating and screen
    const slit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 0.05), new THREE.MeshStandardMaterial({ color: 0x1c2030, roughness: 0.8 }));
    slit.position.set(0, 0, 1.35);
    g.add(slit);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    sg.position.set(0, 0, 1.38);
    g.add(sg);
    const grating = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.06), new THREE.MeshPhysicalMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.25, roughness: 0.1, iridescence: 1, depthWrite: false }));
    grating.position.set(0, 0, GRATE_Z);
    g.add(grating);
    const lgr = label('diffraction grating, 600 lines/mm', 0.26, '#cfe0ff'); lgr.position.set(0, 1.15, GRATE_Z); g.add(lgr);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 2.2), new THREE.MeshStandardMaterial({ color: 0x2a3045, roughness: 0.9, emissive: 0x0c0f18 }));
    screen.position.set(0, 0, SCREEN_Z + 0.02);
    screen.rotation.y = Math.PI;
    g.add(screen);
    const ls = label('screen: first-order spectrum each side, zero order in the middle', 0.26); ls.position.set(0, 1.5, SCREEN_Z); g.add(ls);
    g.add(this.#barGroup, this.#tpc.obj);
  }

  /** Screen x of a wavelength in order n (θ from sin θ = nλ/d). */
  #screenX(nm: number, n: number) {
    const s = (n * nm * 1e-9) / GRATE_D;
    if (Math.abs(s) >= 1) return NaN;
    return (SCREEN_Z - GRATE_Z) * Math.tan(Math.asin(s));
  }

  #rebuildBars(lines: PLine[]) {
    for (const b of this.#bars) { b.mesh.geometry.dispose(); b.mesh.material.dispose(); this.#barGroup.remove(b.mesh); }
    this.#bars = [];
    const mk = (x: number, c: [number, number, number], nm: number, w: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0] * 1.8, c[1] * 1.8, c[2] * 1.8), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.position.set(x, 0, SCREEN_Z - 0.01);
      this.#barGroup.add(m);
      this.#bars.push({ mesh: m, heat: 0, nm });
    };
    mk(0, [1, 1, 1], 0, 0.09);   // zero order: every wavelength together
    for (const l of lines) {
      if (l.nm < 380 || l.nm > 750) continue;
      for (const n of [-1, 1]) { const x = this.#screenX(l.nm, n); if (Number.isFinite(x) && Math.abs(x) < 4.7) mk(x, l.rgb, l.nm * n, 0.06); }
    }
  }

  protected update(dt: number) {
    const L = this.look!;
    if (L.mode !== this.#mode) {
      this.#mode = L.mode;
      this.#photons = []; this.#electrons = []; this.#tp = [];
      if (L.mode === 'cell') this.setHome([-2.5, 4.2, 11], [-1.2, 0.4, 0]);
      else if (L.mode === 'scope') this.setHome([3.5, 3.2, 9.5], [-0.6, 0.8, 0]);
      else this.setHome([6.5, 8.0, -5.5], [0, -0.6, 4.6]);
    }
    this.#cell.visible = L.mode === 'cell';
    this.#scope.visible = L.mode === 'scope';
    this.#tube.visible = L.mode === 'tube';
    const mdt = L.playing ? dt * L.speed : 0;
    if (L.mode === 'tube') this.#updateTube(mdt, dt, L);
    else this.#updateLight(mdt, dt, L);
  }

  #updateLight(mdt: number, dt: number, L: PLook) {
    const cell = L.mode === 'cell';
    const [r, g, b] = L.rgb;
    const k = 0.25 + 0.75 * L.intensity;
    for (const s of [this.#lampGlow, this.#lampGlow2]) { s.material.color.setRGB(r * 1.6 * k, g * 1.6 * k, b * 1.6 * k); s.material.opacity = L.intensity > 0 ? 0.95 : 0.15; }
    for (const m of [this.#beam, this.#beam2]) { m.material.color.setRGB(r, g, b); m.material.opacity = 0.075 * L.intensity; }
    this.#cathode.material.color.setRGB(...L.metal);
    this.#plate.material.color.setRGB(...L.metal);
    // leaf angle
    const ang = (Math.min(1, Math.abs(fin(L.charge))) * 52 * Math.PI) / 180;
    this.#leaf.rotation.z = THREE.MathUtils.lerp(this.#leaf.rotation.z, ang, Math.min(1, dt * 6));

    // new photons
    const from = cell ? LAMP : SCOPE_LAMP;
    this.#carry += mdt * (3 + 34 * L.intensity) * (L.intensity > 0 ? 1 : 0);
    while (this.#carry >= 1) {
      this.#carry--;
      if (this.#photons.length > 200) this.#photons.shift();
      let to: THREE.Vector3;
      if (cell) { const a = (rand() - 0.5) * 1.3, y = (rand() - 0.5) * 2.0; to = new THREE.Vector3(Math.cos(a) * D_GAP, y, Math.sin(a) * D_GAP); }
      else to = SCOPE_PLATE.clone().add(new THREE.Vector3((rand() - 0.5) * 2, 0.05, (rand() - 0.5) * 2));
      const a = from.clone().add(new THREE.Vector3((rand() - 0.5) * 0.4, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.4));
      this.#photons.push({ a, b: to, t: 0, dur: a.distanceTo(to) / 7, hit: false, c: [r, g, b] });
    }
    // draw photons as short wave packets
    const P = this.#pc;
    let n = 0;
    const tmp = new THREE.Vector3(), side = new THREE.Vector3();
    const keep: Photon[] = [];
    for (const p of this.#photons) {
      p.t += mdt;
      const u = p.t / p.dur;
      if (u >= 1) { this.#absorb(p, L, cell); continue; }
      keep.push(p);
      const dir = p.b.clone().sub(p.a).normalize();
      side.crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize();
      if (side.lengthSq() < 0.1) side.set(1, 0, 0);
      for (let j = 0; j < 10; j++) {
        const s = u * p.a.distanceTo(p.b) - j * 0.06;
        if (s < 0) break;
        tmp.copy(p.a).addScaledVector(dir, s).addScaledVector(side, Math.sin(s * 22) * 0.09 * Math.sin((Math.PI * (j + 0.5)) / 10));
        P.pos.set([tmp.x, tmp.y, tmp.z], n * 3);
        P.col.set([p.c[0] * 1.5, p.c[1] * 1.5, p.c[2] * 1.5], n * 3);
        P.size[n] = j === 0 ? 0.13 : 0.085; P.alpha[n] = 0.95 - j * 0.07;
        n++;
      }
    }
    this.#photons = keep;
    P.flush(n);

    // electrons
    const Ec = this.#ec;
    let m = 0;
    const out: Electron[] = [];
    for (const e of this.#electrons) {
      e.t += mdt;
      const s = e.v0 * e.t + 0.5 * e.acc * e.t * e.t;
      const lim = cell ? D_GAP - 0.05 : 9;
      if (s >= lim) { if (cell) this.#flashes.push({ p: e.p0.clone().addScaledVector(e.dir, lim), age: 0, c: [1.2, 1.6, 2.2] }); continue; }
      if (s < 0 && e.t > 0.05) continue;     // turned back and returned to the metal
      out.push(e);
      for (let j = 0; j < 6; j++) {
        const tt = Math.max(0, e.t - j * 0.035);
        const sj = Math.max(0, e.v0 * tt + 0.5 * e.acc * tt * tt);
        tmp.copy(e.p0).addScaledVector(e.dir, sj);
        Ec.pos.set([tmp.x, tmp.y, tmp.z], m * 3);
        Ec.col.set([0.45, 0.8, 1.9], m * 3);
        Ec.size[m] = j === 0 ? 0.12 : 0.07; Ec.alpha[m] = 1 - j * 0.15;
        m++;
      }
    }
    this.#electrons = out;
    Ec.flush(m);
    // collection flashes
    const F = this.#flash;
    let f = 0;
    this.#flashes = this.#flashes.filter((x) => (x.age += dt) < 0.5).slice(-80);
    for (const x of this.#flashes) {
      const life = 1 - x.age / 0.5;
      F.pos.set([x.p.x, x.p.y, x.p.z], f * 3); F.col.set(x.c, f * 3); F.size[f] = 0.25 * life + 0.05; F.alpha[f] = life; f++;
    }
    F.flush(f);
    // charges drawn on the plate (− blue, + red)
    const CM = this.#chargeMarks;
    const q = Math.round(Math.abs(fin(L.charge)) * 20);
    for (let i = 0; i < q; i++) {
      const a = (i * 2.399) % (Math.PI * 2), rr = 0.25 + 0.85 * ((i * 0.618) % 1);
      CM.pos.set([SCOPE_PLATE.x + Math.cos(a) * rr, SCOPE_PLATE.y + 0.08, SCOPE_PLATE.z + Math.sin(a) * rr], i * 3);
      CM.col.set(L.charge < 0 ? [0.4, 0.75, 1.8] : [1.8, 0.45, 0.45], i * 3);
      CM.size[i] = 0.12; CM.alpha[i] = 0.9;
    }
    CM.flush(q);
  }

  #absorb(p: Photon, L: PLook, cell: boolean) {
    // 1 in 100 photons frees an electron in a real metal; the view shows more so there is something to watch
    if (!L.emit || rand() > 0.55) return;
    if (!cell && L.charge === 0) return;
    const K = L.ek * (1 - Math.sqrt(rand()));
    const V = cell ? L.V : 0;
    // speed ∝ √K; uniform retarding field: K falls by V across the gap
    const kv = 1.5;
    const v0 = kv * Math.sqrt(2 * Math.max(K, 0.002));
    let acc = cell ? (-kv * kv * V) / D_GAP : 0;
    let dir: THREE.Vector3;
    if (cell) dir = p.b.clone().multiplyScalar(-1).normalize();
    else {
      dir = new THREE.Vector3((rand() - 0.5) * 0.9, 1, (rand() - 0.5) * 0.9).normalize();
      if (L.charge > 0) acc = -kv * kv * 3.5;     // a positive plate pulls them straight back
      else acc = kv * kv * 0.6;                    // a negative plate pushes them away
    }
    if (this.#electrons.length > 590) this.#electrons.shift();
    this.#electrons.push({ p0: p.b.clone(), dir, t: 0, K, v0, acc, done: 0, back: false });
  }

  #updateTube(mdt: number, dt: number, L: PLook) {
    const key = L.lines.map((l) => l.nm.toFixed(1)).join(',');
    if (key !== this.#barKey) { this.#barKey = key; this.#rebuildBars(L.lines); this.#tp = []; }
    const [gr, gg, gb] = L.glow;
    this.#tubeGlow.material.color.setRGB(gr, gg, gb);
    this.#tubeGlow.material.opacity = 0.2 + 0.08 * Math.sin(this.time.value * 9);
    // electrons streaming from cathode to anode
    const TE = this.#tubeElec;
    for (let i = 0; i < TE.n; i++) {
      this.#tubeElecX[i] = (this.#tubeElecX[i] + mdt * (0.35 + 0.25 * ((i * 0.37) % 1))) % 1;
      const a = i * 2.399, r = 0.45 * ((i * 0.618) % 1);
      TE.pos.set([-3.5 + 7 * this.#tubeElecX[i], r * Math.cos(a), r * Math.sin(a)], i * 3);
      TE.col.set([0.45, 0.8, 1.9], i * 3); TE.size[i] = 0.06; TE.alpha[i] = 0.7;
    }
    TE.flush();
    // collisions → excited atoms → photons
    const vis = L.lines.filter((l) => l.w > 0);
    const tot = vis.reduce((s, l) => s + l.w, 0);
    this.#tcarry += mdt * 26;
    while (this.#tcarry >= 1 && tot > 0) {
      this.#tcarry--;
      let pickW = rand() * tot, li = vis[0];
      for (const l of vis) { pickW -= l.w; if (pickW <= 0) { li = l; break; } }
      const ap = new THREE.Vector3(-2.2 + 4.4 * rand(), (rand() - 0.5) * 0.7, (rand() - 0.5) * 0.7);
      this.#atomFlashes.push({ p: ap, age: 0, c: li.nm >= 380 && li.nm <= 750 ? li.rgb : [0.5, 0.5, 0.6] });
      if (this.#atomFlashes.length > 60) this.#atomFlashes.shift();
    }
    // visible light heading for the slit and the grating (drawn more often than the rest, so the screen fills)
    const seen = L.lines.filter((l) => l.w > 0 && l.nm >= 380 && l.nm <= 750);
    const vtot = seen.reduce((s2, l) => s2 + l.w, 0);
    this.#vcarry += mdt * 14;
    while (this.#vcarry >= 1 && vtot > 0) {
      this.#vcarry--;
      let pw = rand() * vtot, li = seen[0];
      for (const l of seen) { pw -= l.w; if (pw <= 0) { li = l; break; } }
      const ap = new THREE.Vector3(-1.2 + 2.4 * rand(), (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.6);
      this.#atomFlashes.push({ p: ap, age: 0, c: li.rgb });
      const n = rand() < 0.2 ? 0 : rand() < 0.5 ? -1 : 1;
      const x = n === 0 ? 0 : this.#screenX(li.nm, n);
      if (!Number.isFinite(x)) continue;
      const bar = this.#bars.findIndex((bb) => (n === 0 ? bb.nm === 0 : Math.abs(bb.nm - li.nm * n) < 0.01));
      const yy = (rand() - 0.5) * 1.3;
      if (this.#tp.length > 250) this.#tp.shift();
      this.#tp.push({ a: ap, m: new THREE.Vector3(0, yy * 0.4, GRATE_Z), b: new THREE.Vector3(x, yy, SCREEN_Z), t: 0, c: li.rgb, bar });
    }
    const AF = this.#atomFlash;
    let q = 0;
    this.#atomFlashes = this.#atomFlashes.filter((x) => (x.age += dt) < 0.45);
    for (const x of this.#atomFlashes) {
      const life = 1 - x.age / 0.45;
      AF.pos.set([x.p.x, x.p.y, x.p.z], q * 3); AF.col.set([x.c[0] * 2, x.c[1] * 2, x.c[2] * 2], q * 3); AF.size[q] = 0.32 * life + 0.05; AF.alpha[q] = life; q++;
    }
    AF.flush(q);
    // photons through the grating to the screen
    const T = this.#tpc;
    let m = 0;
    const keep: TubePhoton[] = [];
    const tmp = new THREE.Vector3();
    for (const p of this.#tp) {
      p.t += mdt * 1.4;
      if (p.t >= 2) { if (p.bar >= 0) this.#bars[p.bar].heat = Math.min(1, this.#bars[p.bar].heat + 0.12); continue; }
      keep.push(p);
      for (let j = 0; j < 4; j++) {
        const t = Math.max(0, p.t - j * 0.04);
        if (t < 1) tmp.lerpVectors(p.a, p.m, t); else tmp.lerpVectors(p.m, p.b, t - 1);
        T.pos.set([tmp.x, tmp.y, tmp.z], m * 3); T.col.set([p.c[0] * 1.6, p.c[1] * 1.6, p.c[2] * 1.6], m * 3);
        T.size[m] = j ? 0.07 : 0.11; T.alpha[m] = 1 - j * 0.22; m++;
      }
    }
    this.#tp = keep;
    T.flush(m);
    for (const b of this.#bars) { b.heat = Math.max(0, b.heat - dt * 0.012); b.mesh.material.opacity = b.heat; }
  }

  clearBars() { for (const b of this.#bars) b.heat = 0; }
}
