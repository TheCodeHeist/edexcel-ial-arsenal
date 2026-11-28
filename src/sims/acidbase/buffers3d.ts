/* Acid–Base Lab: 3D Buffer Reservoir (HA molecules in amber & A⁻ ions in sky blue, shifting as H⁺/OH⁻ is added). */

import { Stage3D, THREE, rand } from '../particles/gl';

export interface BufferLook {
  haFrac: number; // 0..1 proportion of HA vs A-
  playing: boolean;
}

export class BuffersScene extends Stage3D<BufferLook> {
  #root = new THREE.Group();
  #meshes: THREE.Mesh[] = [];
  #vel: THREE.Vector3[] = [];
  #lastCount = -1;

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [4.4, 3.0, 6.0], target: [0, 0, 0], bloom: [0.42, 0.4, 0.76] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.8));
    const k = new THREE.DirectionalLight(0xffffff, 1.3);
    k.position.set(5, 8, 6);
    this.scene.add(k);

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(4.4, 3.2, 4.4));
    this.scene.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.45 })));

    const geo = new THREE.SphereGeometry(0.24, 16, 12);
    for (let i = 0; i < 30; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.28 });
      const m = new THREE.Mesh(geo, mat);
      m.position.set((rand() - 0.5) * 3.6, (rand() - 0.5) * 2.4, (rand() - 0.5) * 3.6);
      this.#root.add(m);
      this.#meshes.push(m);
      this.#vel.push(new THREE.Vector3((rand() - 0.5) * 1.4, (rand() - 0.5) * 1.4, (rand() - 0.5) * 1.4));
    }
    this.scene.add(this.#root);
    this.start();
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    const haCount = Math.round(L.haFrac * this.#meshes.length);
    if (haCount !== this.#lastCount) {
      this.#lastCount = haCount;
      for (let i = 0; i < this.#meshes.length; i++) {
        (this.#meshes[i].material as THREE.MeshStandardMaterial).color.setHex(i < haCount ? 0xfbbf24 : 0x38bdf8);
      }
    }
    if (!L.playing) return;
    for (let i = 0; i < this.#meshes.length; i++) {
      const m = this.#meshes[i];
      const v = this.#vel[i];
      m.position.addScaledVector(v, dt);
      if (Math.abs(m.position.x) > 1.9) v.x *= -1;
      if (Math.abs(m.position.y) > 1.3) v.y *= -1;
      if (Math.abs(m.position.z) > 1.9) v.z *= -1;
    }
  }
}
