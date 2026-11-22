/* Kinetics Lab, Kc and Kp tab: the 3D view. The mixture in its vessel (a sealed flask of gas, a flask of liquid or a
   beaker of solution), one dot per "unit" of each substance, at any point between the starting amounts and
   equilibrium (the progress slider). As the slider moves, molecules turn into their products where they stand. Solids
   sit in a heap at the bottom: they are there, but they are not in the expression. */

import { THREE, Stage3D, pointCloud, rand } from '../particles/gl';

export interface KLook {
  vessel: 'flask' | 'liquid' | 'beaker';
  cols: [number, number, number][];   // colour of each species
  solid: boolean[];                    // which species are solids
  counts: number[];                    // dots of each species
  playing: boolean;
}

interface P { s: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; glow: number }
const RF = 2.3;          // flask bulb radius

export class KScene extends Stage3D<KLook> {
  #cloud = pointCloud(500, this.px);
  #ps: P[] = [];
  #heap = new THREE.Group();
  #heapKey = '';
  #flask = new THREE.Group();
  #beaker = new THREE.Group();
  #liquid: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  #vkey = '';

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [0, 2.6, 9.6], target: [0, 0.2, 0], bloom: [0.5, 0.4, 0.8], fov: 42 });
    this.scene.add(new THREE.AmbientLight(0xb0b8d0, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-3, 8, 6); this.scene.add(sun);
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fb4e0, transparent: true, opacity: 0.07, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide });
    // round-bottomed flask: a lathe of the outline (bulb and neck), with a stopper
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 + (i / 40) * (Math.PI - 0.42); pts.push(new THREE.Vector2(Math.max(0.01, RF * Math.cos(a)), RF * Math.sin(a))); }
    pts.push(new THREE.Vector2(0.55, RF + 0.2), new THREE.Vector2(0.55, RF + 1.6));
    const flask = new THREE.Mesh(new THREE.LatheGeometry(pts, 56), glass);
    const stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 0.6, 24), new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.8 }));
    stopper.position.y = RF + 1.75;
    this.#flask.add(flask, stopper);
    this.#liquid = new THREE.Mesh(new THREE.SphereGeometry(RF - 0.05, 48, 32, 0, Math.PI * 2, Math.PI * 0.38, Math.PI * 0.62),
      new THREE.MeshStandardMaterial({ color: 0x8a6a3a, transparent: true, opacity: 0.28, roughness: 0.2, depthWrite: false }));
    this.#flask.add(this.#liquid);
    // beaker
    const bk = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 4, 48, 1, true), glass);
    const bb = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48), glass); bb.rotation.x = -Math.PI / 2; bb.position.y = -2;
    const soln = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 3, 48), new THREE.MeshStandardMaterial({ color: 0x7aa0c0, transparent: true, opacity: 0.18, depthWrite: false }));
    soln.position.y = -0.5;
    this.#beaker.add(bk, bb, soln);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 7), new THREE.MeshStandardMaterial({ color: 0x232a38, roughness: 0.8 }));
    bench.position.y = -2.45;
    (this.#cloud.obj.material as THREE.ShaderMaterial).blending = THREE.NormalBlending;
    this.scene.add(this.#flask, this.#beaker, this.#heap, bench, this.#cloud.obj);
    this.start();
  }

  /** a random point inside the space the mixture fills */
  #place(L: KLook): [number, number, number] {
    for (let k = 0; k < 40; k++) {
      if (L.vessel === 'beaker') { const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 2.05; const y = -1.85 + rand() * 2.6; return [r * Math.cos(a), y, r * Math.sin(a)]; }
      const x = (rand() * 2 - 1) * RF, y = (rand() * 2 - 1) * RF, z = (rand() * 2 - 1) * RF;
      const top = L.vessel === 'liquid' ? 0.45 : RF;
      if (x * x + y * y + z * z < (RF - 0.25) ** 2 && y < top && y > -RF + 0.9) return [x, y, z];
    }
    return [0, 0, 0];
  }
  #inside(L: KLook, p: P) {
    if (L.vessel === 'beaker') {
      const r = Math.hypot(p.x, p.z);
      if (r > 2.05) { p.x *= 2.05 / r; p.z *= 2.05 / r; p.vx = -p.vx; p.vz = -p.vz; }
      if (p.y < -1.85 || p.y > 0.8) { p.y = Math.max(-1.85, Math.min(0.8, p.y)); p.vy = -p.vy; }
      return;
    }
    const r = Math.hypot(p.x, p.y, p.z), R = RF - 0.25;
    if (r > R) { p.x *= R / r; p.y *= R / r; p.z *= R / r; p.vx = -p.vx; p.vy = -p.vy; p.vz = -p.vz; }
    const top = L.vessel === 'liquid' ? 0.45 : RF, bot = -RF + 0.9;
    if (p.y > top) { p.y = top; p.vy = -Math.abs(p.vy); }
    if (p.y < bot) { p.y = bot; p.vy = Math.abs(p.vy); }
  }

  #fit = false;
  protected update(dt: number) {
    const L = this.look!;
    // a phone's near-square view: stand further back so the whole set-up fits
    if (!this.#fit) { this.#fit = true; if (this.camera.aspect < 1.2) this.zoomBy(1.2); }
    if (L.vessel !== this.#vkey) { this.#vkey = L.vessel; this.#ps = []; }
    this.#flask.visible = L.vessel !== 'beaker';
    this.#beaker.visible = L.vessel === 'beaker';
    this.#liquid.visible = L.vessel === 'liquid';
    // bring the dots in line with the counts: a surplus species turns into a short one where it stands
    const want = L.counts.map((c, i) => (L.solid[i] ? 0 : Math.max(0, Math.round(c))));
    const have = want.map(() => 0);
    for (const p of this.#ps) have[p.s]++;
    for (let s = 0; s < want.length; s++) {
      while (have[s] > want[s]) {
        const p = this.#ps.find((q) => q.s === s)!;
        const t = want.findIndex((w, j) => have[j] < w);
        if (t >= 0) { p.s = t; p.glow = 1; have[t]++; } else this.#ps.splice(this.#ps.indexOf(p), 1);
        have[s]--;
      }
    }
    for (let s = 0; s < want.length; s++) {
      while (have[s] < want[s]) {
        const [x, y, z] = this.#place(L), d = [rand() - 0.5, rand() - 0.5, rand() - 0.5], n = Math.hypot(...d) || 1;
        this.#ps.push({ s, x, y, z, vx: d[0] / n, vy: d[1] / n, vz: d[2] / n, glow: 1 }); have[s]++;
      }
    }
    // solids: a heap at the bottom, one cube per unit
    const hk = L.counts.map((c, i) => (L.solid[i] ? Math.round(Math.min(60, c)) : 0)).join(',') + L.vessel;
    if (hk !== this.#heapKey) {
      this.#heapKey = hk;
      this.#heap.children.forEach((c) => { (c as THREE.Mesh).geometry.dispose(); ((c as THREE.Mesh).material as THREE.Material).dispose(); });
      this.#heap.clear();
      let k = 0;
      L.counts.forEach((c, i) => {
        if (!L.solid[i]) return;
        const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(...L.cols[i]), roughness: 0.6, metalness: L.cols[i][0] > 0.75 && L.cols[i][2] > 0.85 ? 0.6 : 0 });
        for (let j = 0; j < Math.round(Math.min(60, c)); j++, k++) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), m.clone());
          const a = k * 2.39996, r = 0.12 * Math.sqrt(k) + 0.05;
          const floor = L.vessel === 'beaker' ? -1.88 : -RF + 0.18 + r * r * 0.12;
          b.position.set(r * Math.cos(a), floor + 0.11 + Math.floor(k / 40) * 0.2, r * Math.sin(a));
          b.rotation.set(rand(), rand(), rand());
          this.#heap.add(b);
        }
        m.dispose();
      });
    }
    // motion
    const v = L.playing ? (L.vessel === 'flask' ? 1.6 : 0.6) : 0, H = this.#cloud;
    let h = 0;
    for (const p of this.#ps) {
      if (L.playing && rand() < dt * 2) { const d = [rand() - 0.5, rand() - 0.5, rand() - 0.5], n = Math.hypot(...d) || 1; p.vx = d[0] / n; p.vy = d[1] / n; p.vz = d[2] / n; }
      p.x += p.vx * v * dt; p.y += p.vy * v * dt; p.z += p.vz * v * dt;
      this.#inside(L, p);
      p.glow = Math.max(0, p.glow - dt * 1.6);
      if (h >= H.n) continue;
      const c = L.cols[p.s] ?? [1, 1, 1], g = 1 + 0.8 * p.glow;
      H.pos[3 * h] = p.x; H.pos[3 * h + 1] = p.y; H.pos[3 * h + 2] = p.z;
      H.col[3 * h] = c[0] * g; H.col[3 * h + 1] = c[1] * g; H.col[3 * h + 2] = c[2] * g;
      H.size[h] = 0.2 * (1 + 0.6 * p.glow); H.alpha[h] = 1; h++;
    }
    H.flush(h);
  }
}
