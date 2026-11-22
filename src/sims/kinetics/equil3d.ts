/* Kinetics Lab, Equilibrium tab: the 3D views.

   Gas: a sealed syringe in front of a white card (as in the classroom demo, so the colour of the gas shows). Every
   particle is a molecule: the engine (equil.ts) fires forward and backward events at their real relative rates and
   this view carries each one out on actual particles: an N₂O₄ splits into two NO₂ where it is, or an NO₂ finds its
   nearest NO₂ and they join. New molecules glow briefly, so at equilibrium you can see both reactions going on. The
   gas is tinted by the concentration of the coloured species, so pushing the plunger darkens it at once (more NO₂
   per cm³) before the shift lightens it a little. A water bath under the syringe glows blue to red with temperature.

   U-tube: ICl + Cl₂ ⇌ ICl₃. Brown liquid ICl in the bend, yellow crystals of ICl₃ growing on the walls, and the
   green-yellow chlorine in the arms, faint or strong with its pressure. */

import { THREE, Stage3D, pointCloud, label, rand } from '../particles/gl';
import { type Gas, type UTube, type Ev } from './equil';

export interface ELook { mode: 'gas' | 'icl'; sys: string; playing: boolean }

const LMAX = 7.2;         // barrel length at 100 cm³
const RB = 1.25;          // barrel radius
const X0 = -3.9;          // world x of the sealed tip

interface P { s: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; glow: number }

