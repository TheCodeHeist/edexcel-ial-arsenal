/* Atoms & Bonding Lab: 3D animated intermolecular forces (London cloud fluctuations, dipole alignment, H-bonding). */

import { Stage3D, THREE, label } from '../particles/gl';
import type { ImfKind } from './imf';

export interface ImfLook {
  kind: ImfKind;
  electrons: number;  // 1..3 scale for London cloud size
  playing: boolean;
}

export class ImfScene extends Stage3D<ImfLook> {
  #root = new THREE.Group();
  #lastKey = '';
  #cloudA: THREE.Mesh | null = null;
  #cloudB: THREE.Mesh | null = null;
  #bridge: THREE.Line | null = null;
  #molA = new THREE.Group();
  #molB = new THREE.Group();
  #t = 0;

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [0, 1.8, 7.2], target: [0, 0, 0], bloom: [0.48, 0.45, 0.72] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.78));
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
    this.#cloudA = null;
    this.#cloudB = null;
    this.#bridge = null;
  }

  #build(L: ImfLook) {
    this.#clear();
    this.#molA = new THREE.Group();
    this.#molB = new THREE.Group();
    this.#root.add(this.#molA, this.#molB);

    if (L.kind === 'london') {
      const sc = 0.85 + L.electrons * 0.22;
      const mkAtom = (grp: THREE.Group, x: number, tag: string) => {
        grp.position.set(x, 0, 0);
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(0.32 * sc, 22, 16),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3 }),
        );
        grp.add(core);
        const cloud = new THREE.Mesh(
          new THREE.SphereGeometry(1.05 * sc, 24, 18),
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.35,
            transparent: true, opacity: 0.32, roughness: 0.2, depthWrite: false,
          }),
        );
        grp.add(cloud);
        const lb = label(tag, 0.3, '#cbd5e1');
        lb.position.set(0, -1.55 * sc, 0);
        grp.add(lb);
        return cloud;
      };
      this.#cloudA = mkAtom(this.#molA, -2.15, 'Instantaneous dipole');
      this.#cloudB = mkAtom(this.#molB, 2.15, 'Induced dipole');

      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.9, 0, 0), new THREE.Vector3(0.9, 0, 0)]);
      const mat = new THREE.LineDashedMaterial({ color: 0xfbbf24, dashSize: 0.18, gapSize: 0.14 });
      this.#bridge = new THREE.Line(geo, mat);
      this.#bridge.computeLineDistances();
      this.#root.add(this.#bridge);
    } else if (L.kind === 'dipole') {
      const mkHCl = (grp: THREE.Group, x: number) => {
        grp.position.set(x, 0, 0);
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 }));
        h.position.set(-0.62, 0, 0);
        const cl = new THREE.Mesh(new THREE.SphereGeometry(0.56, 22, 16), new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.3 }));
        cl.position.set(0.52, 0, 0);
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.14, 12), new THREE.MeshStandardMaterial({ color: 0xcbd5e1 }));
        cyl.rotation.z = Math.PI / 2;
        cyl.position.set(-0.05, 0, 0);
        grp.add(h, cl, cyl);
        const l1 = label('H δ+', 0.28, '#bae6fd');
        l1.position.set(-0.62, 0.72, 0);
        const l2 = label('Cl δ−', 0.28, '#fca5a5');
        l2.position.set(0.52, 0.86, 0);
        grp.add(l1, l2);
      };
      mkHCl(this.#molA, -2.05);
      mkHCl(this.#molB, 2.05);

      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.95, 0, 0), new THREE.Vector3(1.08, 0, 0)]);
      const mat = new THREE.LineDashedMaterial({ color: 0xfbbf24, dashSize: 0.16, gapSize: 0.12 });
      this.#bridge = new THREE.Line(geo, mat);
      this.#bridge.computeLineDistances();
      this.#root.add(this.#bridge);
      const lb = label('Permanent dipole–dipole attraction', 0.28, '#fde68a');
      lb.position.set(0, -1.25, 0);
      this.#root.add(lb);
    } else {
      // Hydrogen bonding between two H2O molecules (O-H ··· :O)
      const mkWater = (grp: THREE.Group, x: number, flip: boolean) => {
        grp.position.set(x, 0, 0);
        const o = new THREE.Mesh(new THREE.SphereGeometry(0.46, 22, 16), new THREE.MeshStandardMaterial({ color: 0xf87171, roughness: 0.28 }));
        grp.add(o);
        const addH = (dx: number, dy: number) => {
          const p = new THREE.Vector3(dx, dy, 0);
          const h = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 12), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 }));
          h.position.copy(p);
          grp.add(h);
          const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, p.length(), 10), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
          cyl.position.copy(p).multiplyScalar(0.5);
          cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
          grp.add(cyl);
        };
        if (!flip) {
          addH(1.05, 0); // H pointing right towards neighbour's lone pair!
          addH(-0.27, 1.01);
        } else {
          addH(0.75, 0.72);
          addH(0.75, -0.72);
          // Visible lone pair dots facing left towards the incoming Hδ+
          for (const dy of [-0.14, 0.14]) {
            const e = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), new THREE.MeshBasicMaterial({ color: 0xf5d0fe }));
            e.position.set(-0.62, dy, 0);
            grp.add(e);
          }
        }
        const lo = label('O δ−', 0.26, '#fca5a5');
        lo.position.set(0, -0.82, 0);
        grp.add(lo);
      };
      mkWater(this.#molA, -1.95, false);
      mkWater(this.#molB, 1.55, true);

      const lh = label('H δ+', 0.26, '#bae6fd');
      lh.position.set(-0.9, 0.56, 0);
      this.#root.add(lh);

      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.6, 0, 0), new THREE.Vector3(0.82, 0, 0)]);
      const mat = new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.16, gapSize: 0.11 });
      this.#bridge = new THREE.Line(geo, mat);
      this.#bridge.computeLineDistances();
      this.#root.add(this.#bridge);

      const lb = label('Hydrogen bond (180°)', 0.28, '#7dd3fc');
      lb.position.set(0.1, -1.35, 0);
      this.#root.add(lb);
    }
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    const key = `${L.kind}:${L.electrons}`;
    if (key !== this.#lastKey) {
      this.#lastKey = key;
      this.#build(L);
    }
    if (L.playing) this.#t += dt;

    if (L.kind === 'london' && this.#cloudA && this.#cloudB) {
      const wave = Math.sin(this.#t * 2.4);
      // Electron clouds slosh synchronously (instantaneous -> induced dipole)
      this.#cloudA.position.x = wave * 0.36;
      this.#cloudB.position.x = wave * 0.32;
      const sx = 1 + Math.abs(wave) * 0.18;
      const sy = 1 - Math.abs(wave) * 0.08;
      this.#cloudA.scale.set(sx, sy, sy);
      this.#cloudB.scale.set(sx, sy, sy);
    } else if (L.kind === 'dipole') {
      const w = Math.sin(this.#t * 2.0) * 0.09;
      this.#molA.rotation.z = w;
      this.#molB.rotation.z = -w * 0.8;
    } else if (L.kind === 'hbond') {
      const w = Math.sin(this.#t * 2.2) * 0.08;
      this.#molB.position.x = 1.55 + w;
    }
  }
}
