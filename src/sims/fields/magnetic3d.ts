/* Fields Lab: 3D Magnetic Field stage (F = BIL sin θ with Fleming's Left-Hand Rule, straight wire & solenoid). */

import { Stage3D, THREE, label } from '../particles/gl';
import type { MagMode } from './magnetic';

export interface MagLook {
  mode: MagMode;
  B: number;       // T (0.1 .. 1.5)
  I: number;       // A (0.5 .. 10)
  angle: number;   // degrees (0 .. 90)
  revI: boolean;
  revB: boolean;
}

export class MagneticScene extends Stage3D<MagLook> {
  #root = new THREE.Group();
  #lastKey = '';

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [4.6, 3.4, 6.2], target: [0, 0, 0], bloom: [0.42, 0.4, 0.76] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.78));
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
  }

  #buildMotor(L: MagLook) {
    const bSign = L.revB ? -1 : 1; // +1: N on left (-x) -> S on right (+x)
    const iSign = L.revI ? -1 : 1;

    // North & South magnet poles
    const nPole = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 2.0, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 }),
    );
    nPole.position.x = -2.4 * bSign;
    const sPole = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 2.0, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.35 }),
    );
    sPole.position.x = 2.4 * bSign;
    this.#root.add(nPole, sPole);

    const lN = label('N', 0.42, '#fecaca'); lN.position.set(-2.4 * bSign, 1.35, 0);
    const lS = label('S', 0.42, '#bfdbfe'); lS.position.set(2.4 * bSign, 1.35, 0);
    this.#root.add(lN, lS);

    // Uniform B-field arrows (N -> S)
    const bDir = new THREE.Vector3(bSign, 0, 0);
    for (const y of [-0.55, 0, 0.55]) {
      for (const z of [-0.7, 0.7]) {
        const a = new THREE.ArrowHelper(bDir, new THREE.Vector3(-1.75 * bSign, y, z), 3.5, 0x60a5fa, 0.25, 0.12);
        this.#root.add(a);
      }
    }

    // Copper wire rotated by angle θ from B-axis (θ=90° lies along z-axis)
    const rad = (L.angle * Math.PI) / 180;
    const wDir = new THREE.Vector3(Math.cos(rad), 0, Math.sin(rad)).normalize();
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 4.4, 16),
      new THREE.MeshStandardMaterial({ color: 0xe88b5a, metalness: 0.65, roughness: 0.25 }),
    );
    wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), wDir);
    this.#root.add(wire);

    // Current arrow I along wire
    const iVec = wDir.clone().multiplyScalar(iSign);
    const iArr = new THREE.ArrowHelper(iVec, iVec.clone().multiplyScalar(-0.8), 1.6, 0xfbbf24, 0.32, 0.18);
    iArr.position.y = 0.22;
    this.#root.add(iArr);
    const lI = label('Current I', 0.28, '#fde68a');
    lI.position.copy(iVec.clone().multiplyScalar(1.5)).add(new THREE.Vector3(0, 0.45, 0));
    this.#root.add(lI);

    // Magnetic force F = I × B (right-hand cross product = Fleming's Left-Hand Rule!)
    const fVec = iVec.clone().cross(bDir);
    const fMag = L.B * L.I * Math.sin(rad);
    if (fVec.lengthSq() > 1e-4 && L.angle > 0) {
      fVec.normalize();
      const len = Math.min(2.3, 0.5 + fMag * 0.16);
      const fArr = new THREE.ArrowHelper(fVec, new THREE.Vector3(0, 0, 0), len, 0x4ade80, 0.38, 0.22);
      this.#root.add(fArr);
      const lF = label('Force F', 0.32, '#86efac');
      lF.position.copy(fVec.clone().multiplyScalar(len + 0.35));
      this.#root.add(lF);
    }
  }

  #buildWire(L: MagLook) {
    const iSign = L.revI ? -1 : 1;
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 5.2, 16),
      new THREE.MeshStandardMaterial({ color: 0xe88b5a, metalness: 0.65, roughness: 0.25 }),
    );
    this.#root.add(wire);
    const iArr = new THREE.ArrowHelper(new THREE.Vector3(0, iSign, 0), new THREE.Vector3(0.35, -0.9 * iSign, 0), 1.8, 0xfbbf24, 0.32, 0.18);
    this.#root.add(iArr);
    const lI = label('Current I', 0.3, '#fde68a');
    lI.position.set(0.75, 0.9 * iSign, 0);
    this.#root.add(lI);

    // Concentric circular B-field rings
    for (const r of [0.75, 1.45, 2.25]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.022, 10, 48),
        new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.85 - r * 0.2 }),
      );
      ring.rotation.x = Math.PI / 2;
      this.#root.add(ring);
      // Tangent arrow showing right-hand grip direction
      const tan = new THREE.Vector3(0, 0, -iSign);
      const a = new THREE.ArrowHelper(tan, new THREE.Vector3(r, 0, 0), 0.5, 0x93c5fd, 0.24, 0.14);
      this.#root.add(a);
    }
  }

  #buildSolenoid(L: MagLook) {
    const iSign = L.revI ? -1 : 1;
    // Helical copper coil along x-axis
    const pts: THREE.Vector3[] = [];
    const turns = 9;
    for (let i = 0; i <= 220; i++) {
      const u = i / 220;
      const ang = u * turns * Math.PI * 2;
      pts.push(new THREE.Vector3(-2.4 + u * 4.8, Math.cos(ang) * 0.95, Math.sin(ang) * 0.95));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const coil = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 220, 0.06, 10, false),
      new THREE.MeshStandardMaterial({ color: 0xe88b5a, metalness: 0.65, roughness: 0.25 }),
    );
    this.#root.add(coil);

    // Uniform internal B arrows
    const bDir = new THREE.Vector3(iSign, 0, 0);
    for (const y of [-0.38, 0, 0.38]) {
      const a = new THREE.ArrowHelper(bDir, new THREE.Vector3(-2.6 * iSign, y, 0), 5.2, 0x60a5fa, 0.32, 0.16);
      this.#root.add(a);
    }

    // Current-direction arrowheads on windings (right-hand grip rule: fingers along I -> thumb along B)
    const up = new THREE.Vector3(0, 1, 0);
    const coneGeo = new THREE.ConeGeometry(0.11, 0.28, 10);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const frontDir = new THREE.Vector3(0, -iSign, 0);
    const topDir = new THREE.Vector3(0, 0, iSign);
    for (let k = 1; k <= 7; k += 2) {
      const uFront = (k + 0.25) / turns;
      const xFront = -2.4 + uFront * 4.8;
      const cFront = new THREE.Mesh(coneGeo, coneMat);
      cFront.position.set(xFront, 0, 0.95);
      cFront.quaternion.setFromUnitVectors(up, frontDir);
      this.#root.add(cFront);

      const uTop = k / turns;
      const xTop = -2.4 + uTop * 4.8;
      const cTop = new THREE.Mesh(coneGeo, coneMat);
      cTop.position.set(xTop, 0.95, 0);
      cTop.quaternion.setFromUnitVectors(up, topDir);
      this.#root.add(cTop);
    }
    const lI = label('Current I', 0.26, '#fde68a');
    lI.position.set(0, 1.38, 0);
    this.#root.add(lI);

    const lN = label('N pole', 0.3, '#fecaca'); lN.position.set(2.85 * iSign, 0.9, 0);
    const lS = label('S pole', 0.3, '#bfdbfe'); lS.position.set(-2.85 * iSign, 0.9, 0);
    this.#root.add(lN, lS);
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    const key = `${L.mode}:${L.B.toFixed(2)}:${L.I.toFixed(1)}:${L.angle}:${L.revI}:${L.revB}`;
    if (key !== this.#lastKey) {
      this.#lastKey = key;
      this.#clear();
      if (L.mode === 'motor') this.#buildMotor(L);
      else if (L.mode === 'wire') this.#buildWire(L);
      else this.#buildSolenoid(L);
    }
    void dt;
  }
}
