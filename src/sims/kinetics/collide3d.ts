/* Kinetics Lab, Collisions: the 3D box. A glass box with a piston for a lid; the particles are lit spheres (A blue,
   B amber, products mint; the solid is pale marble). A collision with less than Ea gives a small, brief blue spark and
   a bounce; one with Ea or more gives a bright flash and the pair turn into products. The box edges warm from blue to
   red with the temperature. The simulation itself is in collide.ts. */

import { THREE, Stage3D, label } from '../particles/gl';
import { Sim, BOX, RAD, type Box } from './collide';

export interface CLook extends Box { playing: boolean; seq: number }

const MAXG = 260, MAXS = 216, MAXF = 48;
const COL = [new THREE.Color(0x4f8cff), new THREE.Color(0xffa63d), new THREE.Color(0x4fe0a0), new THREE.Color(0xd8d2c4)];

export class CollideScene extends Stage3D<CLook> {
  readonly sim: Sim;
  #gas: THREE.InstancedMesh;
  #solid: THREE.InstancedMesh;
  #flash: THREE.Sprite[] = [];
  #edges: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  #piston = new THREE.Group();
  #seq = -1;
  #m = new THREE.Matrix4();
  #c = new THREE.Color();

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [10.5, 7.5, 13.5], target: [0, -0.6, 0], bloom: [0.7, 0.45, 0.6], fov: 44 });
    this.sim = new Sim({ mode: 'gas', T: 300, n: 120, vol: 1, lump: true, cat: false });
    this.scene.add(new THREE.AmbientLight(0x9aa4c8, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(6, 12, 8); this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.6); rim.position.set(-8, 4, -6); this.scene.add(rim);

    const geo = new THREE.SphereGeometry(RAD, small ? 10 : 16, small ? 8 : 12);
    this.#gas = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05 }), MAXG);
    this.#solid = new THREE.InstancedMesh(new THREE.BoxGeometry(2 * RAD * 0.96, 2 * RAD * 0.96, 2 * RAD * 0.96), new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 }), MAXS);
    for (const m of [this.#gas, this.#solid]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; }
    this.scene.add(this.#gas, this.#solid);

    // the box: floor, faint glass walls, glowing edges
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * BOX, 2 * BOX), new THREE.MeshStandardMaterial({ color: 0x141a2a, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -BOX - 0.01;
    const grid = new THREE.GridHelper(2 * BOX, 10, 0x2a3552, 0x1d253a); grid.position.y = -BOX;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2 * BOX, 2 * BOX, 2 * BOX), new THREE.MeshBasicMaterial({ color: 0x8fb0ff, transparent: true, opacity: 0.035, side: THREE.BackSide, depthWrite: false }));
    this.#edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * BOX, 2 * BOX, 2 * BOX)), new THREE.LineBasicMaterial({ color: 0x6f8cff, transparent: true, opacity: 0.8 }));
    this.scene.add(floor, grid, glass, this.#edges);
    // the piston: a plate with a rod
    const plate = new THREE.Mesh(new THREE.BoxGeometry(2 * BOX - 0.04, 0.22, 2 * BOX - 0.04), new THREE.MeshStandardMaterial({ color: 0x8a93a8, metalness: 0.75, roughness: 0.3, transparent: true, opacity: 0.55 }));
    plate.position.y = 0.11;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2 * BOX, 18), new THREE.MeshStandardMaterial({ color: 0x9aa3b8, metalness: 0.8, roughness: 0.25 }));
    rod.position.y = BOX + 0.22;
    const pl = label('piston', 0.5, '#cfd6ea'); pl.position.set(0.9, 1.3, 0);
    this.#piston.add(plate, rod, pl);
    this.scene.add(this.#piston);

    for (let i = 0; i < MAXF; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      s.visible = false; this.#flash.push(s); this.scene.add(s);
    }
    this.start();
  }


  #narrow: boolean | null = null;
  /** on a squarish (phone) view, pull the camera back so the whole scene fits across */
  resize() {
    super.resize();
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    const narrow = w / h < 1.25;
    if (narrow === this.#narrow) return;
    this.#narrow = narrow;
    const k = narrow ? 1.45 : 1;
    this.setHome([10.5 * k, 7.5 * k, 13.5 * k], [0, -0.6, 0]);
  }
  protected update(dt: number) {
    const L = this.look!, sim = this.sim;
    const cfg = { mode: L.mode, T: L.T, n: L.n, vol: L.vol, lump: L.lump, cat: L.cat };
    sim.configure(cfg);
    if (L.seq !== this.#seq) { this.#seq = L.seq; sim.reset(); }
    if (L.playing) sim.step(dt);
    // piston and box colour
    this.#piston.position.y = sim.top;
    this.#piston.visible = L.mode === 'gas';
    const u = Math.max(0, Math.min(1, (L.T - 200) / 500));
    this.#edges.material.color.setRGB(0.4 + 0.9 * u, 0.55 - 0.15 * u, 1.0 - 0.75 * u);
    // gas
    const g = this.#gas, n = Math.min(MAXG, sim.parts.length);
    for (let i = 0; i < n; i++) {
      const p = sim.parts[i];
      this.#m.makeTranslation(p.x, p.y, p.z);
      g.setMatrixAt(i, this.#m);
      this.#c.copy(COL[p.k]).multiplyScalar(1 + 2.2 * p.glow);
      g.setColorAt(i, this.#c);
    }
    g.count = n;
    g.instanceMatrix.needsUpdate = true;
    if (g.instanceColor) g.instanceColor.needsUpdate = true;
    // solid
    const s = this.#solid, m = Math.min(MAXS, sim.solid.length);
    for (let i = 0; i < m; i++) {
      const p = sim.solid[i];
      this.#m.makeTranslation(p.x, p.y, p.z);
      s.setMatrixAt(i, this.#m);
      s.setColorAt(i, COL[3]);
    }
    s.count = m;
    s.instanceMatrix.needsUpdate = true;
    if (s.instanceColor) s.instanceColor.needsUpdate = true;
    // flashes: bright and warm for a reaction, small and blue for a bounce
    const fl = sim.flashes.slice(-MAXF);
    for (let i = 0; i < MAXF; i++) {
      const sp = this.#flash[i], f = fl[i];
      if (!f) { sp.visible = false; continue; }
      const life = f.hit ? 0.7 : 0.25, k = Math.max(0, 1 - f.age / life);
      sp.visible = true;
      sp.position.set(f.x, f.y, f.z);
      sp.material.color.set(f.hit ? 0xfff0b0 : 0x7fa8ff);
      sp.material.opacity = f.hit ? k : 0.45 * k;
      sp.scale.setScalar(f.hit ? 1.2 + 2.6 * (1 - k) : 0.9);
    }
  }
}
