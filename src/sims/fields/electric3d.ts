/* Fields Lab: 3D Electric Field stage (RK2-traced 3D field lines, equipotentials, test probe & parallel-plate parabola). */

import { Stage3D, THREE, label } from '../particles/gl';
import { chargeRadius, type PointCharge } from './electric';

export interface ElectricLook {
  key: string;
  mode: 'radial' | 'plates';
  charges: PointCharge[];
  showEquipot: boolean;
  probeX: number;    // -2.8 .. 2.8
  probeY: number;    // -1.8 .. 1.8
  plateV: number;    // kV (0.5 .. 5)
  plateD: number;    // cm (2 .. 10)
  playing: boolean;
}

export class ElectricScene extends Stage3D<ElectricLook> {
  #root = new THREE.Group();
  #equiGroup = new THREE.Group();
  #probeGroup = new THREE.Group();
  #probeDot: THREE.Mesh | null = null;
  #probeArrow: THREE.ArrowHelper | null = null;
  #beamDot: THREE.Mesh | null = null;
  #beamCurve: THREE.Vector3[] = [];
  #beamT = 0;
  #lastKey = '';

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [0, 2.0, 8.2], target: [0, 0, 0], bloom: [0.45, 0.4, 0.76] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.78));
    const k = new THREE.DirectionalLight(0xffffff, 1.3);
    k.position.set(5, 8, 6);
    this.scene.add(k);
    this.scene.add(this.#root);
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
        else if (mat) { (mat as THREE.SpriteMaterial).map?.dispose(); mat.dispose(); }
      });
    }
  }

  #fieldAt(charges: PointCharge[], p: THREE.Vector3): THREE.Vector3 {
    const out = new THREE.Vector3();
    for (const c of charges) {
      const d = p.clone().sub(new THREE.Vector3(c.x, c.y, 0));
      const r2 = d.lengthSq();
      if (r2 < 0.04) continue;
      out.addScaledVector(d, c.qMicro / (r2 * Math.sqrt(r2)));
    }
    return out;
  }

  #potentialAt(charges: PointCharge[], x: number, y: number): number {
    let v = 0;
    for (const c of charges) {
      const r = Math.hypot(x - c.x, y - c.y);
      v += c.qMicro / Math.max(r, 0.16);
    }
    return v;
  }

  #addEquipotentials(L: ElectricLook) {
    const levels = L.key === 'pos'
      ? [0.9, 1.4, 2.3]
      : L.key === 'neg'
        ? [-0.9, -1.4, -2.3]
        : L.key === 'dipole'
          ? [-2.4, -1.3, -0.6, 0, 0.6, 1.3, 2.4]
          : L.key === 'like'
            ? [1.5, 2.1, 2.5, 3.3, 4.6]
            : [-1.6, -0.6, 0, 0.8, 1.8, 3.2, 5.0];

    const nx = 68, ny = 48;
    const xMin = -3.8, xMax = 3.8, yMin = -2.6, yMax = 2.6;
    const dx = (xMax - xMin) / nx;
    const dy = (yMax - yMin) / ny;
    const grid = new Float32Array((nx + 1) * (ny + 1));
    const masked = new Uint8Array((nx + 1) * (ny + 1));

    for (let iy = 0; iy <= ny; iy++) {
      const y = yMin + iy * dy;
      for (let ix = 0; ix <= nx; ix++) {
        const x = xMin + ix * dx;
        const idx = iy * (nx + 1) + ix;
        grid[idx] = this.#potentialAt(L.charges, x, y);
        if (L.charges.some((c) => Math.hypot(x - c.x, y - c.y) < chargeRadius(c.qMicro) + 0.08)) {
          masked[idx] = 1;
        }
      }
    }

    const interp = (x1: number, y1: number, v1: number, x2: number, y2: number, v2: number, lvl: number): [number, number] => {
      const d = v2 - v1;
      const t = Math.abs(d) < 1e-9 ? 0.5 : THREE.MathUtils.clamp((lvl - v1) / d, 0, 1);
      return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
    };

    for (const lvl of levels) {
      const pos: number[] = [];
      for (let iy = 0; iy < ny; iy++) {
        const y0 = yMin + iy * dy, y1 = y0 + dy;
        for (let ix = 0; ix < nx; ix++) {
          const i00 = iy * (nx + 1) + ix;
          const i10 = i00 + 1;
          const i01 = i00 + (nx + 1);
          const i11 = i01 + 1;
          if (masked[i00] || masked[i10] || masked[i01] || masked[i11]) continue;

          const v00 = grid[i00], v10 = grid[i10], v11 = grid[i11], v01 = grid[i01];
          const mask = (v00 >= lvl ? 1 : 0) | (v10 >= lvl ? 2 : 0) | (v11 >= lvl ? 4 : 0) | (v01 >= lvl ? 8 : 0);
          if (mask === 0 || mask === 15) continue;

          const x0 = xMin + ix * dx, x1 = x0 + dx;
          const e0 = () => interp(x0, y0, v00, x1, y0, v10, lvl);
          const e1 = () => interp(x1, y0, v10, x1, y1, v11, lvl);
          const e2 = () => interp(x0, y1, v01, x1, y1, v11, lvl);
          const e3 = () => interp(x0, y0, v00, x0, y1, v01, lvl);

          const pushSeg = (a: [number, number], b: [number, number]) => {
            pos.push(a[0], a[1], 0, b[0], b[1], 0);
          };

          const centerAbove = (v00 + v10 + v11 + v01) * 0.25 >= lvl;
          switch (mask) {
            case 1: case 14: pushSeg(e3(), e0()); break;
            case 2: case 13: pushSeg(e0(), e1()); break;
            case 3: case 12: pushSeg(e3(), e1()); break;
            case 4: case 11: pushSeg(e1(), e2()); break;
            case 6: case 9: pushSeg(e0(), e2()); break;
            case 7: case 8: pushSeg(e3(), e2()); break;
            case 5:
              if (centerAbove) { pushSeg(e3(), e2()); pushSeg(e0(), e1()); }
              else { pushSeg(e3(), e0()); pushSeg(e1(), e2()); }
              break;
            case 10:
              if (centerAbove) { pushSeg(e3(), e0()); pushSeg(e1(), e2()); }
              else { pushSeg(e0(), e1()); pushSeg(e3(), e2()); }
              break;
          }
        }
      }
      if (pos.length) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const col = lvl === 0 ? 0xe2e8f0 : lvl > 0 ? 0xfbbf24 : 0x38bdf8;
        const opacity = lvl === 0 ? 0.65 : 0.44;
        this.#equiGroup.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity })));
      }
    }

    if (L.key === 'dipole') {
      const lV0 = label('V = 0', 0.24, '#e2e8f0');
      lV0.position.set(0, 2.25, 0);
      this.#equiGroup.add(lV0);
    }
  }

  #buildRadial(L: ElectricLook) {
    this.#clear(this.#root);
    this.#equiGroup = new THREE.Group();
    this.#probeGroup = new THREE.Group();

    // Draw point charges
    for (const c of L.charges) {
      const pos = c.qMicro > 0;
      const r = chargeRadius(c.qMicro);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 18),
        new THREE.MeshStandardMaterial({
          color: pos ? 0xf87171 : 0x60a5fa,
          emissive: pos ? 0x991b1b : 0x1e3a8a,
          emissiveIntensity: 0.55,
          roughness: 0.25,
        }),
      );
      mesh.position.set(c.x, c.y, 0);
      this.#root.add(mesh);

      const lb = label(`${pos ? '+' : ''}${c.qMicro} μC`, 0.28, pos ? '#fecaca' : '#bfdbfe');
      lb.position.set(c.x, c.y + r + 0.34, 0);
      this.#root.add(lb);
    }

    this.#addEquipotentials(L);

    // RK2 field-line streamlines seeded around each charge + directional arrowheads
    const lineMat = new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.72 });
    const coneGeo = new THREE.ConeGeometry(0.068, 0.2, 8);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd });
    const up = new THREE.Vector3(0, 1, 0);
    const hasPos = L.charges.some((c) => c.qMicro > 0);
    for (const c of L.charges) {
      if (hasPos && c.qMicro < 0) continue; // trace from + charges (or from - if only - exists)
      const sign = c.qMicro > 0 ? 1 : -1;
      const nSeeds = Math.round(Math.abs(c.qMicro) * 6);
      for (let i = 0; i < nSeeds; i++) {
        const ang = (i / nSeeds) * Math.PI * 2;
        const zTilt = (i % 3 - 1) * 0.28;
        const p = new THREE.Vector3(c.x + Math.cos(ang) * 0.36, c.y + Math.sin(ang) * 0.36, zTilt * 0.36);
        const pts: THREE.Vector3[] = [p.clone()];
        for (let step = 0; step < 90; step++) {
          const e1 = this.#fieldAt(L.charges, p);
          if (e1.lengthSq() < 1e-6) break;
          e1.normalize().multiplyScalar(0.11 * sign);
          const mid = p.clone().addScaledVector(e1, 0.5);
          const e2 = this.#fieldAt(L.charges, mid);
          if (e2.lengthSq() < 1e-6) break;
          p.addScaledVector(e2.normalize(), 0.11 * sign);
          pts.push(p.clone());
          if (p.length() > 5.2) break;
          if (L.charges.some((o) => o !== c && p.distanceTo(new THREE.Vector3(o.x, o.y, 0)) < 0.34)) break;
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        this.#root.add(new THREE.Line(geo, lineMat));

        if (pts.length >= 6) {
          const ai = Math.max(1, Math.min(pts.length - 2, Math.floor(pts.length * 0.42)));
          const dir = pts[ai + 1].clone().sub(pts[ai]).multiplyScalar(sign);
          if (dir.lengthSq() > 1e-8) {
            const cone = new THREE.Mesh(coneGeo, coneMat);
            cone.position.copy(pts[ai]);
            cone.quaternion.setFromUnitVectors(up, dir.normalize());
            this.#root.add(cone);
          }
        }
      }
    }

    // Test probe (+q) + force vector
    this.#probeDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfde047 }),
    );
    this.#probeArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1.1, 0x4ade80, 0.28, 0.16);
    this.#probeGroup.add(this.#probeDot, this.#probeArrow);

    this.#root.add(this.#equiGroup, this.#probeGroup);
  }

  #buildPlates(L: ElectricLook) {
    this.#clear(this.#root);
    this.#equiGroup = new THREE.Group();
    this.#probeGroup = new THREE.Group();
    this.#probeDot = null;
    this.#probeArrow = null;

    const halfD = 0.8 + (L.plateD / 10) * 1.15;
    // Top plate (+V, red) and bottom plate (0V, blue)
    const topPlate = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.16, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xf87171, metalness: 0.4, roughness: 0.3 }),
    );
    topPlate.position.y = halfD;
    const botPlate = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.16, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.4, roughness: 0.3 }),
    );
    botPlate.position.y = -halfD;
    this.#root.add(topPlate, botPlate);

    const lTop = label(`+${L.plateV.toFixed(1)} kV`, 0.28, '#fecaca');
    lTop.position.set(0, halfD + 0.38, 0);
    const lBot = label('0 V', 0.28, '#bfdbfe');
    lBot.position.set(0, -halfD - 0.38, 0);
    this.#root.add(lTop, lBot);

    // Uniform vertical field arrows (+ -> -)
    for (let ix = -2; ix <= 2; ix++) {
      const a = new THREE.ArrowHelper(
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(ix * 1.0, halfD - 0.14, 0),
        halfD * 2 - 0.28,
        0x93c5fd, 0.26, 0.14,
      );
      this.#root.add(a);
    }

    // Equally spaced equipotential planes
    for (let k = 1; k <= 3; k++) {
      const y = -halfD + (k / 4) * (halfD * 2);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(5.0, 2.0),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.14, side: THREE.DoubleSide }),
      );
      plane.rotation.x = Math.PI / 2;
      plane.position.y = y;
      this.#equiGroup.add(plane);
    }

    // Parabolic electron deflection path (deflected UP toward + plate; stops at impact!)
    const accel = 0.22 * (L.plateV / (L.plateD * 0.25));
    const yHit = halfD - 0.16;
    const uImpact = Math.sqrt(Math.max(0, (yHit + 0.3) / (accel * 1.8)));
    const uEnd = Math.min(1, uImpact);
    this.#beamCurve = [];
    for (let i = 0; i <= 40; i++) {
      const u = (i / 40) * uEnd;
      const x = -2.6 + u * 5.2;
      const y = -0.3 + accel * u * u * 1.8;
      this.#beamCurve.push(new THREE.Vector3(x, y, 0.4));
    }
    if (uImpact < 1) {
      const hitSpot = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 14, 10),
        new THREE.MeshBasicMaterial({ color: 0xfef08a }),
      );
      hitSpot.position.copy(this.#beamCurve[this.#beamCurve.length - 1]);
      this.#root.add(hitSpot);
    }
    const pathGeo = new THREE.BufferGeometry().setFromPoints(this.#beamCurve);
    this.#root.add(new THREE.Line(pathGeo, new THREE.LineBasicMaterial({ color: 0x4ade80 })));

    this.#beamDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x4ade80 }),
    );
    this.#root.add(this.#beamDot, this.#equiGroup);
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    const key = `${L.key}:${L.plateV.toFixed(1)}:${L.plateD.toFixed(1)}`;
    if (key !== this.#lastKey) {
      this.#lastKey = key;
      if (L.mode === 'radial') this.#buildRadial(L);
      else this.#buildPlates(L);
    }
    this.#equiGroup.visible = L.showEquipot;

    if (L.mode === 'radial' && this.#probeDot && this.#probeArrow) {
      const pos = new THREE.Vector3(L.probeX, L.probeY, 0);
      this.#probeDot.position.copy(pos);
      const inside = L.charges.some((c) => Math.hypot(L.probeX - c.x, L.probeY - c.y) < chargeRadius(c.qMicro) + 0.04);
      const e = this.#fieldAt(L.charges, pos);
      const mag = e.length();
      if (!inside && mag > 0.02) {
        this.#probeArrow.visible = true;
        this.#probeArrow.position.copy(pos);
        this.#probeArrow.setDirection(e.normalize());
        this.#probeArrow.setLength(Math.min(1.6, 0.45 + Math.log1p(mag) * 0.45), 0.28, 0.16);
      } else {
        this.#probeArrow.visible = false;
      }
    } else if (L.mode === 'plates' && this.#beamDot && this.#beamCurve.length > 1) {
      if (L.playing) this.#beamT = (this.#beamT + dt * 0.55) % 1;
      const idx = Math.min(this.#beamCurve.length - 1, Math.floor(this.#beamT * (this.#beamCurve.length - 1)));
      this.#beamDot.position.copy(this.#beamCurve[idx]);
    }
  }
}
