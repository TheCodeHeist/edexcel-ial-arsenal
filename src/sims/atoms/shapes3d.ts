/* Atoms & Bonding Lab: 3D VSEPR molecule & polarity stage (extends Particle Lab's Stage3D). */

import { Stage3D, THREE, label } from '../particles/gl';
import { ATOM_HEX, ATOM_R, EN } from './consts';
import type { BondSpec, Vec3 } from './shapes';
import { netDipole } from './shapes';

export interface ShapeLook {
  key: string;
  central: string;
  bonds: BondSpec[];
  lones: Vec3[];
  showLP: boolean;
  showAngles: boolean;
  showDipoles: boolean;
  angleText: string;
}

const BOND_LEN = 2.05;

export class ShapesScene extends Stage3D<ShapeLook> {
  #root = new THREE.Group();
  #lastKey = '';
  #lpGroup = new THREE.Group();
  #angleGroup = new THREE.Group();
  #dipoleGroup = new THREE.Group();

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [0, 2.2, 6.8], target: [0, 0, 0], bloom: [0.42, 0.4, 0.78] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(5, 8, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7aa2f7, 0.65);
    rim.position.set(-6, -4, -5);
    this.scene.add(rim);
    this.scene.add(this.#root);
    this.start();
  }

  #clearGroup(g: THREE.Group) {
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

  #rebuild(L: ShapeLook) {
    this.#clearGroup(this.#root);
    this.#lpGroup = new THREE.Group();
    this.#angleGroup = new THREE.Group();
    this.#dipoleGroup = new THREE.Group();

    const cR = ATOM_R[L.central] ?? 0.54;
    const cCol = ATOM_HEX[L.central] ?? 0x94a3b8;
    const cMat = new THREE.MeshStandardMaterial({ color: cCol, roughness: 0.28, metalness: 0.15 });
    const cMesh = new THREE.Mesh(new THREE.SphereGeometry(cR, 28, 20), cMat);
    this.#root.add(cMesh);

    const cLab = label(L.central, 0.36, '#ffffff');
    cLab.position.set(0, cR + 0.36, 0);
    this.#root.add(cLab);

    const up = new THREE.Vector3(0, 1, 0);
    const enC = EN[L.central] ?? 2.2;

