/* Energetics Lab: 3D Entropy & disorder particle box (Solid → Liquid → Gas / Decomposition). */

import { Stage3D, THREE, rand } from '../particles/gl';
import type { EntropyPhase } from './entropy';

export interface EntropyLook {
  phase: EntropyPhase;
  T: number;       // K (controls thermal speed)
  playing: boolean;
}

export class EntropyScene extends Stage3D<EntropyLook> {
  #box: THREE.LineSegments;
  #particles: THREE.Mesh[] = [];
  #home: THREE.Vector3[] = [];
  #vel: THREE.Vector3[] = [];
  #lastPhase: EntropyPhase | null = null;
  #t = 0;

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [4.6, 3.2, 6.0], target: [0, 0, 0], bloom: [0.42, 0.4, 0.76] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.78));
    const k = new THREE.DirectionalLight(0xffffff, 1.3);
    k.position.set(5, 8, 6);
    this.scene.add(k);

    // Wireframe container box
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(4.4, 3.6, 4.4));
    this.#box = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.6 }));
    this.scene.add(this.#box);

    // Create 27 particles (3×3×3)
    const geo = new THREE.SphereGeometry(0.24, 16, 12);
    for (let i = 0; i < 27; i++) {
      const ix = (i % 3) - 1;
      const iy = (Math.floor(i / 3) % 3) - 1;
      const iz = Math.floor(i / 9) - 1;
      const mat = new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? 0x60a5fa : 0x94a3b8, roughness: 0.28 });
      const m = new THREE.Mesh(geo, mat);
      const h = new THREE.Vector3(ix * 0.72, -1.0 + iy * 0.72, iz * 0.72);
      m.position.copy(h);
      this.scene.add(m);
      this.#particles.push(m);
      this.#home.push(h);
      this.#vel.push(new THREE.Vector3((rand() - 0.5) * 3.2, (rand() - 0.5) * 3.2, (rand() - 0.5) * 3.2));
    }
    this.start();
  }

  #resetPositions(phase: EntropyPhase) {
    for (let i = 0; i < this.#particles.length; i++) {
      const m = this.#particles[i];
      const mat = m.material as THREE.MeshStandardMaterial;
      if (phase === 'solid') {
        m.position.copy(this.#home[i]);
        mat.color.setHex(0x60a5fa);
      } else if (phase === 'liquid') {
        m.position.set((rand() - 0.5) * 3.6, -1.5 + rand() * 1.6, (rand() - 0.5) * 3.6);
        mat.color.setHex(0x38bdf8);
      } else if (phase === 'gas') {
        m.position.set((rand() - 0.5) * 3.8, (rand() - 0.5) * 3.0, (rand() - 0.5) * 3.8);
        mat.color.setHex(0xfbbf24);
      } else {
        // decomp: bottom 15 stay solid CaO, top 12 fly free as CO2 gas!
        if (i < 15) {
          m.position.copy(this.#home[i]);
          mat.color.setHex(0x94a3b8);
        } else {
          m.position.set((rand() - 0.5) * 3.6, 0.2 + rand() * 1.4, (rand() - 0.5) * 3.6);
          mat.color.setHex(0xf87171);
        }
      }
    }
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    if (L.phase !== this.#lastPhase) {
      this.#lastPhase = L.phase;
      this.#resetPositions(L.phase);
    }
    if (!L.playing) return;
    this.#t += dt;
    const speedScale = Math.sqrt(L.T / 300);

    for (let i = 0; i < this.#particles.length; i++) {
      const m = this.#particles[i];
      const v = this.#vel[i];
      if (L.phase === 'solid' || (L.phase === 'decomp' && i < 15)) {
        const amp = 0.045 * speedScale;
        m.position.set(
          this.#home[i].x + Math.sin(this.#t * 14 + i * 1.7) * amp,
          this.#home[i].y + Math.cos(this.#t * 16 + i * 2.3) * amp,
          this.#home[i].z + Math.sin(this.#t * 12 + i * 3.1) * amp,
        );
      } else if (L.phase === 'liquid') {
        m.position.addScaledVector(v, dt * 0.45 * speedScale);
        if (Math.abs(m.position.x) > 1.9) v.x *= -1;
        if (m.position.y < -1.55 || m.position.y > 0.15) v.y *= -1;
        if (Math.abs(m.position.z) > 1.9) v.z *= -1;
      } else {
        m.position.addScaledVector(v, dt * 1.15 * speedScale);
        if (Math.abs(m.position.x) > 1.95) v.x *= -1;
        if (Math.abs(m.position.y) > 1.55) v.y *= -1;
        if (Math.abs(m.position.z) > 1.95) v.z *= -1;
      }
    }
  }
}
