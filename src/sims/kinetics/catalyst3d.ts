/* Kinetics Lab, Catalysts: heterogeneous catalysis on a metal surface in 3D. A slab of metal atoms; the reactant
   atoms glide between the keyframes in catalyst.ts. Bonds are sticks (two or three thin sticks for a double or triple
   bond; a weakened bond is thin and faint), and bonds to the surface are gold. The active sites under adsorbed atoms
   glow. */

import { THREE, Stage3D, label } from '../particles/gl';
import { SURFACES, type Surf } from './catalyst';

export interface SLook { surf: Surf; stage: number; playing: boolean }

const RADIUS = { C: 0.32, H: 0.2, N: 0.3 };
const COLOUR = { C: 0x3d4250, H: 0xf2f4f8, N: 0x3f6cff };
const METAL = { Ni: 0xa6adb8, Fe: 0x8d7f74 };
const POOL = 40;
const smooth = (u: number) => u * u * (3 - 2 * u);

export class SurfaceScene extends Stage3D<SLook> {
  #atoms: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>[] = [];
  #sticks: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>[] = [];
  #metal = new THREE.Group();
  #metalMat = new THREE.MeshStandardMaterial({ color: METAL.Ni, metalness: 0.7, roughness: 0.48 });
  #sites: THREE.Sprite[] = [];
  #surf: Surf | '' = '';
  #at = 0;                      // where the animation is, in stages (fractional)
  #metalLab = label('Ni surface', 0.32, '#dfe6ff');
  #up = new THREE.Vector3(0, 1, 0);
  #tmp = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [4.4, 5.4, 8.9], target: [0, 0.6, 0], bloom: [0.3, 0.4, 0.9], fov: 42 });
    this.scene.add(new THREE.AmbientLight(0xa0a8c8, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(5, 10, 7); this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9ab4ff, 0.5); fill.position.set(-6, 3, -5); this.scene.add(fill);
    // two layers of metal atoms
    const g = new THREE.SphereGeometry(0.48, small ? 14 : 22, small ? 10 : 16);
    for (let layer = 0; layer < 2; layer++)
      for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) {
        if (layer && (i === 3 || j === 2)) continue;
        const m = new THREE.Mesh(g, this.#metalMat);
        m.position.set(i + layer * 0.5, -layer * 0.75, j + layer * 0.5);
        this.#metal.add(m);
      }
    this.scene.add(this.#metal);
    this.#metalLab.position.set(-2.4, -1.25, 3.1);
    this.scene.add(this.#metalLab);
    // reactant atoms (up to 8) and bond sticks
    for (let i = 0; i < 8; i++) {
      const a = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05 }));
      this.#atoms.push(a); this.scene.add(a);
    }
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
    for (let i = 0; i < POOL; i++) {
      const s = new THREE.Mesh(cyl, new THREE.MeshStandardMaterial({ color: 0xc9cfdc, roughness: 0.4, transparent: true }));
      s.visible = false; this.#sticks.push(s); this.scene.add(s);
    }
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xffc860, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      s.scale.setScalar(1.5); this.#sites.push(s); this.scene.add(s);
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
    this.setHome([4.4 * k, 5.4 * k, 8.9 * k], [0, 0.6, 0]);
  }
  #stick(k: number, a: THREE.Vector3, b: THREE.Vector3, r: number, op: number, col: number) {
    const s = this.#sticks[k];
    if (!s) return;
    const d = this.#tmp.subVectors(b, a), len = d.length();
    if (!(len > 1e-4) || !(op > 0.01)) { s.visible = false; return; }
    s.visible = true;
    s.position.copy(a).addScaledVector(d, 0.5);
    s.scale.set(r, len, r);
    s.quaternion.setFromUnitVectors(this.#up, d.clone().normalize());
    s.material.opacity = Math.min(1, Math.max(0, op));
    s.material.color.setHex(col);
  }

  protected update(dt: number) {
    const L = this.look!, S = SURFACES[L.surf], st = S.stages;
    if (L.surf !== this.#surf) {
      this.#surf = L.surf; this.#at = L.stage;
      this.#metalMat.color.setHex(METAL[S.metal as 'Ni' | 'Fe']);
      const lab = label(`${S.metal} surface (${S.metalName})`, 0.32, '#dfe6ff');
      this.#metalLab.material.map?.dispose(); this.#metalLab.material.map = lab.material.map; this.#metalLab.scale.copy(lab.scale);
      lab.material.dispose();
      S.atoms.forEach((e, i) => { const a = this.#atoms[i]; a.material.color.setHex(COLOUR[e]); a.scale.setScalar(RADIUS[e]); });
    }
    // glide towards the chosen stage; going back to the start jumps
    const want = Math.min(st.length - 1, Math.max(0, L.stage));
    if (want < this.#at - 1.01) this.#at = want;
    const speed = L.playing ? 0.9 : 3;
    this.#at += Math.sign(want - this.#at) * Math.min(Math.abs(want - this.#at), dt * speed);
    const i0 = Math.floor(this.#at), i1 = Math.min(st.length - 1, i0 + 1), u = smooth(this.#at - i0);
    const A = st[i0], B = st[i1];
    const P = S.atoms.map((_, k) => new THREE.Vector3(
      A.pos[k][0] + (B.pos[k][0] - A.pos[k][0]) * u, A.pos[k][1] + (B.pos[k][1] - A.pos[k][1]) * u, A.pos[k][2] + (B.pos[k][2] - A.pos[k][2]) * u));
    // a gentle drift while in the gas, so the molecules look alive
    const wob = (k: number) => (i0 === 0 && u < 0.5) || (i0 === st.length - 1) ? Math.sin(this.time.value * 1.6 + k) * 0.05 : 0;
    P.forEach((p, k) => { p.y += wob(k > 1 ? (k < 6 ? 1 : 2) : 0); this.#atoms[k].position.copy(p); });
    // bonds present in either keyframe, faded across the move
    const key = (b: number[]) => `${Math.min(b[0], b[1])}-${Math.max(b[0], b[1])}`;
    const mA = new Map(A.bonds.map((b) => [key(b), b[2]])), mB = new Map(B.bonds.map((b) => [key(b), b[2]]));
    const all = new Set([...mA.keys(), ...mB.keys()]);
    let k = 0;
    for (const id of all) {
      const [a, b] = id.split('-').map(Number);
      const oa = mA.get(id) ?? 0, ob = mB.get(id) ?? 0;
      const order = u < 0.5 ? oa || ob : ob || oa;
      const op = (oa ? 1 : 0) * (1 - u) + (ob ? 1 : 0) * u;
      const pa = P[a], pb = P[b];
      if (order >= 2) {
        // parallel sticks, offset across the bond
        const d = new THREE.Vector3().subVectors(pb, pa).normalize();
        const side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 0, 1));
        if (side.lengthSq() < 1e-4) side.set(0, 1, 0);
        side.normalize().multiplyScalar(0.1);
        const offs = order >= 3 ? [-1.4, 0, 1.4] : [-0.8, 0.8];
        for (const o of offs) this.#stick(k++, pa.clone().addScaledVector(side, o), pb.clone().addScaledVector(side, o), 0.045, op, 0xc9cfdc);
      } else if (order < 1) {
        this.#stick(k++, pa, pb, 0.05, op * 0.45, 0xff9d7a);     // weakened
      } else this.#stick(k++, pa, pb, 0.075, op, 0xc9cfdc);
    }
    // bonds to the surface: gold, straight down to the metal; the site under it glows
    const adsA = new Set(A.ads), adsB = new Set(B.ads);
    S.atoms.forEach((_, j) => {
      const op = (adsA.has(j) ? 1 : 0) * (1 - u) + (adsB.has(j) ? 1 : 0) * u;
      const p = P[j], q = new THREE.Vector3(p.x, 0.42, p.z);
      this.#stick(k++, p, q, 0.04, op, 0xffc24a);
      const s = this.#sites[j];
      s.position.set(p.x, 0.5, p.z);
      s.material.opacity = 0.55 * op * (0.8 + 0.2 * Math.sin(this.time.value * 3 + j));
    });
    for (; k < POOL; k++) this.#sticks[k].visible = false;
  }
}
