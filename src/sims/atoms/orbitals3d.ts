/* Atoms & Bonding Lab: 3D quantum orbital probability-density cloud (extends Stage3D). */

import { Stage3D, THREE, pointCloud, rand, label } from '../particles/gl';
import type { OrbitalKind } from './orbitals';

export interface OrbitalLook {
  orbital: OrbitalKind;
  showAxes: boolean;
}

/** Evaluate real hydrogenic wavefunction psi(x, y, z) (unnormalised) for rejection sampling. */
function psi(kind: OrbitalKind, x: number, y: number, z: number): number {
  const r = Math.hypot(x, y, z) + 1e-6;
  if (kind === '1s') return Math.exp(-r * 1.15);
  if (kind === '2s') return (2 - r * 0.95) * Math.exp(-r * 0.52);
  if (kind === '2px') return x * Math.exp(-r * 0.62);
  if (kind === '2py') return y * Math.exp(-r * 0.62);
  if (kind === '2pz') return z * Math.exp(-r * 0.62);
  if (kind === '3dxy') return (x * y) * Math.exp(-r * 0.56);
  if (kind === '3dx2y2') return (x * x - y * y) * 0.55 * Math.exp(-r * 0.56);
  // 3dz2
  return (3 * z * z - r * r) * 0.32 * Math.exp(-r * 0.56);
}

const POS_COL = new THREE.Color(0x60a5fa); // + phase lobe (blue)
const NEG_COL = new THREE.Color(0xf472b6); // - phase lobe (rose/pink)

export class OrbitalsScene extends Stage3D<OrbitalLook> {
  #cloud: ReturnType<typeof pointCloud>;
  #axes = new THREE.Group();
  #lastOrb: OrbitalKind | null = null;
  #N: number;

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [4.2, 3.2, 5.4], target: [0, 0, 0], bloom: [0.55, 0.45, 0.7] });
    this.#N = small ? 2800 : 5200;
    this.#cloud = pointCloud(this.#N, this.px);
    this.scene.add(this.#cloud.obj);

    // Nucleus marker
    const nuc = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    );
    this.scene.add(nuc);

    // Coordinate axes
    const axLen = 3.2;
    const mkAxis = (dir: [number, number, number], text: string, hex: number) => {
      const v = new THREE.Vector3(...dir);
      const geo = new THREE.BufferGeometry().setFromPoints([v.clone().multiplyScalar(-axLen), v.clone().multiplyScalar(axLen)]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.45 }));
      this.#axes.add(line);
      const l = label(text, 0.28, '#cbd5e1');
      l.position.copy(v.clone().multiplyScalar(axLen + 0.35));
      this.#axes.add(l);
    };
    mkAxis([1, 0, 0], 'x', 0xf87171);
    mkAxis([0, 1, 0], 'y', 0x4ade80);
    mkAxis([0, 0, 1], 'z', 0x60a5fa);
    this.scene.add(this.#axes);

    this.autoRotate = true;
    this.controls.autoRotateSpeed = 0.85;
    this.start();
  }

  #sample(kind: OrbitalKind) {
    const R = kind === '1s' ? 2.6 : kind.startsWith('2') ? 4.0 : 4.6;
    // Estimate max |psi|^2 for rejection sampling
    let maxP = 1e-6;
    for (let i = 0; i < 600; i++) {
      const x = (rand() * 2 - 1) * R, y = (rand() * 2 - 1) * R, z = (rand() * 2 - 1) * R;
      const p = psi(kind, x, y, z);
      if (p * p > maxP) maxP = p * p;
    }

    let placed = 0;
    let tries = 0;
    const maxTries = this.#N * 45;
    while (placed < this.#N && tries < maxTries) {
      tries++;
      const x = (rand() * 2 - 1) * R;
      const y = (rand() * 2 - 1) * R;
      const z = (rand() * 2 - 1) * R;
      const v = psi(kind, x, y, z);
      const prob = (v * v) / maxP;
      if (rand() < prob) {
        const i3 = placed * 3;
        this.#cloud.pos[i3] = x;
        this.#cloud.pos[i3 + 1] = y;
        this.#cloud.pos[i3 + 2] = z;
        const c = v >= 0 ? POS_COL : NEG_COL;
        this.#cloud.col[i3] = c.r;
        this.#cloud.col[i3 + 1] = c.g;
        this.#cloud.col[i3 + 2] = c.b;
        this.#cloud.size[placed] = 0.16 + 0.14 * Math.sqrt(prob);
        this.#cloud.alpha[placed] = 0.22 + 0.45 * Math.sqrt(prob);
        placed++;
      }
    }
    this.#cloud.flush(placed);
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    if (L.orbital !== this.#lastOrb) {
      this.#lastOrb = L.orbital;
      this.#sample(L.orbital);
    }
    this.#axes.visible = L.showAxes;
    void dt;
  }
}
