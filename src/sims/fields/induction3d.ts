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
  #indArrow: THREE.ArrowHelper | null = null;
  #curCones: { mesh: THREE.Mesh; posDir: THREE.Vector3; posPos: THREE.Vector3 }[] = [];
  #poleLabels: {
    leftN: THREE.Sprite;
    leftS: THREE.Sprite;
    rightN: THREE.Sprite;
    rightS: THREE.Sprite;
  } | null = null;
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
    this.#indArrow = null;
    this.#curCones = [];
    this.#poleLabels = null;
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

    const lCoil = label('Copper coil (Lenz’s law poles & induced I)', 0.24, '#fed7aa');
    lCoil.position.set(0, 1.58, 0);
    this.#root.add(lCoil);

    // Induced B_ind arrow inside coil (opposes flux change)
    this.#indArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-0.7, 0, 0), 1.4, 0x38bdf8, 0.32, 0.16);
    this.#indArrow.visible = false;
    this.#root.add(this.#indArrow);

    // Induced current direction cones on top and bottom windings (right-hand grip rule for B_ind)
    const coneGeo = new THREE.ConeGeometry(0.11, 0.28, 10);
    for (const wx of [-0.65, 0.65]) {
      const topMesh = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      topMesh.position.set(wx, 0.98, 0);
      this.#root.add(topMesh);
      this.#curCones.push({ mesh: topMesh, posDir: new THREE.Vector3(0, 0, 1), posPos: new THREE.Vector3(wx, 0.98, 0) });

      const botMesh = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      botMesh.position.set(wx, -0.98, 0);
      this.#root.add(botMesh);
      this.#curCones.push({ mesh: botMesh, posDir: new THREE.Vector3(0, 0, -1), posPos: new THREE.Vector3(wx, -0.98, 0) });
    }

    // Dynamic Lenz pole labels at coil ends
    const leftN = label('Induced N', 0.25, '#fecaca'); leftN.position.set(-1.55, 1.12, 0);
    const leftS = label('Induced S', 0.25, '#bfdbfe'); leftS.position.set(-1.55, 1.12, 0);
    const rightN = label('Induced N', 0.25, '#fecaca'); rightN.position.set(1.55, 1.12, 0);
    const rightS = label('Induced S', 0.25, '#bfdbfe'); rightS.position.set(1.55, 1.12, 0);
    leftN.visible = leftS.visible = rightN.visible = rightS.visible = false;
    this.#root.add(leftN, leftS, rightN, rightS);
    this.#poleLabels = { leftN, leftS, rightN, rightS };

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

    // Rotating rectangular coil built in yz-plane so at θ = 0 its normal (+x) is parallel to B (+x) → max flux
    const rotor = new THREE.Group();
    this.#coilRingMat = new THREE.MeshStandardMaterial({ color: 0xe88b5a, emissive: 0x000000, metalness: 0.65, roughness: 0.25 });
    const pts = [
      new THREE.Vector3(0, -1.25, -1.0),
      new THREE.Vector3(0, 1.25, -1.0),
      new THREE.Vector3(0, 1.25, 1.0),
      new THREE.Vector3(0, -1.25, 1.0),
      new THREE.Vector3(0, -1.25, -1.0),
    ];
    const loop = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.07, 10, false), this.#coilRingMat);
    rotor.add(loop);

    // Normal vector arrow (+x at θ = 0, parallel to B)
    const normArr = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1.35, 0xfbbf24, 0.28, 0.14);
    const lNorm = label('Normal', 0.22, '#fde68a');
    lNorm.position.set(1.58, 0, 0);
    rotor.add(normArr, lNorm);

    // Induced current direction cones along the two active sides (y = ±1.25, along z)
    const coneGeo = new THREE.ConeGeometry(0.11, 0.28, 10);
    for (const [py, dirZ] of [[1.25, 1], [-1.25, -1]] as const) {
      const cm = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      cm.position.set(0, py, 0);
      rotor.add(cm);
      this.#curCones.push({ mesh: cm, posDir: new THREE.Vector3(0, 0, dirZ), posPos: new THREE.Vector3(0, py, 0) });
    }

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

    const active = Math.abs(L.emfSign) > 0.08;
    const sign = L.emfSign >= 0 ? 1 : -1;
    const colHex = sign > 0 ? 0x38bdf8 : 0xfbbf24;

    if (this.#coilRingMat) {
      const mag = Math.min(1, Math.abs(L.emfSign));
      this.#coilRingMat.emissive.setHex(colHex);
      this.#coilRingMat.emissiveIntensity = mag * 0.85;
    }

    const up = new THREE.Vector3(0, 1, 0);
    for (const c of this.#curCones) {
      c.mesh.visible = active;
      if (active) {
        const d = c.posDir.clone().multiplyScalar(sign);
        c.mesh.quaternion.setFromUnitVectors(up, d);
        (c.mesh.material as THREE.MeshBasicMaterial).color.setHex(colHex);
      }
    }

    if (this.#indArrow) {
      this.#indArrow.visible = active;
      if (active) {
        const bDir = new THREE.Vector3(sign, 0, 0);
        this.#indArrow.position.set(-0.7 * sign, 0, 0);
        this.#indArrow.setDirection(bDir);
        const len = 0.7 + Math.min(1, Math.abs(L.emfSign)) * 0.9;
        this.#indArrow.setLength(len, 0.3, 0.16);
        this.#indArrow.setColor(colHex);
      }
    }

    if (this.#poleLabels) {
      const { leftN, leftS, rightN, rightS } = this.#poleLabels;
      leftS.visible = active && sign > 0;
      rightN.visible = active && sign > 0;
      leftN.visible = active && sign < 0;
      rightS.visible = active && sign < 0;
    }
    void dt;
  }
}
