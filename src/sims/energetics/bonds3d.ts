/* Energetics Lab: 3D bond-breaking (endothermic climb to gaseous atoms) & bond-making (exothermic drop to products). */

import { Stage3D, THREE, label } from '../particles/gl';

export interface BondsLook {
  progress: number;   // 0 = reactants, 0.5 = separated gaseous atoms, 1 = products
  rxnId: string;
}

export class BondsScene extends Stage3D<BondsLook> {
  #root = new THREE.Group();
  #atoms: { mesh: THREE.Mesh; start: THREE.Vector3; mid: THREE.Vector3; end: THREE.Vector3 }[] = [];
  #rBonds: THREE.Mesh[] = [];
  #pBonds: THREE.Mesh[] = [];
  #stageLab: THREE.Sprite | null = null;
  #lastKey = '';

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [0, 1.8, 7.0], target: [0, 0, 0], bloom: [0.45, 0.4, 0.74] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.8));
    const k = new THREE.DirectionalLight(0xffffff, 1.3);
    k.position.set(5, 8, 6);
    this.scene.add(k);
    this.scene.add(this.#root);
    this.start();
  }

  #clear() {
    while (this.#root.children.length) {
      const c = this.#root.children[0];
      this.#root.remove(c);
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => { (x as THREE.SpriteMaterial).map?.dispose(); x.dispose(); });
        else if (mat) { (mat as THREE.SpriteMaterial).map?.dispose(); mat.dispose(); }
      });
    }
    this.#atoms = [];
    this.#rBonds = [];
    this.#pBonds = [];
    this.#stageLab = null;
  }

  #addAtom(col: number, r: number, start: [number, number, number], mid: [number, number, number], end: [number, number, number]) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r, 22, 16),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.28, metalness: 0.14 }),
    );
    this.#root.add(mesh);
    this.#atoms.push({
      mesh,
      start: new THREE.Vector3(...start),
      mid: new THREE.Vector3(...mid),
      end: new THREE.Vector3(...end),
    });
  }

  #addBond(a: THREE.Vector3, b: THREE.Vector3, col: number, list: THREE.Mesh[], order: 1 | 2 | 3 = 1) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const uDir = dir.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const perp = new THREE.Vector3(0, 0, 1);
    if (Math.abs(uDir.dot(perp)) > 0.9) perp.set(1, 0, 0);
    perp.cross(uDir).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(up, uDir);
    const offsets = order === 1 ? [0] : order === 2 ? [-0.085, 0.085] : [-0.11, 0, 0.11];
    const rad = order === 1 ? 0.075 : 0.05;
    for (const off of offsets) {
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(rad, rad, len, 12),
        new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.9, roughness: 0.3 }),
      );
      cyl.position.copy(a).addScaledVector(dir, 0.5).addScaledVector(perp, off);
      cyl.quaternion.copy(q);
      this.#root.add(cyl);
      list.push(cyl);
    }
  }

  #build(rxnId: string) {
    this.#clear();
    const C_H = 0xf1f5f9, C_CL = 0x4ade80, C_C = 0x64748b, C_O = 0xf87171, C_N = 0x60a5fa;
    const RED = 0xf87171, SKY = 0x38bdf8;

    if (rxnId === 'ch4_comb') {
      // CH4 + 2 O2 -> CO2 + 2 H2O (1 C + 4 H + 4 O = 9 atoms)
      this.#addAtom(C_C, 0.44, [-1.8, 0.0, 0], [-0.4, 0.9, 0], [-1.7, 0.0, 0]);           // 0: C
      this.#addAtom(C_H, 0.27, [-1.8, 0.95, 0], [-2.5, 1.3, 0.4], [1.1, 0.55, 0.6]);    // 1: H1 -> H2O1
      this.#addAtom(C_H, 0.27, [-0.95, -0.35, 0.4], [-1.5, -1.2, 0.5], [1.9, 0.55, 0.6]);// 2: H2 -> H2O1
      this.#addAtom(C_H, 0.27, [-2.55, -0.35, 0.4], [-2.5, -1.2, -0.4], [1.1, -0.9, -0.5]); // 3: H3 -> H2O2
      this.#addAtom(C_H, 0.27, [-1.8, -0.35, -0.8], [-1.5, 1.4, -0.5], [1.9, -0.9, -0.5]); // 4: H4 -> H2O2
      this.#addAtom(C_O, 0.38, [1.2, 0.65, 0.2], [0.8, 1.4, 0.4], [-2.75, 0.0, 0]);     // 5: O1 -> CO2
      this.#addAtom(C_O, 0.38, [2.2, 0.65, 0.2], [2.4, 1.4, -0.2], [-0.65, 0.0, 0]);    // 6: O2 -> CO2
      this.#addAtom(C_O, 0.38, [1.2, -0.75, -0.2], [0.8, -1.3, -0.4], [1.5, 0.95, 0.6]); // 7: O3 -> H2O1
      this.#addAtom(C_O, 0.38, [2.2, -0.75, -0.2], [2.4, -1.3, 0.3], [1.5, -0.5, -0.5]); // 8: O4 -> H2O2

      for (const h of [1, 2, 3, 4]) this.#addBond(this.#atoms[0].start, this.#atoms[h].start, RED, this.#rBonds, 1);
      this.#addBond(this.#atoms[5].start, this.#atoms[6].start, RED, this.#rBonds, 2);
      this.#addBond(this.#atoms[7].start, this.#atoms[8].start, RED, this.#rBonds, 2);

      this.#addBond(this.#atoms[0].end, this.#atoms[5].end, SKY, this.#pBonds, 2);
      this.#addBond(this.#atoms[0].end, this.#atoms[6].end, SKY, this.#pBonds, 2);
      this.#addBond(this.#atoms[7].end, this.#atoms[1].end, SKY, this.#pBonds, 1);
      this.#addBond(this.#atoms[7].end, this.#atoms[2].end, SKY, this.#pBonds, 1);
      this.#addBond(this.#atoms[8].end, this.#atoms[3].end, SKY, this.#pBonds, 1);
      this.#addBond(this.#atoms[8].end, this.#atoms[4].end, SKY, this.#pBonds, 1);
    } else if (rxnId === 'c2h4_h2') {
      // C2H4 + H2 -> C2H6 (2 C + 6 H = 8 atoms)
      this.#addAtom(C_C, 0.44, [-1.75, 0, 0], [-0.7, 0.2, 0], [-0.65, 0, 0]);          // 0: C1
      this.#addAtom(C_C, 0.44, [-0.65, 0, 0], [0.7, -0.2, 0], [0.65, 0, 0]);            // 1: C2
      this.#addAtom(C_H, 0.27, [-2.25, 0.85, 0], [-2.5, 1.3, 0.3], [-1.1, 0.85, 0.3]);  // 2: H1
      this.#addAtom(C_H, 0.27, [-2.25, -0.85, 0], [-2.5, -1.3, -0.3], [-1.1, -0.85, 0.3]); // 3: H2
      this.#addAtom(C_H, 0.27, [-0.15, 0.85, 0], [0.0, 1.4, -0.4], [1.1, 0.85, -0.3]);  // 4: H3
      this.#addAtom(C_H, 0.27, [-0.15, -0.85, 0], [0.0, -1.4, 0.4], [1.1, -0.85, -0.3]); // 5: H4
      this.#addAtom(C_H, 0.27, [1.85, 0.45, 0], [2.4, 1.2, 0.3], [-1.1, 0, -0.85]);     // 6: H5 -> C1
      this.#addAtom(C_H, 0.27, [1.85, -0.45, 0], [2.4, -1.2, -0.3], [1.1, 0, 0.85]);    // 7: H6 -> C2

      this.#addBond(this.#atoms[0].start, this.#atoms[1].start, RED, this.#rBonds, 2);
      this.#addBond(this.#atoms[0].start, this.#atoms[2].start, RED, this.#rBonds, 1);
      this.#addBond(this.#atoms[0].start, this.#atoms[3].start, RED, this.#rBonds, 1);
      this.#addBond(this.#atoms[1].start, this.#atoms[4].start, RED, this.#rBonds, 1);
      this.#addBond(this.#atoms[1].start, this.#atoms[5].start, RED, this.#rBonds, 1);
      this.#addBond(this.#atoms[6].start, this.#atoms[7].start, RED, this.#rBonds, 1);

      this.#addBond(this.#atoms[0].end, this.#atoms[1].end, SKY, this.#pBonds, 1);
      this.#addBond(this.#atoms[0].end, this.#atoms[2].end, SKY, this.#pBonds, 1);
      this.#addBond(this.#atoms[0].end, this.#atoms[3].end, SKY, this.#pBonds, 1);
      this.#addBond(this.#atoms[0].end, this.#atoms[6].end, SKY, this.#pBonds, 1);
      this.#addBond(this.#atoms[1].end, this.#atoms[4].end, SKY, this.#pBonds, 1);
      this.#addBond(this.#atoms[1].end, this.#atoms[5].end, SKY, this.#pBonds, 1);
      this.#addBond(this.#atoms[1].end, this.#atoms[7].end, SKY, this.#pBonds, 1);
    } else if (rxnId === 'haber') {
      // N2 + 3 H2 -> 2 NH3 (2 N + 6 H = 8 atoms)
      this.#addAtom(C_N, 0.44, [-1.9, 0.52, 0], [-1.5, 1.25, 0.3], [-1.4, 0.25, 0]);    // 0: N1
      this.#addAtom(C_N, 0.44, [-1.9, -0.52, 0], [-1.5, -1.25, -0.3], [1.4, 0.25, 0]);  // 1: N2
      this.#addAtom(C_H, 0.27, [0.4, 0.9, 0], [0.2, 1.4, 0.4], [-2.1, -0.45, 0.45]);    // 2: H1 -> NH3-1
      this.#addAtom(C_H, 0.27, [1.2, 0.9, 0], [1.4, 1.4, -0.3], [-0.7, -0.45, 0.45]);   // 3: H2 -> NH3-1
      this.#addAtom(C_H, 0.27, [0.4, 0.0, 0], [0.2, 0.0, -0.5], [-1.4, -0.45, -0.65]);  // 4: H3 -> NH3-1
      this.#addAtom(C_H, 0.27, [1.2, 0.0, 0], [2.4, 0.5, 0.4], [0.7, -0.45, 0.45]);     // 5: H4 -> NH3-2
      this.#addAtom(C_H, 0.27, [0.4, -0.9, 0], [0.4, -1.3, 0.3], [2.1, -0.45, 0.45]);   // 6: H5 -> NH3-2
      this.#addAtom(C_H, 0.27, [1.2, -0.9, 0], [2.4, -1.2, -0.4], [1.4, -0.45, -0.65]); // 7: H6 -> NH3-2

      this.#addBond(this.#atoms[0].start, this.#atoms[1].start, RED, this.#rBonds, 3);
      this.#addBond(this.#atoms[2].start, this.#atoms[3].start, RED, this.#rBonds, 1);
      this.#addBond(this.#atoms[4].start, this.#atoms[5].start, RED, this.#rBonds, 1);
      this.#addBond(this.#atoms[6].start, this.#atoms[7].start, RED, this.#rBonds, 1);

      for (const h of [2, 3, 4]) this.#addBond(this.#atoms[0].end, this.#atoms[h].end, SKY, this.#pBonds, 1);
      for (const h of [5, 6, 7]) this.#addBond(this.#atoms[1].end, this.#atoms[h].end, SKY, this.#pBonds, 1);
    } else {
      // H2 + Cl2 -> 2 HCl
      this.#addAtom(C_H, 0.36, [-2.0, 0.55, 0], [-2.1, 1.35, 0.3], [-1.95, 0.6, 0]);
      this.#addAtom(C_H, 0.36, [-2.0, -0.55, 0], [-2.1, -1.15, -0.3], [-1.95, -0.8, 0]);
      this.#addAtom(C_CL, 0.56, [1.8, 0.68, 0], [2.1, 1.35, -0.3], [-0.75, 0.6, 0]);
      this.#addAtom(C_CL, 0.56, [1.8, -0.68, 0], [2.1, -1.15, 0.3], [-0.75, -0.8, 0]);

      this.#addBond(this.#atoms[0].start, this.#atoms[1].start, RED, this.#rBonds, 1);
      this.#addBond(this.#atoms[2].start, this.#atoms[3].start, RED, this.#rBonds, 1);
      this.#addBond(this.#atoms[0].end, this.#atoms[2].end, SKY, this.#pBonds, 1);
      this.#addBond(this.#atoms[1].end, this.#atoms[3].end, SKY, this.#pBonds, 1);
    }

    this.#stageLab = label('Reactants → Gaseous atoms → Products', 0.3, '#e2e8f0');
    this.#stageLab.position.set(0, -2.05, 0);
    this.#root.add(this.#stageLab);
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    if (this.#lastKey !== L.rxnId) {
      this.#lastKey = L.rxnId;
      this.#build(L.rxnId);
    }
    const p = L.progress;
    for (const a of this.#atoms) {
      if (p <= 0.5) {
        const u = p * 2;
        const s = u * u * (3 - 2 * u);
        a.mesh.position.lerpVectors(a.start, a.mid, s);
      } else {
        const u = (p - 0.5) * 2;
        const s = u * u * (3 - 2 * u);
        a.mesh.position.lerpVectors(a.mid, a.end, s);
      }
    }
    const rOp = Math.max(0, 1 - p * 3.2);
    for (const b of this.#rBonds) {
      b.visible = rOp > 0.02;
      (b.material as THREE.MeshStandardMaterial).opacity = rOp;
    }
    const pOp = Math.max(0, (p - 0.68) * 3.2);
    for (const b of this.#pBonds) {
      b.visible = pOp > 0.02;
      (b.material as THREE.MeshStandardMaterial).opacity = pOp;
    }
    void dt;
  }
}
