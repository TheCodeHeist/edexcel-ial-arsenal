/* Atoms & Bonding Lab: 3D crystal lattices with animated delocalised electrons and shear/stress test. */

import { Stage3D, THREE, pointCloud, rand } from '../particles/gl';
import type { LatticeId } from './lattices';

export interface LatticeLook {
  id: LatticeId;
  shear: number;        // 0..1 applied shear stress
  showElectrons: boolean;
}

export class LatticesScene extends Stage3D<LatticeLook> {
  #root = new THREE.Group();
  #topLayer = new THREE.Group();
  #botLayer = new THREE.Group();
  #eCloud: ReturnType<typeof pointCloud>;
  #eVel: Float32Array;
  #eCount = 0;
  #lastId: LatticeId | null = null;
  #eBounds: [number, number, number] = [2.6, 2.2, 2.6];
  #eLayersY: number[] | null = null;

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [5.2, 3.8, 6.2], target: [0, 0, 0], bloom: [0.45, 0.4, 0.76] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.72));
    const k1 = new THREE.DirectionalLight(0xffffff, 1.35);
    k1.position.set(6, 9, 7);
    this.scene.add(k1);
    const k2 = new THREE.DirectionalLight(0x89b4fa, 0.55);
    k2.position.set(-7, -5, -4);
    this.scene.add(k2);

    this.scene.add(this.#root);
    const maxE = small ? 140 : 240;
    this.#eCloud = pointCloud(maxE, this.px);
    this.#eVel = new Float32Array(maxE * 3);
    this.scene.add(this.#eCloud.obj);
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
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
    }
  }

  #bond(parent: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, r = 0.055, col = 0x94a3b8, dashed = false) {
    if (dashed) {
      const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
      const mat = new THREE.LineDashedMaterial({ color: col, dashSize: 0.16, gapSize: 0.12 });
      const l = new THREE.Line(geo, mat);
      l.computeLineDistances();
      parent.add(l);
      return;
    }
    const dir = b.clone().sub(a);
    const len = dir.length();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, len, 10),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.15 }),
    );
    cyl.position.copy(a).addScaledVector(dir, 0.5);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    parent.add(cyl);
  }

  #sphere(parent: THREE.Group, p: THREE.Vector3, r: number, col: number, metal = 0.15) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(r, 20, 14),
      new THREE.MeshStandardMaterial({ color: col, roughness: metal > 0.5 ? 0.22 : 0.32, metalness: metal }),
    );
    m.position.copy(p);
    parent.add(m);
  }

  #initElectrons(count: number, bx: number, by: number, bz: number, layersY: number[] | null) {
    this.#eCount = Math.min(count, this.#eCloud.n);
    this.#eBounds = [bx, by, bz];
    this.#eLayersY = layersY;
    const c = new THREE.Color(0x38bdf8);
    for (let i = 0; i < this.#eCount; i++) {
      const i3 = i * 3;
      this.#eCloud.pos[i3] = (rand() * 2 - 1) * bx;
      this.#eCloud.pos[i3 + 1] = layersY ? layersY[i % layersY.length] + (rand() - 0.5) * 0.22 : (rand() * 2 - 1) * by;
      this.#eCloud.pos[i3 + 2] = (rand() * 2 - 1) * bz;
      this.#eVel[i3] = (rand() - 0.5) * 2.4;
      this.#eVel[i3 + 1] = layersY ? 0 : (rand() - 0.5) * 2.0;
      this.#eVel[i3 + 2] = (rand() - 0.5) * 2.4;
      this.#eCloud.col[i3] = c.r;
      this.#eCloud.col[i3 + 1] = c.g;
      this.#eCloud.col[i3 + 2] = c.b;
      this.#eCloud.size[i] = 0.24;
      this.#eCloud.alpha[i] = 0.92;
    }
    this.#eCloud.flush(this.#eCount);
  }

  #build(id: LatticeId) {
    this.#clear(this.#root);
    this.#topLayer = new THREE.Group();
    this.#botLayer = new THREE.Group();
    this.#root.add(this.#botLayer, this.#topLayer);
    this.#eCount = 0;
    this.#eLayersY = null;

    if (id === 'nacl') {
      const step = 1.25;
      const pts: { p: THREE.Vector3; isNa: boolean; top: boolean }[] = [];
      for (let ix = -1; ix <= 1; ix++) {
        for (let iy = -1; iy <= 1; iy++) {
          for (let iz = -1; iz <= 1; iz++) {
            const isNa = (ix + iy + iz + 6) % 2 === 0;
            const p = new THREE.Vector3(ix * step, iy * step, iz * step);
            const top = iy >= 1;
            pts.push({ p, isNa, top });
            this.#sphere(top ? this.#topLayer : this.#botLayer, p, isNa ? 0.28 : 0.42, isNa ? 0xc084fc : 0x4ade80, 0.12);
          }
        }
      }
      // Subtle lattice lines within each half
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          if (pts[i].top !== pts[j].top) continue;
          if (pts[i].p.distanceTo(pts[j].p) < step * 1.05) {
            this.#bond(pts[i].top ? this.#topLayer : this.#botLayer, pts[i].p, pts[j].p, 0.032, 0x64748b);
          }
        }
      }
    } else if (id === 'diamond') {
      // Diamond cubic cell (1.5x1.5x1.5 unit cell clipped neatly)
      const a = 2.4;
      const basis: [number, number, number][] = [
        [0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0],
        [0.25, 0.25, 0.25], [0.25, 0.75, 0.75], [0.75, 0.25, 0.75], [0.75, 0.75, 0.25],
      ];
      const atoms: THREE.Vector3[] = [];
      for (let cx = -1; cx <= 0; cx++) {
        for (let cy = -1; cy <= 0; cy++) {
          for (let cz = -1; cz <= 0; cz++) {
            for (const [bx, by, bz] of basis) {
              const p = new THREE.Vector3((cx + bx + 0.5) * a, (cy + by + 0.5) * a, (cz + bz + 0.5) * a);
              if (Math.abs(p.x) <= 1.85 && Math.abs(p.y) <= 1.85 && Math.abs(p.z) <= 1.85) atoms.push(p);
            }
          }
        }
      }
      for (const p of atoms) this.#sphere(this.#botLayer, p, 0.24, 0x94a3b8, 0.25);
      const bondDist = a * Math.sqrt(3) / 4;
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          if (atoms[i].distanceTo(atoms[j]) < bondDist * 1.08) {
            this.#bond(this.#botLayer, atoms[i], atoms[j], 0.055, 0x7dd3fc);
          }
        }
      }
    } else if (id === 'graphite' || id === 'graphene') {
      const ys = id === 'graphite' ? [-1.35, 0, 1.35] : [0];
      const d = 0.85;
      const dx = d * 1.5;
      const dz = d * Math.sqrt(3);
      for (let li = 0; li < ys.length; li++) {
        const y = ys[li];
        const grp = li === ys.length - 1 && id === 'graphite' ? this.#topLayer : this.#botLayer;
        const pts: THREE.Vector3[] = [];
        for (let q = -2; q <= 2; q++) {
          for (let r = -2; r <= 2; r++) {
            const cx = q * dx;
            const cz = r * dz + (Math.abs(q) % 2 ? dz / 2 : 0);
            for (const ox of [-d / 2, d / 2]) {
              const p = new THREE.Vector3(cx + ox, y, cz);
              if (Math.hypot(p.x, p.z) <= 2.75) {
                if (!pts.some((e) => e.distanceTo(p) < 0.2)) pts.push(p);
              }
            }
          }
        }
        for (const p of pts) this.#sphere(grp, p, 0.2, 0x94a3b8, 0.2);
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            if (pts[i].distanceTo(pts[j]) < d * 1.15) this.#bond(grp, pts[i], pts[j], 0.05, 0xcbd5e1);
          }
        }
      }
      // Dashed weak London forces between graphite layers
      if (id === 'graphite') {
        for (const [x, z] of [[-1.5, 0], [0, 0], [1.5, 0], [-0.75, 1.3], [0.75, -1.3]]) {
          this.#bond(this.#botLayer, new THREE.Vector3(x, -1.35, z), new THREE.Vector3(x, 0, z), 0.02, 0xfbbf24, true);
        }
      }
      this.#initElectrons(id === 'graphite' ? 140 : 90, 2.3, 0.1, 2.3, ys);
    } else if (id === 'copper') {
      // ABAB hexagonal close-packed metal cations inside the delocalised electron sea
      const a = 1.22;
      const dy = a * Math.sqrt(2 / 3);
      for (let iy = -1; iy <= 1; iy++) {
        const grp = iy === 1 ? this.#topLayer : this.#botLayer;
        const isB = iy === 0;
        const bOffX = isB ? a * 0.5 : 0;
        const bOffZ = isB ? a / (2 * Math.sqrt(3)) : 0;
        for (let iz = -1; iz <= 1; iz++) {
          const rowShift = (Math.abs(iz) % 2) * (a * 0.5);
          for (let ix = -1; ix <= 1; ix++) {
            const x = ix * a + rowShift + bOffX - a * 0.35;
            const z = iz * a * (Math.sqrt(3) / 2) + bOffZ;
            this.#sphere(grp, new THREE.Vector3(x, iy * dy, z), 0.36, 0xe88b5a, 0.72);
          }
        }
      }
      this.#initElectrons(180, 2.1, 1.8, 2.1, null);
    } else if (id === 'iodine') {
      const sp = 1.9;
      for (let ix = -1; ix <= 1; ix++) {
        for (let iy = -1; iy <= 1; iy++) {
          for (let iz = -1; iz <= 0; iz++) {
            const c = new THREE.Vector3(ix * sp, iy * sp * 0.85, (iz + 0.5) * sp);
            const grp = iy === 1 ? this.#topLayer : this.#botLayer;
            const tilt = ((ix + iy + iz) % 2 ? 1 : -1) * 0.45;
            const d = new THREE.Vector3(Math.cos(tilt), Math.sin(tilt), 0.2).normalize().multiplyScalar(0.42);
            const a = c.clone().sub(d), b = c.clone().add(d);
            this.#sphere(grp, a, 0.34, 0xa855f7, 0.25);
            this.#sphere(grp, b, 0.34, 0xa855f7, 0.25);
            this.#bond(grp, a, b, 0.08, 0xd8b4fe);
          }
        }
      }
    } else if (id === 'ice') {
      // Open hexagonal ice cage: two puckered rings stacked tetrahedrally (each O is H2O)
      const R = 1.65;
      const oxygens: THREE.Vector3[] = [];
      for (const layerY of [-0.85, 0.85]) {
        for (let k = 0; k < 6; k++) {
          const ang = (k * Math.PI) / 3;
          const pucker = (layerY < 0 ? 1 : -1) * (k % 2 ? 0.22 : -0.22);
          oxygens.push(new THREE.Vector3(Math.cos(ang) * R, layerY + pucker, Math.sin(ang) * R));
        }
      }
      for (const o of oxygens) this.#sphere(this.#botLayer, o, 0.3, 0xf87171, 0.15);
      // Connect hexagonal rings + vertical pillars with H atoms and dashed H-bonds
      const pairs: [number, number][] = [];
      for (let k = 0; k < 6; k++) {
        pairs.push([k, (k + 1) % 6]);
        pairs.push([6 + k, 6 + ((k + 1) % 6)]);
        if (k % 2 === 1) {
          pairs.push(k === 5 ? [11, 5] : [k, 6 + k]);
        }
      }
      const covVecs: THREE.Vector3[][] = Array.from({ length: 12 }, () => []);
      const allVecs: THREE.Vector3[][] = Array.from({ length: 12 }, () => []);
      for (const [i, j] of pairs) {
        const a = oxygens[i], b = oxygens[j];
        const hPos = a.clone().lerp(b, 0.35);
        this.#sphere(this.#botLayer, hPos, 0.17, 0xf1f5f9, 0.1);
        this.#bond(this.#botLayer, a, hPos, 0.055, 0xe2e8f0);
        this.#bond(this.#botLayer, hPos, b, 0.03, 0x38bdf8, true);
        covVecs[i].push(b.clone().sub(a).normalize());
        allVecs[i].push(b.clone().sub(a).normalize());
        allVecs[j].push(a.clone().sub(b).normalize());
      }
      // Give every O a second covalent O-H so there are no bare OH groups
      for (let i = 0; i < oxygens.length; i++) {
        if (covVecs[i].length >= 2) continue;
        const o = oxygens[i];
        let dir: THREE.Vector3;
        if (allVecs[i].length >= 3) {
          dir = allVecs[i].reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(-1).normalize();
        } else {
          const rad = new THREE.Vector3(o.x, 0, o.z).normalize();
          const dySign = i < 6 ? 1 : -1;
          dir = rad.multiplyScalar(0.85).add(new THREE.Vector3(0, dySign * 0.42, 0)).normalize();
        }
        const h2Pos = o.clone().addScaledVector(dir, 0.58);
        this.#sphere(this.#botLayer, h2Pos, 0.17, 0xf1f5f9, 0.1);
        this.#bond(this.#botLayer, o, h2Pos, 0.055, 0xe2e8f0);
      }
    }
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    if (L.id !== this.#lastId) {
      this.#lastId = L.id;
      this.#build(L.id);
    }

    // Apply shear stress animation
    const s = L.shear;
    if (L.id === 'nacl') {
      // Shift top layer half a lattice step -> like charges align -> pops upward & breaks apart!
      this.#topLayer.position.x = s * 1.25;
      this.#topLayer.position.y = s > 0.55 ? (s - 0.55) * 2.4 : 0;
      this.#topLayer.rotation.z = s > 0.55 ? -(s - 0.55) * 0.32 : 0;
    } else if (L.id === 'copper' || L.id === 'graphite' || L.id === 'iodine') {
      this.#topLayer.position.x = s * 1.5;
      this.#topLayer.position.y = 0;
      this.#topLayer.rotation.z = 0;
    } else {
      this.#topLayer.position.set(0, 0, 0);
      this.#topLayer.rotation.set(0, 0, 0);
    }

    // Animate delocalised electrons
    this.#eCloud.obj.visible = L.showElectrons && this.#eCount > 0;
    if (this.#eCloud.obj.visible) {
      const [bx, by, bz] = this.#eBounds;
      for (let i = 0; i < this.#eCount; i++) {
        const i3 = i * 3;
        this.#eCloud.pos[i3] += this.#eVel[i3] * dt;
        this.#eCloud.pos[i3 + 1] += this.#eVel[i3 + 1] * dt;
        this.#eCloud.pos[i3 + 2] += this.#eVel[i3 + 2] * dt;
        if (Math.abs(this.#eCloud.pos[i3]) > bx) this.#eVel[i3] *= -1;
        if (!this.#eLayersY && Math.abs(this.#eCloud.pos[i3 + 1]) > by) this.#eVel[i3 + 1] *= -1;
        if (Math.abs(this.#eCloud.pos[i3 + 2]) > bz) this.#eVel[i3 + 2] *= -1;
      }
      this.#eCloud.flush(this.#eCount);
    }
  }
}
