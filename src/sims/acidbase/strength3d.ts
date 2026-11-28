/* Acid–Base Lab: 3D Aqueous Dissociation Box (intact HA molecules vs split H⁺ & A⁻ ions). */

import { Stage3D, THREE, rand } from '../particles/gl';

export interface StrengthLook {
  key: string;
  alpha: number;       // 0..1 fraction dissociated
  isBase: boolean;
  isWater: boolean;
  playing: boolean;
}

interface Unit {
  grp: THREE.Group;
  vel: THREE.Vector3;
  rot: THREE.Vector3;
}

export class StrengthScene extends Stage3D<StrengthLook> {
  #root = new THREE.Group();
  #units: Unit[] = [];
  #lastKey = '';

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [4.5, 3.2, 6.2], target: [0, 0, 0], bloom: [0.42, 0.4, 0.76] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.8));
    const k = new THREE.DirectionalLight(0xffffff, 1.3);
    k.position.set(5, 8, 6);
    this.scene.add(k);

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(4.6, 3.4, 4.6));
    this.scene.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.42 })));
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
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
    }
    this.#units = [];
  }

  #spawn(grp: THREE.Group) {
    grp.position.set((rand() - 0.5) * 3.8, (rand() - 0.5) * 2.6, (rand() - 0.5) * 3.8);
    this.#root.add(grp);
    this.#units.push({
      grp,
      vel: new THREE.Vector3((rand() - 0.5) * 1.4, (rand() - 0.5) * 1.4, (rand() - 0.5) * 1.4),
      rot: new THREE.Vector3((rand() - 0.5) * 1.2, (rand() - 0.5) * 1.2, 0),
    });
  }

  #build(L: StrengthLook) {
    this.#clear();
    const total = 24;
    // Ensure weak acids show at least 1–3 dissociated pairs visually when alpha > 0
    const splitCount = L.isWater
      ? 2
      : L.alpha >= 0.99
      ? total
      : Math.max(1, Math.min(total - 2, Math.round(Math.sqrt(L.alpha) * 12)));
    const intactCount = total - splitCount;

    const hGeo = new THREE.SphereGeometry(0.15, 14, 10);
    const aGeo = new THREE.SphereGeometry(0.28, 16, 12);
    const bondGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.44, 8);

    // Intact molecules (HA or H2O)
    for (let i = 0; i < intactCount; i++) {
      const g = new THREE.Group();
      const a = new THREE.Mesh(aGeo, new THREE.MeshStandardMaterial({ color: L.isWater ? 0x60a5fa : 0x94a3b8, roughness: 0.3 }));
      const h = new THREE.Mesh(hGeo, new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 }));
      h.position.x = 0.4;
      const b = new THREE.Mesh(bondGeo, new THREE.MeshStandardMaterial({ color: 0xcbd5e1 }));
      b.rotation.z = Math.PI / 2;
      b.position.x = 0.2;
      g.add(a, h, b);
      this.#spawn(g);
    }

    // Dissociated ions: H+ (red/coral) & A- / OH- (blue/purple)
    for (let i = 0; i < splitCount; i++) {
      const g1 = new THREE.Group();
      g1.add(new THREE.Mesh(hGeo, new THREE.MeshBasicMaterial({ color: L.isBase ? 0xc084fc : 0xf87171 })));
      this.#spawn(g1);

      const g2 = new THREE.Group();
      g2.add(new THREE.Mesh(aGeo, new THREE.MeshStandardMaterial({ color: L.isBase ? 0x38bdf8 : 0x4ade80, roughness: 0.28 })));
      this.#spawn(g2);
    }
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    if (L.key !== this.#lastKey) {
      this.#lastKey = L.key;
      this.#build(L);
    }
    if (!L.playing) return;
    for (const u of this.#units) {
      u.grp.position.addScaledVector(u.vel, dt);
      u.grp.rotation.x += u.rot.x * dt;
      u.grp.rotation.y += u.rot.y * dt;
      if (Math.abs(u.grp.position.x) > 2.0) u.vel.x *= -1;
      if (Math.abs(u.grp.position.y) > 1.4) u.vel.y *= -1;
      if (Math.abs(u.grp.position.z) > 2.0) u.vel.z *= -1;
    }
  }
}
