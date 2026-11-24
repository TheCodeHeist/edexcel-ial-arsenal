/* Atoms & Bonding Lab: 3D Mass Spectrometer (TOF drift tube & Magnetic sector modes). */

import { Stage3D, THREE, label } from '../particles/gl';
import type { Peak } from './massspec';

export interface MassSpecLook {
  mode: 'tof' | 'mag';
  peaks: Peak[];
  playing: boolean;
  seq: number;
}

interface IonPulse {
  mesh: THREE.Mesh;
  mz: number;
  speed: number;   // ∝ 1/sqrt(mz)
  progress: number; // 0..1
  color: number;
}

const PEAK_COLS = [0x60a5fa, 0xf87171, 0x4ade80, 0xfbbf24, 0xc084fc];

export class MassSpecScene extends Stage3D<MassSpecLook> {
  #apparatus = new THREE.Group();
  #ionsGroup = new THREE.Group();
  #ions: IonPulse[] = [];
  #detectorMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.35 });
  #flash = 0;
  #lastKey = '';

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [0, 3.6, 8.6], target: [0, 0, 0], bloom: [0.5, 0.45, 0.72] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.75));
    const k = new THREE.DirectionalLight(0xffffff, 1.3);
    k.position.set(5, 8, 6);
    this.scene.add(k);
    this.scene.add(this.#apparatus, this.#ionsGroup);
    this.start();
  }

  #clear(g: THREE.Group) {
    while (g.children.length) {
      const c = g.children[0];
      g.remove(c);
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => { (x as THREE.SpriteMaterial).map?.dispose(); x.dispose(); });
        else if (mat && mat !== this.#detectorMat) { (mat as THREE.SpriteMaterial).map?.dispose(); mat.dispose(); }
      });
    }
  }

  #buildApparatus(mode: 'tof' | 'mag') {
    this.#clear(this.#apparatus);

    // Ionisation chamber (left)
    const src = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.1, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x334155, transparent: true, opacity: 0.55, roughness: 0.3 }),
    );
    src.position.set(-4.0, 0, 0);
    this.#apparatus.add(src);
    const lSrc = label('1. Ionisation', 0.28, '#e2e8f0');
    lSrc.position.set(-4.0, 1.05, 0);
    this.#apparatus.add(lSrc);

    // Acceleration plates
    for (const dx of [-2.8, -2.35]) {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 1.25, 1.25),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3, metalness: 0.4 }),
      );
      plate.position.set(dx, 0, 0);
      this.#apparatus.add(plate);
    }
    const lAcc = label('2. Acceleration', 0.28, '#fde68a');
    lAcc.position.set(-2.58, -1.1, 0);
    this.#apparatus.add(lAcc);

    if (mode === 'tof') {
      // Straight vacuum flight tube
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.68, 6.2, 24, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x475569, transparent: true, opacity: 0.26, side: THREE.DoubleSide }),
      );
      tube.rotation.z = Math.PI / 2;
      tube.position.set(0.85, 0, 0);
      this.#apparatus.add(tube);

      const lTube = label('3. Ion drift (v ∝ 1/√m)', 0.28, '#7dd3fc');
      lTube.position.set(0.85, 1.15, 0);
      this.#apparatus.add(lTube);

      // Detector at right end
      const det = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.35, 1.35), this.#detectorMat);
      det.position.set(4.1, 0, 0);
      this.#apparatus.add(det);
      const lDet = label('4. Detection', 0.28, '#bae6fd');
      lDet.position.set(4.1, -1.15, 0);
      this.#apparatus.add(lDet);
    } else {
      // Magnetic sector: magnet poles in middle, curved deflection region
      const magTop = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.25, 2.2),
        new THREE.MeshStandardMaterial({ color: 0xef4444, transparent: true, opacity: 0.42 }),
      );
      magTop.position.set(0.3, 1.1, 0);
      const magBot = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.25, 2.2),
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.42 }),
      );
      magBot.position.set(0.3, -1.1, 0);
      this.#apparatus.add(magTop, magBot);

      const lMag = label('3. Magnetic deflection (light bends more)', 0.28, '#fca5a5');
      lMag.position.set(0.4, 1.58, 0);
      this.#apparatus.add(lMag);

      // Curved detector wall on right/bottom
      const det = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.8, 1.4), this.#detectorMat);
      det.position.set(4.0, -0.8, 0);
      det.rotation.z = 0.25;
      this.#apparatus.add(det);
      const lDet = label('4. Detector', 0.28, '#bae6fd');
      lDet.position.set(4.2, -2.3, 0);
      this.#apparatus.add(lDet);
    }
  }

  #spawnIons(peaks: Peak[]) {
    this.#clear(this.#ionsGroup);
    this.#ions = [];
    const minMz = Math.min(...peaks.map((p) => p.mz));
    for (let i = 0; i < peaks.length; i++) {
      const pk = peaks[i];
      const col = PEAK_COLS[i % PEAK_COLS.length];
      // Spawn 3 pulses per peak staggered
      for (let k = 0; k < 3; k++) {
        const r = 0.11 + Math.min(0.11, (pk.rel / 100) * 0.14);
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(r, 14, 10),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        this.#ionsGroup.add(mesh);
        this.#ions.push({
          mesh,
          mz: pk.mz,
          speed: 0.34 * Math.sqrt(minMz / pk.mz),
          progress: -(k * 0.33),
          color: col,
        });
      }
    }
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    const key = `${L.mode}:${L.peaks.map((p) => p.mz).join(',')}:${L.seq}`;
    if (key !== this.#lastKey) {
      this.#lastKey = key;
      this.#buildApparatus(L.mode);
      this.#spawnIons(L.peaks);
    }

    const minMz = Math.min(...L.peaks.map((p) => p.mz));
    const maxMz = Math.max(...L.peaks.map((p) => p.mz));

    for (const ion of this.#ions) {
      if (L.playing) {
        ion.progress += ion.speed * dt;
        if (ion.progress >= 1) {
          ion.progress -= 1.05;
          this.#flash = 1.0;
        }
      }
      const p = ion.progress;
      if (p < 0) {
        ion.mesh.visible = false;
        continue;
      }
      ion.mesh.visible = true;
      const x = -3.8 + p * 7.8;
      if (L.mode === 'tof') {
        // Spread vertically slightly by m/z so overlapping pulses are easy to distinguish
        const normIdx = maxMz > minMz ? (ion.mz - minMz) / (maxMz - minMz) : 0.5;
        ion.mesh.position.set(x, (normIdx - 0.5) * 0.65, 0);
      } else {
        // Magnetic deflection: starts straight, bends downward in magnet region (x > -1.2), lighter ions bend MORE
        const bendFactor = Math.sqrt(minMz / ion.mz);
        const u = Math.max(0, (x + 1.2) / 5.2);
        const y = -u * u * 1.95 * bendFactor;
        ion.mesh.position.set(x, y, 0);
      }
    }

    this.#flash = Math.max(0, this.#flash - dt * 3.5);
    this.#detectorMat.emissiveIntensity = 0.3 + this.#flash * 1.1;
  }
}
