/* Fields Lab: 3D Electromagnetic Induction stage (Magnet plunging through coil & Rotating AC Generator). */

import { Stage3D, THREE, label } from '../particles/gl';
import type { IndMode } from './induction';

export interface IndLook {
  mode: IndMode;
  phase: number;      // radians (for generator angle or magnet oscillation)
  emfSign: number;    // -1..+1 normalised emf for glow feedback
  turns: number;      // visual coil density
}

export class InductionScene extends Stage3D<IndLook> {
  #root = new THREE.Group();
  #magnet: THREE.Group | null = null;
  #coilRingMat: THREE.MeshStandardMaterial | null = null;
  #rotor: THREE.Group | null = null;
  #lastMode: IndMode | null = null;

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [0, 2.8, 7.6], target: [0, 0, 0], bloom: [0.46, 0.4, 0.74] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.8));
    const k = new THREE.DirectionalLight(0xffffff, 1.3);
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
    this.#magnet = null;
    this.#coilRingMat = null;
    this.#rotor = null;
  }

  #buildMagnet() {
    // Copper solenoid coil fixed at centre
    const pts: THREE.Vector3[] = [];
    const turns = 8;
    for (let i = 0; i <= 200; i++) {
      const u = i / 200;
      const a = u * turns * Math.PI * 2;
      pts.push(new THREE.Vector3(-1.3 + u * 2.6, Math.cos(a) * 0.95, Math.sin(a) * 0.95));
    }
    this.#coilRingMat = new THREE.MeshStandardMaterial({ color: 0xe88b5a, emissive: 0x000000, metalness: 0.65, roughness: 0.25 });
    const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.065, 10, false), this.#coilRingMat);
    this.#root.add(coil);

    const lCoil = label('Copper coil (glows with induced I)', 0.26, '#fed7aa');
    lCoil.position.set(0, 1.45, 0);
    this.#root.add(lCoil);

    // Moving bar magnet (N red on right, S blue on left)
    const mag = new THREE.Group();
    const sHalf = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 0.45), new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 }));
    sHalf.position.x = -0.55;
    const nHalf = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 0.45), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 }));
    nHalf.position.x = 0.55;
    const lS = label('S', 0.28, '#bfdbfe'); lS.position.set(-0.55, 0.48, 0);
    const lN = label('N', 0.28, '#fecaca'); lN.position.set(0.55, 0.48, 0);
    mag.add(sHalf, nHalf, lS, lN);
    this.#root.add(mag);
    this.#magnet = mag;
  }

  #buildGenerator() {
    // Fixed N & S poles
    const nPole = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 2.6), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 }));
    nPole.position.x = -2.6;
    const sPole = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 2.6), new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.35 }));
    sPole.position.x = 2.6;
    this.#root.add(nPole, sPole);

    const lN = label('N', 0.38, '#fecaca'); lN.position.set(-2.6, 1.45, 0);
    const lS = label('S', 0.38, '#bfdbfe'); lS.position.set(2.6, 1.45, 0);
    this.#root.add(lN, lS);

    for (const y of [-0.55, 0, 0.55]) {
      const a = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1.9, y, 0), 3.8, 0x60a5fa, 0.24, 0.12);
      this.#root.add(a);
    }

    // Rotating rectangular coil
    const rotor = new THREE.Group();
    this.#coilRingMat = new THREE.MeshStandardMaterial({ color: 0xe88b5a, emissive: 0x000000, metalness: 0.65, roughness: 0.25 });
    const pts = [
      new THREE.Vector3(-1.25, 0, -1.0),
      new THREE.Vector3(1.25, 0, -1.0),
      new THREE.Vector3(1.25, 0, 1.0),
      new THREE.Vector3(-1.25, 0, 1.0),
      new THREE.Vector3(-1.25, 0, -1.0),
    ];
    const loop = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.07, 10, false), this.#coilRingMat);
    rotor.add(loop);

    // Normal vector arrow (to visualise angle θ between normal and B)
    const normArr = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1.35, 0xfbbf24, 0.28, 0.14);
    rotor.add(normArr);

    this.#root.add(rotor);
    this.#rotor = rotor;
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    if (L.mode !== this.#lastMode) {
      this.#lastMode = L.mode;
      this.#clear();
      if (L.mode === 'magnet') this.#buildMagnet();
      else this.#buildGenerator();
    }

    if (L.mode === 'magnet' && this.#magnet) {
      this.#magnet.position.x = Math.cos(L.phase) * 2.65;
    } else if (L.mode === 'generator' && this.#rotor) {
      this.#rotor.rotation.z = L.phase;
    }

    if (this.#coilRingMat) {
      const mag = Math.min(1, Math.abs(L.emfSign));
      this.#coilRingMat.emissive.setHex(L.emfSign >= 0 ? 0x38bdf8 : 0xfbbf24);
      this.#coilRingMat.emissiveIntensity = mag * 0.85;
    }
    void dt;
  }
}
