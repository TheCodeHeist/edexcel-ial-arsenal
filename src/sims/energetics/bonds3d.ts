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

  #addBond(a: THREE.Vector3, b: THREE.Vector3, col: number, list: THREE.Mesh[]) {
    const dir = b.clone().sub(a);
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, dir.length(), 12),
      new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.9, roughness: 0.3 }),
    );
    cyl.position.copy(a).addScaledVector(dir, 0.5);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    this.#root.add(cyl);
    list.push(cyl);
  }

  #build() {
    this.#clear();
    // Clean iconic H2 + Cl2 -> 2 HCl rearrangement that visually demonstrates bond breaking & making clearly
    // Left molecule: H-H (white), Right molecule: Cl-Cl (green)
    // Midpoint: 4 separated gaseous atoms lifted higher (higher enthalpy!)
    // End: 2 H-Cl molecules lower (exothermic!)
    this.#addAtom(0xf1f5f9, 0.36, [-2.0, 0.55, 0], [-2.1, 1.35, 0.3], [-1.95, 0.6, 0]);
    this.#addAtom(0xf1f5f9, 0.36, [-2.0, -0.55, 0], [-2.1, -1.15, -0.3], [-1.95, -0.8, 0]);
    this.#addAtom(0x4ade80, 0.56, [1.8, 0.68, 0], [2.1, 1.35, -0.3], [-0.75, 0.6, 0]);
    this.#addAtom(0x4ade80, 0.56, [1.8, -0.68, 0], [2.1, -1.15, 0.3], [-0.75, -0.8, 0]);

    // Reactant bonds (broken: amber/red tint)
    this.#addBond(this.#atoms[0].start, this.#atoms[1].start, 0xf87171, this.#rBonds);
    this.#addBond(this.#atoms[2].start, this.#atoms[3].start, 0xf87171, this.#rBonds);

    // Product bonds (made: sky/blue tint)
    this.#addBond(this.#atoms[0].end, this.#atoms[2].end, 0x38bdf8, this.#pBonds);
    this.#addBond(this.#atoms[1].end, this.#atoms[3].end, 0x38bdf8, this.#pBonds);

    this.#stageLab = label('Reactants → Gaseous atoms → Products', 0.3, '#e2e8f0');
    this.#stageLab.position.set(0, -2.05, 0);
    this.#root.add(this.#stageLab);
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    if (this.#lastKey !== L.rxnId) {
      this.#lastKey = L.rxnId;
      this.#build();
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
