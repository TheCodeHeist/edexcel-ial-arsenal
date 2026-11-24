/* Fields Lab: 3D Gravitational Potential Well (Vg ∝ -1/r) + orbiting satellite stage. */

import { Stage3D, THREE, label } from '../particles/gl';

export interface GravityLook {
  bodyHex: number;
  bodyName: string;
  rRatio: number;     // 1.3 .. 7.0 (in planet radii)
  playing: boolean;
}

export class GravityScene extends Stage3D<GravityLook> {
  #root = new THREE.Group();
  #sat: THREE.Mesh | null = null;
  #vArr: THREE.ArrowHelper | null = null;
  #gArr: THREE.ArrowHelper | null = null;
  #angle = 0;
  #lastKey = '';

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [0, 4.4, 7.2], target: [0, -0.3, 0], bloom: [0.42, 0.4, 0.76] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.78));
    const k = new THREE.DirectionalLight(0xffffff, 1.35);
    k.position.set(5, 9, 6);
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
    this.#sat = null;
    this.#vArr = null;
    this.#gArr = null;
  }

  #orbitR(rRatio: number): number {
    return 1.15 + ((rRatio - 1.3) / 5.7) * 2.55;
  }

  #build(L: GravityLook) {
    this.#clear();

    // Central planet
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 28, 20),
      new THREE.MeshStandardMaterial({ color: L.bodyHex, roughness: 0.42, metalness: 0.08 }),
    );
    this.#root.add(planet);

    const lBody = label(L.bodyName, 0.3, '#e2e8f0');
    lBody.position.set(0, 1.05, 0);
    this.#root.add(lBody);

    // 3D Gravitational potential well wireframe (y = -1.6 / r) underneath
    const wellGeo = new THREE.PlaneGeometry(7.6, 7.6, 26, 26);
    wellGeo.rotateX(-Math.PI / 2);
    const pos = wellGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = Math.hypot(x, z);
      const y = -0.35 - 1.75 / Math.max(0.65, d);
      pos.setY(i, y);
    }
    wellGeo.computeVertexNormals();
    const well = new THREE.Mesh(
      wellGeo,
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.22 }),
    );
    this.#root.add(well);

    // Orbit ring
    const orbR = this.#orbitR(L.rRatio);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(orbR, 0.018, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.6 }),
    );
    ring.rotation.x = Math.PI / 2;
    this.#root.add(ring);

    // Satellite + velocity + centripetal gravity arrows
    this.#sat = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    );
    this.#vArr = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.9, 0xfbbf24, 0.24, 0.13);
    this.#gArr = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(), 0.8, 0x4ade80, 0.24, 0.13);
    this.#root.add(this.#sat, this.#vArr, this.#gArr);
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    const key = `${L.bodyHex}:${L.bodyName}:${L.rRatio.toFixed(2)}`;
    if (key !== this.#lastKey) {
      this.#lastKey = key;
      this.#build(L);
    }
    if (this.#sat && this.#vArr && this.#gArr) {
      const orbR = this.#orbitR(L.rRatio);
      // Kepler's 3rd law: ω ∝ r^(-3/2)
      const omega = 1.9 / Math.pow(L.rRatio, 1.5);
      if (L.playing) this.#angle += dt * omega;
      const x = Math.cos(this.#angle) * orbR;
      const z = Math.sin(this.#angle) * orbR;
      this.#sat.position.set(x, 0, z);
      this.#vArr.position.set(x, 0, z);
      this.#vArr.setDirection(new THREE.Vector3(-Math.sin(this.#angle), 0, Math.cos(this.#angle)).normalize());
      this.#gArr.position.set(x, 0, z);
      this.#gArr.setDirection(new THREE.Vector3(-x, 0, -z).normalize());
    }
  }
}
