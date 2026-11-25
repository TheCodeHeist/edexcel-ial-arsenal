/* Energetics Lab: 3D Born–Haber energy-level staircase (extends Stage3D). */

import { Stage3D, THREE, label } from '../particles/gl';
import type { BHCycle } from './bornhaber';

export interface BHLook {
  cycle: BHCycle;
  selectedStep: number; // index into cycle.steps, or -1 for overview
}

export class BornHaberScene extends Stage3D<BHLook> {
  #root = new THREE.Group();
  #lastKey = '';

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [0.5, 1.8, 9.8], target: [0, 0.2, 0], bloom: [0.45, 0.4, 0.74] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.78));
    const k = new THREE.DirectionalLight(0xffffff, 1.3);
    k.position.set(6, 9, 7);
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

  #build(L: BHLook) {
    this.#clear();
    const { cycle, selectedStep } = L;

    // Compute cumulative energy levels starting from Elements = 0
    const levels: { E: number; text: string; stepIdx: number }[] = [
      { E: 0, text: cycle.elements, stepIdx: -1 },
    ];
    let curE = 0;
    for (let i = 0; i < cycle.steps.length; i++) {
      curE += cycle.steps[i].dh;
      levels.push({ E: curE, text: cycle.steps[i].stateAfter, stepIdx: i });
    }

    const minE = Math.min(...levels.map((l) => l.E), cycle.dfH);
    const maxE = Math.max(...levels.map((l) => l.E), 200);
    const span = Math.max(100, maxE - minE);
    const toY = (E: number) => -2.5 + ((E - minE) / span) * 5.2;

    // X layout: step gently across left -> right as we climb, then lattice energy drops on the right
    const nSteps = cycle.steps.length;
    const xOf = (idx: number) => -3.4 + (idx / nSteps) * 6.8;

    // Draw platforms
    for (let i = 0; i < levels.length; i++) {
      const y = toY(levels[i].E);
      const x = xOf(i);
      const isHighlight = i - 1 === selectedStep;
      const isSolid = i === levels.length - 1;
      const isElem = i === 0;

      const plat = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.1, 1.15),
        new THREE.MeshStandardMaterial({
          color: isHighlight ? 0xfbbf24 : isSolid ? 0x4ade80 : isElem ? 0x60a5fa : 0x64748b,
          emissive: isHighlight ? 0xb45309 : isSolid ? 0x166534 : 0x0f172a,
          emissiveIntensity: isHighlight ? 0.65 : 0.25,
          roughness: 0.28,
        }),
      );
      plat.position.set(x, y, 0);
      this.#root.add(plat);

      // Label only key levels or selected level so the 3D view stays crisp and uncluttered
      if (isElem || isSolid || isHighlight || i === levels.length - 2) {
        const lb = label(levels[i].text, 0.24, isHighlight ? '#fef08a' : '#e2e8f0');
        lb.position.set(x, y + (isSolid ? -0.36 : 0.34), 0.35);
        this.#root.add(lb);
      }
    }

    // Vertical energy arrows between consecutive platforms
    for (let i = 0; i < cycle.steps.length; i++) {
      const st = cycle.steps[i];
      const y0 = toY(levels[i].E);
      const y1 = toY(levels[i + 1].E);
      const x = (xOf(i) + xOf(i + 1)) / 2;
      const dy = y1 - y0;
      if (Math.abs(dy) < 0.05) continue;

      const isSel = i === selectedStep;
      const col = isSel ? 0xfde047 : st.dh >= 0 ? 0xf87171 : 0x38bdf8;
      const dir = new THREE.Vector3(0, Math.sign(dy), 0);
      const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(x, y0, 0), Math.abs(dy), col, Math.min(0.32, Math.abs(dy) * 0.35), 0.18);
      this.#root.add(arrow);

      if (isSel || i === cycle.steps.length - 1) {
        const sLab = label(`${st.symbol} (${st.dh >= 0 ? '+' : ''}${st.dh})`, 0.24, isSel ? '#fef08a' : '#7dd3fc');
        sLab.position.set(x, (y0 + y1) / 2, 0.5);
        this.#root.add(sLab);
      }
    }

    // Direct ΔfH arrow on front-left from Elements (0) down to Solid (dfH)
    const yEl = toY(0);
    const ySol = toY(levels[levels.length - 1].E);
    const dfArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(xOf(0), yEl, 0.65),
      Math.max(0.2, yEl - ySol),
      0x4ade80,
      0.3, 0.18,
    );
    this.#root.add(dfArrow);
    const dfLab = label(`ΔfH = ${cycle.dfH}`, 0.25, '#86efac');
    dfLab.position.set(xOf(0) - 0.15, (yEl + ySol) / 2, 0.85);
    this.#root.add(dfLab);
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    const key = `${L.cycle.id}:${L.selectedStep}`;
    if (key !== this.#lastKey) {
      this.#lastKey = key;
      this.#build(L);
    }
    void dt;
  }
}