export class EquilScene extends Stage3D<ELook> {
  gas: Gas | null = null;
  tube: UTube | null = null;
  #gasG = new THREE.Group();
  #tubeG = new THREE.Group();
  #cloud = pointCloud(900, this.px);
  #ps: P[] = [];
  #gen = -1;
  #fog: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  #plunger = new THREE.Group();
  #bath: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  #L = LMAX;
  // U-tube parts
  #liq: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial>;
  #segs = 120;
  #rad = 10;
  #cl2: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  #xtal: THREE.InstancedMesh;
  #nx = 160;
  #bub = pointCloud(60, this.px);
  #bubs: { x: number; y: number; z: number; v: number }[] = [];
  #inLab: THREE.Sprite;
  #tBath: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [0.6, 3.2, 10.5], target: [0, 0, 0], bloom: [0.3, 0.4, 0.95], fov: 42, bg: 0x05070d });
    this.scene.add(new THREE.AmbientLight(0xb0b8d0, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(-3, 8, 7);
    this.scene.add(sun);

    // the white card behind (shared by both set-ups)
    const card = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.4), new THREE.MeshStandardMaterial({ color: 0xb9bec9, roughness: 0.9 }));
    card.position.set(0, 0.6, -2.2);
    this.scene.add(card);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 5.5), new THREE.MeshStandardMaterial({ color: 0x232a38, roughness: 0.8 }));
    bench.position.set(0, -2.45, 0.4);
    this.scene.add(bench);

    /* ---------- the syringe ---------- */
    const g = this.#gasG;
    const glassM = new THREE.MeshStandardMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(RB + 0.06, RB + 0.06, LMAX + 0.4, 48, 1, true), glassM);
    barrel.rotation.z = Math.PI / 2; barrel.position.x = X0 + (LMAX + 0.4) / 2;
    const rimM = new THREE.MeshStandardMaterial({ color: 0xcfd6e6, transparent: true, opacity: 0.5, roughness: 0.2 });
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(RB + 0.08, RB + 0.08, 0.14, 48), rimM);
    tip.rotation.z = Math.PI / 2; tip.position.x = X0 - 0.07;
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 16), rimM);
    nozzle.rotation.z = Math.PI / 2; nozzle.position.x = X0 - 0.4;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), new THREE.MeshStandardMaterial({ color: 0x8a2a2a, roughness: 0.6 }));
    cap.position.x = X0 - 0.75;
    const flange = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.6, 0.9), rimM);
    flange.position.x = X0 + LMAX + 0.4;
    g.add(barrel, tip, nozzle, cap, flange);
    // graduations every 10 cm³
    const tk: number[] = [];
    for (let v = 10; v <= 100; v += 10) { const x = X0 + (LMAX * v) / 100; tk.push(x, RB + 0.07, 0.15, x, RB + 0.07 - (v % 50 ? 0.18 : 0.32), 0.15); }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tk, 3)), new THREE.LineBasicMaterial({ color: 0x2a3344 })));
    for (const v of [20, 40, 60, 80, 100]) { const l = label(`${v}`, 0.26, '#cdd5ea'); l.position.set(X0 + (LMAX * v) / 100, RB + 0.42, 0.2); g.add(l); }
    const ul = label('cm³', 0.24, '#cdd5ea'); ul.position.set(X0 + LMAX + 0.05, RB + 0.75, 0.2); g.add(ul);
    // the gas
    this.#fog = new THREE.Mesh(new THREE.CylinderGeometry(RB, RB, 1, 40, 1, false), new THREE.MeshBasicMaterial({ color: 0x8a3c10, transparent: true, opacity: 0, depthWrite: false }));
    this.#fog.rotation.z = Math.PI / 2;
    g.add(this.#fog);
    // the plunger: rubber seal, rod and thumb plate
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(RB, RB, 0.3, 40), new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.7 }));
    seal.rotation.z = Math.PI / 2; seal.position.x = 0.15;
    const rod = new THREE.Mesh(new THREE.BoxGeometry(LMAX, 0.16, 0.9), new THREE.MeshStandardMaterial({ color: 0xd8dde8, transparent: true, opacity: 0.55, roughness: 0.3 }));
    rod.position.x = 0.3 + LMAX / 2;
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.14, 32), new THREE.MeshStandardMaterial({ color: 0xd8dde8, transparent: true, opacity: 0.7, roughness: 0.3 }));
    thumb.rotation.z = Math.PI / 2; thumb.position.x = 0.3 + LMAX;
    this.#plunger.add(seal, rod, thumb);
    g.add(this.#plunger);
    // the water bath
    this.#bath = new THREE.Mesh(new THREE.BoxGeometry(LMAX + 1.6, 0.7, 2.4), new THREE.MeshStandardMaterial({ color: 0x4060a0, transparent: true, opacity: 0.45, emissive: 0x000000, depthWrite: false }));
    this.#bath.position.set(X0 + LMAX / 2, -1.85, 0);
    g.add(this.#bath);
    const bl = label('water bath', 0.24, '#cdd5ea'); bl.position.set(X0 + 0.9, -1.25, 1.3); g.add(bl);
    // molecules drawn with ordinary blending, so brown looks brown against the card (not added up to white)
    (this.#cloud.obj.material as THREE.ShaderMaterial).blending = THREE.NormalBlending;
    this.scene.add(g, this.#cloud.obj);

    /* ---------- the U-tube ---------- */
    const t = this.#tubeG;
    const path = new THREE.CurvePath<THREE.Vector3>();
    path.add(new THREE.LineCurve3(new THREE.Vector3(-1.6, 2.4, 0), new THREE.Vector3(-1.6, 0, 0)));
    const arc = new THREE.EllipseCurve(0, 0, 1.6, 1.6, Math.PI, 2 * Math.PI, false, 0);
    path.add(new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => { const p = arc.getPoint(i / 24); return new THREE.Vector3(p.x, p.y, 0); })));
    path.add(new THREE.LineCurve3(new THREE.Vector3(1.6, 0, 0), new THREE.Vector3(1.6, 2.4, 0)));
    const glass = new THREE.Mesh(new THREE.TubeGeometry(path, this.#segs, 0.55, 28, false), glassM);
    this.#liq = new THREE.Mesh(new THREE.TubeGeometry(path, this.#segs, 0.46, this.#rad, false), new THREE.MeshStandardMaterial({ color: 0x5a1606, emissive: 0x200602, roughness: 0.25 }));
    this.#cl2 = new THREE.Mesh(new THREE.TubeGeometry(path, this.#segs, 0.5, 18, false), new THREE.MeshBasicMaterial({ color: 0xc8dc48, transparent: true, opacity: 0, depthWrite: false }));
    // the crystals, on the walls just above the liquid line and around the bend
    this.#xtal = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ color: 0xffd52a, emissive: 0x6a4a00, roughness: 0.35 }), this.#nx);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
    for (let i = 0; i < this.#nx; i++) {
      const u = 0.2 + 0.6 * ((i * 0.618034) % 1);                 // along the middle of the tube
      const c = path.getPointAt(u), tg = path.getTangentAt(u);
      const n1 = new THREE.Vector3(0, 0, 1), n2 = new THREE.Vector3().crossVectors(tg, n1).normalize();
      const a = rand() * Math.PI * 2, r = 0.3 + rand() * 0.14;
      const pos = c.clone().addScaledVector(n1, Math.cos(a) * r).addScaledVector(n2, Math.sin(a) * r);
      e.set(rand() * 3, rand() * 3, rand() * 3); q.setFromEuler(e); sc.setScalar(0.7 + rand() * 0.9);
      m.compose(pos, q, sc); this.#xtal.setMatrixAt(i, m);
    }
    this.#xtal.count = 0;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 10), new THREE.MeshStandardMaterial({ color: 0x5a6070, metalness: 0.7 }));
    stand.position.set(0, -2.0, 0);
    const inlet = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 12), rimM);
    inlet.position.set(-1.6, 2.6, 0);
    this.#inLab = label('Cl₂ in', 0.3, '#e6f2a0'); this.#inLab.position.set(-1.6, 3.65, 0);
    this.#tBath = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.4, 1.8), new THREE.MeshStandardMaterial({ color: 0x4060a0, transparent: true, opacity: 0.3, depthWrite: false }));
    this.#tBath.position.set(0, -1.15, 0);
    t.add(glass, this.#liq, this.#cl2, this.#xtal, stand, inlet, this.#inLab, this.#tBath, this.#bub.obj);
    const l1 = label('ICl (brown liquid)', 0.26, '#f0c8a8'); l1.position.set(1.5, -2.3, 0.9);
    const l2 = label('ICl₃ (yellow solid)', 0.26, '#ffe27a'); l2.position.set(-1.5, -1.9, 0.9);
    t.add(l1, l2);
    for (let i = 0; i < 60; i++) this.#bubs.push({ x: -1.6, y: 2.4 - rand() * 2.4, z: 0, v: 0.6 + rand() });
    this.scene.add(t);
    this.start();
  }

  /* ---------- the gas particles ---------- */
  #rebuild(G: Gas) {
    this.#ps = [];
    G.disp.forEach((k, s) => { for (let i = 0; i < k; i++) this.#ps.push(this.#spawn(s, rand() * this.#L, false)); });
    G.queue.length = 0;
    this.#gen = G.gen;
  }
  #spawn(s: number, x: number, glow = true, y?: number, z?: number): P {
    let py = y, pz = z;
    if (py === undefined || pz === undefined) { const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * (RB - 0.15); py = r * Math.cos(a); pz = r * Math.sin(a); }
    const d = [rand() - 0.5, rand() - 0.5, rand() - 0.5], n = Math.hypot(...d) || 1;
    return { s, x: Math.max(0.15, Math.min(this.#L - 0.15, x)), y: py, z: pz, vx: d[0] / n, vy: d[1] / n, vz: d[2] / n, glow: glow ? 1 : 0 };
  }
  #nearest(s: number, from: P, skip: Set<P>) {
    let best: P | null = null, bd = Infinity;
    for (const p of this.#ps) {
      if (p.s !== s || skip.has(p)) continue;
      const d = (p.x - from.x) ** 2 + (p.y - from.y) ** 2 + (p.z - from.z) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  #event(G: Gas, e: Ev) {
    if (typeof e === 'object') {
      for (let i = 0; i < e.k; i++) { const p = this.#spawn(e.add, 0.2 + rand() * 0.4); p.vx = Math.abs(p.vx) + 0.6; this.#ps.push(p); }
      return;
    }
    const nu = G.s.nu, need: number[] = [], make: number[] = [];
    nu.forEach((v, i) => { const k = Math.abs(v); for (let j = 0; j < k; j++) (v * e < 0 ? need : make).push(i); });
    const pool = this.#ps.filter((p) => p.s === need[0]);
    if (!pool.length) return;
    const first = pool[Math.floor(rand() * pool.length)];
    const used = new Set<P>([first]);
    for (const s of need.slice(1)) { const p = this.#nearest(s, first, used); if (!p) return; used.add(p); }
    let cx = 0, cy = 0, cz = 0;
    for (const p of used) { cx += p.x; cy += p.y; cz += p.z; }
    cx /= used.size; cy /= used.size; cz /= used.size;
    this.#ps = this.#ps.filter((p) => !used.has(p));
    make.forEach((s, k) => {
      const a = (k / make.length) * Math.PI * 2 + rand();
      const p = this.#spawn(s, cx + Math.cos(a) * 0.08, true, cy + Math.sin(a) * 0.08, cz);
      this.#ps.push(p);
    });
  }

  #fit = false;
  protected update(dt: number) {
    const L = this.look!;
    // a phone's near-square view: stand further back so the whole set-up fits
    if (!this.#fit) { this.#fit = true; if (this.camera.aspect < 1.2) this.zoomBy(1.45); }
    const gasMode = L.mode === 'gas';
    this.#gasG.visible = this.#cloud.obj.visible = gasMode;
    this.#tubeG.visible = !gasMode;
    if (gasMode && this.gas) this.#updGas(this.gas, dt, L.playing);
    else if (!gasMode && this.tube) this.#updTube(this.tube, dt, L.playing);
  }

  #updGas(G: Gas, dt: number, playing: boolean) {
    if (G.gen !== this.#gen) { this.#L = (LMAX * G.V) / 0.1; this.#rebuild(G); }
    // the plunger glides to the set volume
    const Lw = (LMAX * G.V) / 0.1;
    this.#L += (Lw - this.#L) * (1 - Math.exp(-dt / 0.12));
    this.#plunger.position.x = X0 + this.#L;
    this.#fog.scale.y = Math.max(0.01, this.#L);
    this.#fog.position.x = X0 + this.#L / 2;
    // events
    let k = 0;
    while (G.queue.length && k++ < 120) this.#event(G, G.queue.shift()!);
    // colour of the gas: absorbance from the coloured species, as seen against the white card
    const c = G.conc();
    let A = 0, r = 0, gg = 0, b = 0;
    G.s.sp.forEach((sp, i) => { if (!sp.tint) return; const a = sp.tint[3] * c[i]; A += a; r += sp.tint[0] * a; gg += sp.tint[1] * a; b += sp.tint[2] * a; });
    const op = Math.min(0.92, 1 - Math.exp(-A * 0.9));
    this.#fog.material.opacity = Number.isFinite(op) ? op : 0;
    if (A > 0) this.#fog.material.color.setRGB(r / A, gg / A, b / A);
    // the bath: blue when cold, red when hot (relative to the start temperature)
    const [t0, , t1] = G.s.T, f = Math.max(0, Math.min(1, (G.T - t0) / (t1 - t0)));
    this.#bath.material.color.setRGB(0.25 + 0.7 * f, 0.35, 0.85 - 0.7 * f);
    this.#bath.material.emissive.setRGB(0.25 * f, 0.02, 0.2 * (1 - f));
    // move the molecules
    const v = (playing ? 2.4 : 0) * Math.sqrt(G.T / G.s.T[1]), H = this.#cloud;
    let h = 0;
    for (const p of this.#ps) {
      if (playing && rand() < dt * 3) { const d = [rand() - 0.5, rand() - 0.5, rand() - 0.5], n = Math.hypot(...d) || 1; p.vx = d[0] / n; p.vy = d[1] / n; p.vz = d[2] / n; }
      p.x += p.vx * v * dt; p.y += p.vy * v * dt; p.z += p.vz * v * dt;
      const lim = this.#L - 0.15;
      if (p.x < 0.15) { p.x = 0.15; p.vx = Math.abs(p.vx); }
      if (p.x > lim) { p.x = Math.max(0.15, lim); p.vx = -Math.abs(p.vx); }
      const rr = Math.hypot(p.y, p.z), R = RB - 0.13;
      if (rr > R) { const ny = p.y / rr, nz = p.z / rr, dot = p.vy * ny + p.vz * nz; if (dot > 0) { p.vy -= 2 * dot * ny; p.vz -= 2 * dot * nz; } p.y = ny * R; p.z = nz * R; }
      p.glow = Math.max(0, p.glow - dt * 2.2);
      if (h >= H.n) continue;
      const sp = G.s.sp[p.s];
      H.pos[3 * h] = X0 + p.x; H.pos[3 * h + 1] = p.y; H.pos[3 * h + 2] = p.z;
      const gl = 1 + 0.9 * p.glow;
      H.col[3 * h] = sp.col[0] * gl; H.col[3 * h + 1] = sp.col[1] * gl; H.col[3 * h + 2] = sp.col[2] * gl;
      H.size[h] = sp.size * (1 + 0.8 * p.glow); H.alpha[h] = 1;
      h++;
    }
    H.flush(h);
  }

  #updTube(U: UTube, dt: number, playing: boolean) {
    // liquid: centred on the bottom of the bend, its length set by the amount of ICl
    const segs = this.#segs, idxPer = this.#rad * 6;
    const half = Math.round((Math.min(1, U.liq) * 0.22 + 0.02) * segs);
    const mid = Math.round(segs / 2);
    this.#liq.geometry.setDrawRange((mid - half) * idxPer, 2 * half * idxPer);
    this.#xtal.count = Math.round(Math.min(1, U.sol) * this.#nx);
    const op = 0.06 + 0.32 * Math.min(1, U.gas / 1.2);
    this.#cl2.material.opacity = Number.isFinite(op) ? op : 0.06;
    this.#inLab.visible = U.flow;
    const f = Math.max(0, Math.min(1, (U.T - 270) / 90));
    this.#tBath.material.color.setRGB(0.25 + 0.7 * f, 0.35, 0.85 - 0.7 * f);
    // chlorine bubbles down the inlet while it flows
    const B = this.#bub;
    let h = 0;
    for (const b of this.#bubs) {
      if (U.flow && playing) { b.y -= b.v * dt * 1.4; if (b.y < 0.2) { b.y = 2.4 + rand() * 0.8; b.x = -1.6 + (rand() - 0.5) * 0.3; b.z = (rand() - 0.5) * 0.3; } }
      if (!U.flow) continue;
      B.pos[3 * h] = b.x; B.pos[3 * h + 1] = b.y; B.pos[3 * h + 2] = b.z;
      B.col[3 * h] = 0.9; B.col[3 * h + 1] = 1.1; B.col[3 * h + 2] = 0.35; B.size[h] = 0.12; B.alpha[h] = 0.7; h++;
    }
    B.flush(h);
  }
}
