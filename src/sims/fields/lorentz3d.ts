/* Fields Lab: 3D Charged Particle Chamber (circular orbit r = mv/BQ & crossed E/B velocity selector). */

import { Stage3D, THREE, label } from '../particles/gl';
import { PARTICLES, type ParticleId } from './lorentz';

export interface LorentzLook {
  mode: 'orbit' | 'selector';
  particle: ParticleId;
  vScale: number;   // 0.3 .. 2.0 (relative speed)
  bScale: number;   // 0.3 .. 2.0 (relative B)
  eScale: number;   // 0.3 .. 2.0 (relative E in selector)
  playing: boolean;
}

export class LorentzScene extends Stage3D<LorentzLook> {
  #root = new THREE.Group();
  #dot: THREE.Mesh | null = null;
  #fArrow: THREE.ArrowHelper | null = null;
  #vArrow: THREE.ArrowHelper | null = null;
  #selPts: THREE.Vector3[] = [];
  #angle = 0;
  #selT = 0;
  #lastKey = '';

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [0, 2.8, 7.6], target: [0, 0, 0], bloom: [0.46, 0.4, 0.76] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.8));
    const k = new THREE.DirectionalLight(0xffffff, 1.3);
    k.position.set(5, 8, 6);
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
    this.#dot = null;
    this.#fArrow = null;
    this.#vArrow = null;
    this.#selPts = [];
  }

  #orbitRadius(L: LorentzLook): number {
    // Visual radius proportional to v / B, scaled cleanly into [0.65, 2.55]
    const massChargeBias = L.particle === 'electron' ? 0.85 : L.particle === 'proton' ? 1.15 : 1.45;
    return THREE.MathUtils.clamp((L.vScale / L.bScale) * 1.15 * massChargeBias, 0.62, 2.55);
  }

  #buildOrbit(L: LorentzLook) {
    const p = PARTICLES[L.particle];
    const r = this.#orbitRadius(L);

    // Uniform B-field arrows pointing INTO the screen / upward (+y)
    for (let ix = -2; ix <= 2; ix++) {
      for (let iz = -2; iz <= 2; iz++) {
        if ((ix + iz) % 2 !== 0) continue;
        const a = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(ix * 1.1, -1.2, iz * 1.1), 2.4, 0x3b82f6, 0.2, 0.1);
        this.#root.add(a);
      }
    }
    const lB = label('Uniform B-field ↑', 0.28, '#93c5fd');
    lB.position.set(-2.2, 1.55, 0);
    this.#root.add(lB);

    // Circular orbit ring in xz plane
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.025, 10, 64),
      new THREE.MeshBasicMaterial({ color: p.hex, transparent: true, opacity: 0.72 }),
    );
    ring.rotation.x = Math.PI / 2;
    this.#root.add(ring);

    this.#dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 18, 14),
      new THREE.MeshBasicMaterial({ color: p.hex }),
    );
    this.#fArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.9, 0x4ade80, 0.25, 0.15);
    this.#vArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.9, 0xfbbf24, 0.25, 0.15);
    this.#root.add(this.#dot, this.#fArrow, this.#vArrow);
  }

  #buildSelector(L: LorentzLook) {
    const p = PARTICLES[L.particle];
    // Top (+V) & bottom (−V) E-field plates
    const topP = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.14, 1.8), new THREE.MeshStandardMaterial({ color: 0xf87171, roughness: 0.35 }));
    topP.position.y = 1.35;
    const botP = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.14, 1.8), new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.35 }));
    botP.position.y = -1.35;
    this.#root.add(topP, botP);

    const lPlus = label('+V', 0.25, '#fecaca'); lPlus.position.set(-2.05, 1.62, 0);
    const lMinus = label('−V', 0.25, '#bfdbfe'); lMinus.position.set(-2.05, -1.62, 0);
    this.#root.add(lPlus, lMinus);

    // Downward E-field arrows (+V -> −V)
    for (const ex of [-1.5, -0.5, 0.5, 1.5]) {
      const eArr = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(ex, 1.2, -0.45), 2.4, 0xfbbf24, 0.22, 0.11);
      this.#root.add(eArr);
    }
    const lE = label('E ↓', 0.24, '#fde68a'); lE.position.set(-1.35, 1.62, 0);
    this.#root.add(lE);

    // Crossed B-field arrows pointing INTO the page (−z, ⊗)
    for (const bx of [-1.2, 0, 1.2]) {
      for (const by of [-0.55, 0.55]) {
        const bArr = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(bx, by, 0.75), 1.5, 0x60a5fa, 0.22, 0.11);
        this.#root.add(bArr);
      }
    }
    const lB = label('B ⊗ (into page)', 0.24, '#93c5fd'); lB.position.set(0.15, 1.62, 0);
    this.#root.add(lB);

    // Exit collimator slit on the right (gap is |y| < 0.25)
    for (const sy of [-0.75, 0.75]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 1.8), new THREE.MeshStandardMaterial({ color: 0x64748b }));
      wall.position.set(2.4, sy, 0);
      this.#root.add(wall);
    }

    const lSel = label('Slit (only v = E/B passes!)', 0.26, '#e2e8f0');
    lSel.position.set(2.4, 1.62, 0);
    this.#root.add(lSel);

    // Deflection curve: net vertical acceleration proportional to (E - v*B) * sign(q); stop cleanly at plate or slit-wall impact
    const signQ = Math.sign(p.q);
    const mismatch = (L.eScale - L.vScale * L.bScale) * signQ;
    const pts: THREE.Vector3[] = [];
    const steps = 60;
    const xStart = -2.2, xEnd = 3.0;
    const slitWallX = 2.33;
    const slitHalfGap = 0.24;
    const yLimit = 1.20;
    let blocked = false;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = xStart + u * (xEnd - xStart);
      const uPlate = (x - xStart) / 4.6;
      const y = -mismatch * uPlate * uPlate * 1.45;
      if (Math.abs(y) >= yLimit) {
        pts.push(new THREE.Vector3(x, Math.sign(y) * yLimit, 0));
        blocked = true;
        break;
      }
      if (x >= slitWallX && Math.abs(y) >= slitHalfGap) {
        pts.push(new THREE.Vector3(slitWallX, y, 0));
        blocked = true;
        break;
      }
      pts.push(new THREE.Vector3(x, y, 0));
    }
    this.#selPts = pts;
    const balanced = !blocked && Math.abs(mismatch) < 0.08;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    this.#root.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: balanced ? 0x4ade80 : 0xfbbf24 })));

    if (blocked && pts.length) {
      const hitDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.10, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xf87171 }),
      );
      hitDot.position.copy(pts[pts.length - 1]);
      this.#root.add(hitDot);
    }

    this.#dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 12),
      new THREE.MeshBasicMaterial({ color: balanced ? 0x4ade80 : p.hex }),
    );
    this.#root.add(this.#dot);
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    const key = `${L.mode}:${L.particle}:${L.vScale.toFixed(2)}:${L.bScale.toFixed(2)}:${L.eScale.toFixed(2)}`;
    if (key !== this.#lastKey) {
      this.#lastKey = key;
      this.#clear();
      if (L.mode === 'orbit') this.#buildOrbit(L);
      else this.#buildSelector(L);
    }

    const p = PARTICLES[L.particle];
    if (L.mode === 'orbit' && this.#dot && this.#fArrow && this.#vArrow) {
      const r = this.#orbitRadius(L);
      const dir = p.q > 0 ? 1 : -1; // opposite charge curves opposite way!
      if (L.playing) this.#angle += dt * dir * (1.2 * L.vScale / r);
      const x = Math.cos(this.#angle) * r;
      const z = Math.sin(this.#angle) * r;
      this.#dot.position.set(x, 0, z);
      // Force points inward toward centre
      this.#fArrow.position.set(x, 0, z);
      this.#fArrow.setDirection(new THREE.Vector3(-x, 0, -z).normalize());
      // Velocity tangent
      this.#vArrow.position.set(x, 0, z);
      this.#vArrow.setDirection(new THREE.Vector3(-Math.sin(this.#angle) * dir, 0, Math.cos(this.#angle) * dir).normalize());
    } else if (L.mode === 'selector' && this.#dot && this.#selPts.length > 1) {
      if (L.playing) this.#selT = (this.#selT + dt * 0.55 * L.vScale) % 1;
      const fIdx = this.#selT * (this.#selPts.length - 1);
      const i0 = Math.floor(fIdx);
      const i1 = Math.min(this.#selPts.length - 1, i0 + 1);
      this.#dot.position.lerpVectors(this.#selPts[i0], this.#selPts[i1], fIdx - i0);
    }
  }
}