    // Bonds + outer atoms
    for (const b of L.bonds) {
      const dir = new THREE.Vector3(...b.dir).normalize();
      const end = dir.clone().multiplyScalar(BOND_LEN);
      const oR = ATOM_R[b.el] ?? 0.46;
      const oCol = ATOM_HEX[b.el] ?? 0x7dd3fc;

      const atom = new THREE.Mesh(
        new THREE.SphereGeometry(oR, 24, 18),
        new THREE.MeshStandardMaterial({ color: oCol, roughness: 0.28, metalness: 0.12 }),
      );
      atom.position.copy(end);
      this.#root.add(atom);

      const oLab = label(b.el, 0.32, '#e2e8f0');
      oLab.position.copy(dir.clone().multiplyScalar(BOND_LEN + oR + 0.28));
      this.#root.add(oLab);

      // Cylinder(s) for single/double/triple bond
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
      const perp = new THREE.Vector3(0, 0, 1);
      if (Math.abs(dir.dot(perp)) > 0.9) perp.set(1, 0, 0);
      perp.cross(dir).normalize();

      const offsets = b.order === 1 ? [0] : b.order === 2 ? [-0.11, 0.11] : [-0.14, 0, 0.14];
      for (const off of offsets) {
        const cyl = new THREE.Mesh(
          new THREE.CylinderGeometry(b.order === 1 ? 0.085 : 0.06, b.order === 1 ? 0.085 : 0.06, BOND_LEN, 14),
          new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.2 }),
        );
        cyl.position.copy(end.clone().multiplyScalar(0.5)).addScaledVector(perp, off);
        cyl.quaternion.copy(q);
        this.#root.add(cyl);
      }

      // Bond dipole arrow (if ΔEN >= 0.35)
      const enB = EN[b.el] ?? 3.2;
      const dEN = enB - enC;
      if (Math.abs(dEN) >= 0.35) {
        const sign = dEN > 0 ? 1 : -1;
        const aDir = dir.clone().multiplyScalar(sign);
        const start = dir.clone().multiplyScalar(BOND_LEN * 0.5).addScaledVector(perp, 0.36).addScaledVector(aDir, -0.45);
        const arrow = new THREE.ArrowHelper(aDir, start, 0.9, 0x38bdf8, 0.24, 0.14);
        this.#dipoleGroup.add(arrow);
      }
    }

    // Net molecular dipole arrow (gold/amber, prominent)
    const net = netDipole(L.central, L.bonds);
    if (net.mag > 0.15) {
      const nDir = new THREE.Vector3(...net.vec).normalize();
      const arrow = new THREE.ArrowHelper(nDir, nDir.clone().multiplyScalar(-0.3), 2.55, 0xfbbf24, 0.42, 0.24);
      this.#dipoleGroup.add(arrow);
      const dLab = label('Net dipole → δ−', 0.32, '#fde68a');
      dLab.position.copy(nDir.clone().multiplyScalar(2.65));
      this.#dipoleGroup.add(dLab);
    }

    // Lone-pair lobes (translucent pear cloud + two glowing electrons)
    for (const lp of L.lones) {
      const dir = new THREE.Vector3(...lp).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
      const g = new THREE.Group();
      g.quaternion.copy(q);

      const lobeGeo = new THREE.SphereGeometry(0.56, 20, 16);
      lobeGeo.scale(0.82, 1.35, 0.82);
      const lobe = new THREE.Mesh(
        lobeGeo,
        new THREE.MeshStandardMaterial({
          color: 0xc084fc, emissive: 0x7e22ce, emissiveIntensity: 0.45,
          transparent: true, opacity: 0.34, roughness: 0.2, depthWrite: false,
        }),
      );
      lobe.position.set(0, 1.15, 0);
      g.add(lobe);

      for (const sx of [-0.18, 0.18]) {
        const e = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 14, 12),
          new THREE.MeshBasicMaterial({ color: 0xf5d0fe }),
        );
        e.position.set(sx, 1.35, 0);
        g.add(e);
      }
      this.#lpGroup.add(g);
    }

    // Bond angle arc between first two bonds
    if (L.bonds.length >= 2) {
      const a = new THREE.Vector3(...L.bonds[0].dir).normalize();
      const b = new THREE.Vector3(...L.bonds[1].dir).normalize();
      const pts: THREE.Vector3[] = [];
      const steps = 24;
      const rad = 1.18;
      // Handle 180° linear case cleanly
      const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
      if (dot < -0.999) {
        for (let i = 0; i <= steps; i++) {
          const t = (i / steps) * Math.PI;
          pts.push(new THREE.Vector3(-Math.cos(t) * rad, Math.sin(t) * rad, 0));
        }
      } else {
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          pts.push(new THREE.Vector3().lerpVectors(a, b, t).normalize().multiplyScalar(rad));
        }
      }
      const arcGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const arc = new THREE.Line(arcGeo, new THREE.LineBasicMaterial({ color: 0xfde047 }));
      this.#angleGroup.add(arc);
      const mid = pts[Math.floor(pts.length / 2)].clone().multiplyScalar(1.28);
      const aLab = label(L.angleText, 0.34, '#fef08a');
      aLab.position.copy(mid);
      this.#angleGroup.add(aLab);
    }

    this.#root.add(this.#lpGroup);
    this.#root.add(this.#angleGroup);
    this.#root.add(this.#dipoleGroup);
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    if (L.key !== this.#lastKey) {
      this.#lastKey = L.key;
      this.#rebuild(L);
    }
    this.#lpGroup.visible = L.showLP;
    this.#angleGroup.visible = L.showAngles;
    this.#dipoleGroup.visible = L.showDipoles;
    // Gentle breathing shimmer on lone-pair lobes
    if (L.showLP) {
      const s = 1 + Math.sin(this.time.value * 2.6) * 0.035;
      this.#lpGroup.scale.setScalar(s);
    }
    void dt;
  }
}
