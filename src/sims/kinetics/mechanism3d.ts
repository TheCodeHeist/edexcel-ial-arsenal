/* Kinetics Lab, Mechanisms: SN2 and SN1 in 3D, ball and stick (1 world unit = 1 Å).

   SN2, bromoethane + OH⁻: the hydroxide ion comes in from the side opposite the bromine (backside attack); at the
   transition state the carbon has five partial or full bonds, with the three other groups flat between HO and Br;
   then Br⁻ leaves and the three groups flip over like an umbrella in the wind (inversion). One step.

   SN1, 2-bromo-2-methylpropane + OH⁻: the C–Br bond breaks on its own (slow), leaving a flat (trigonal planar)
   tertiary carbocation; OH⁻ then attacks it (fast) from either face.

   The carbon is at the origin, Br on +x. The three other groups lie on a cone round the x-axis at angle θ from +x:
   109.5° (tetrahedral, leaning away from Br), 90° (flat), 70.5° (inverted). Partial bonds are drawn dashed; curly
   arrows are gold tubes with a cone for a head, shown just before the electrons move. */

import { THREE, Stage3D, label } from '../particles/gl';

export interface MLook { sn: 'sn2' | 'sn1'; side: 'back' | 'front'; p: number }

const COL = { C: 0x6f7787, H: 0xf2f4f8, O: 0xe5483f, Br: 0xa3482a };
const RAD = { C: 0.36, H: 0.22, O: 0.34, Br: 0.48 };
type El = keyof typeof COL;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));
const ease = (f: number) => f * f * (3 - 2 * f);
const DEG = Math.PI / 180;
const TET = 109.47, INV = 180 - TET;

/** direction of substituent i (0–2) on a cone of half-angle θ (degrees) about +x */
const cone = (theta: number, i: number) => { const t = theta * DEG, phi = (90 + i * 120) * DEG; return V(Math.cos(t), Math.sin(t) * Math.sin(phi), Math.sin(t) * Math.cos(phi)); };
/** three H on a methyl carbon at m, bonded back along -dir */
function methylH(m: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3[] {
  const d = dir.clone().normalize();
  const a = Math.abs(d.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  const u = a.clone().cross(d).normalize(), w = d.clone().cross(u);
  const c = Math.cos(INV * DEG), sn = Math.sin(INV * DEG);
  return [0, 1, 2].map((i) => {
    const phi = (i * 120 + 30) * DEG;
    const h = d.clone().multiplyScalar(c).add(u.clone().multiplyScalar(sn * Math.cos(phi))).add(w.clone().multiplyScalar(sn * Math.sin(phi)));
    return m.clone().add(h.multiplyScalar(1.09));
  });
}

interface BondMesh { g: THREE.Group; parts: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>[] }

export class MechScene extends Stage3D<MLook> {
  #atoms: { m: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>; el: El }[] = [];
  #bonds: BondMesh[] = [];
  #cyl = new THREE.CylinderGeometry(0.075, 0.075, 1, 12);
  #arrows = new THREE.Group();
  #arrowMat = new THREE.MeshStandardMaterial({ color: 0xffc34d, emissive: 0x6a4000, roughness: 0.4 });
  #tags: Record<string, THREE.Sprite> = {};
  #sn = '';
  #mol = new THREE.Group();

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [-1.2, 3.2, 10.5], target: [0.6, 0, 0], bloom: [0.35, 0.4, 0.85], fov: 42 });
    this.scene.add(new THREE.AmbientLight(0xaab4d6, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 6, 8); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 1.0); rim.position.set(4, -2, -6); this.scene.add(rim);
    const grid = new THREE.GridHelper(20, 20, 0x223048, 0x161e2e); grid.position.y = -3.2; this.scene.add(grid);
    this.scene.add(this.#mol, this.#arrows);
    const tag = (k: string, t: string, c: string, h = 0.42) => { const s = label(t, h, c); s.visible = false; this.#tags[k] = s; this.scene.add(s); };
    tag('dp', 'δ+', '#ffd58a'); tag('dm', 'δ−', '#ffd58a'); tag('ohm', '−', '#9fd0ff', 0.5); tag('plus', '+', '#ffd58a', 0.55);
    tag('brm', 'Br⁻', '#ffb39a'); tag('ts', '[ HO···C···Br ]‡⁻  transition state', '#e9ddff', 0.38); tag('cat', 'carbocation: flat, 120°', '#e9ddff', 0.38);
    tag('oh', 'OH⁻', '#9fd0ff'); tag('slow', 'slow', '#ffb08a', 0.36); tag('fast', 'fast', '#8affc0', 0.36);
    this.start();
  }

  #atom(el: El) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(RAD[el], 28, 20), new THREE.MeshStandardMaterial({ color: COL[el], roughness: 0.35, metalness: 0.05, transparent: true }));
    this.#mol.add(m); this.#atoms.push({ m, el }); return m;
  }
  #bond() {
    const g = new THREE.Group(), parts: BondMesh['parts'] = [];
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(this.#cyl, new THREE.MeshStandardMaterial({ color: 0xc9cfdc, roughness: 0.5, transparent: true })); g.add(c); parts.push(c); }
    this.#mol.add(g); const b = { g, parts }; this.#bonds.push(b); return b;
  }
  /** a bond of strength s: 0 none, ½ partial (dashed), 1 full */
  #setBond(b: BondMesh, a: THREE.Vector3, c: THREE.Vector3, s: number) {
    b.g.visible = s > 0.04;
    if (!b.g.visible) return;
    const d = c.clone().sub(a), L = d.length();
    if (!(L > 1e-6)) { b.g.visible = false; return; }
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
    const full = s > 0.92, fill = full ? 1 : 0.5;
    b.parts.forEach((m, i) => {
      const mid = a.clone().add(d.clone().multiplyScalar((i + 0.5) / 5));
      m.position.copy(mid); m.quaternion.copy(q);
      m.scale.set(full ? 1 : 0.8, (L / 5) * fill + (full ? 0.002 : 0), full ? 1 : 0.8);
      m.material.opacity = Math.min(1, s * 1.8);
    });
  }

  #build(sn: string) {
    for (const a of this.#atoms) { a.m.geometry.dispose(); a.m.material.dispose(); }
    for (const b of this.#bonds) for (const m of b.parts) m.material.dispose();
    this.#mol.clear(); this.#atoms = []; this.#bonds = [];
    // atoms: 0 C, 1 Br, 2 O, 3 H(of OH), then 3 substituents (+ their H’s)
    this.#atom('C'); this.#atom('Br'); this.#atom('O'); this.#atom('H');
    if (sn === 'sn2') { this.#atom('C'); this.#atom('H'); this.#atom('H'); for (let i = 0; i < 3; i++) this.#atom('H'); }
    else { for (let k = 0; k < 3; k++) { this.#atom('C'); for (let i = 0; i < 3; i++) this.#atom('H'); } }
    const nb = sn === 'sn2' ? 3 + 3 + 3 : 3 + 3 + 9;
    for (let i = 0; i < nb; i++) this.#bond();
  }

  #curl(from: THREE.Vector3, to: THREE.Vector3, lift: THREE.Vector3) {
    const mid = from.clone().add(to).multiplyScalar(0.5).add(lift);
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.045, 8, false), this.#arrowMat);
    const tan = curve.getTangent(1);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 14), this.#arrowMat);
    head.position.copy(to); head.quaternion.setFromUnitVectors(V(0, 1, 0), tan.normalize());
    this.#arrows.add(tube, head);
  }
  #clearArrows() {
    for (const c of this.#arrows.children) { const m = c as THREE.Mesh; m.geometry.dispose(); }
    this.#arrows.clear();
  }

  protected update() {
    const L = this.look!;
    const p = Number.isFinite(L.p) ? Math.min(1, Math.max(0, L.p)) : 0;
    if (L.sn !== this.#sn) { this.#sn = L.sn; this.#build(L.sn); }
    const A = this.#atoms.map((a) => a.m.position);
    const C = V();
    let theta = TET, brD = 1.94, brDrop = 0, oD = 6.5, co = 0, cbr = 1;
    let side = -1;                                   // OH⁻ comes in along −x (backside) unless SN1 front attack
    const T = this.#tags;
    for (const k in T) T[k].visible = false;
    this.#clearArrows();

    if (L.sn === 'sn2') {
      const a = ease(seg(p, 0, 0.22)), b = ease(seg(p, 0.22, 0.5)), c = ease(seg(p, 0.5, 0.75)), d = ease(seg(p, 0.75, 1));
      oD = lerp(6.5, 3.4, a); oD = lerp(oD, 2.05, b); oD = lerp(oD, 1.43, c);
      brD = lerp(1.94, 2.5, b); brD = lerp(brD, 3.5, c); brD = lerp(brD, 6.2, d);
      theta = lerp(TET, 90, b); theta = lerp(theta, INV, c);
      co = lerp(0, 0.5, b); co = lerp(co, 1, c);
      cbr = lerp(1, 0.5, b); cbr = lerp(cbr, 0, c);
      if (p > 0.42 && p < 0.6) { T.ts.visible = true; T.ts.position.set(0.3, 2.3, 0); }
      if (p < 0.4) { T.dp.visible = T.dm.visible = true; }
    } else {
      side = L.side === 'back' ? -1 : 1;
      const a = ease(seg(p, 0.12, 0.45)), b = ease(seg(p, 0.45, 0.6)), c = ease(seg(p, 0.6, 0.85));
      brD = lerp(1.94, 5.2, a); brDrop = lerp(0, 2.4, a);
      theta = lerp(TET, 90, a);
      cbr = a < 0.5 ? lerp(1, 0.5, a * 2) : lerp(0.5, 0, (a - 0.5) * 2);
      oD = lerp(7.5, 3.4, b); oD = lerp(oD, 1.43, c);
      co = c < 0.5 ? lerp(0, 0.5, c * 2) : lerp(0.5, 1, (c - 0.5) * 2);
      theta = lerp(theta, side < 0 ? INV : TET, c);
      if (p > 0.38 && p < 0.7) { T.plus.visible = true; T.plus.position.set(-0.1, 0.75, 0.35); T.cat.visible = p < 0.6; T.cat.position.set(0, -2.5, 0.6); }
      if (p < 0.12) { T.dp.visible = T.dm.visible = true; }
      T.slow.visible = p > 0.08 && p < 0.47; T.slow.position.set(2.6, 1.6, 0);
      T.fast.visible = p >= 0.47 && p < 0.9; T.fast.position.set(side * 2.4, 1.6, 0);
    }

    // place the atoms
    A[0].copy(C);
    A[1].set(brD, -brDrop, 0);
    const oPos = V(side * oD, 0, 0);
    A[2].copy(oPos);
    A[3].copy(oPos.clone().add(V(side * 0.6, 0.76, 0)));
    const dirs = [0, 1, 2].map((i) => cone(theta, i));
    let ai = 4, bi = 0;
    const B = this.#bonds;
    this.#setBond(B[bi++], C, A[1], cbr);
    this.#setBond(B[bi++], C, A[2], co);
    this.#setBond(B[bi++], A[2], A[3], 1);
    if (L.sn === 'sn2') {
      const m = dirs[0].clone().multiplyScalar(1.53);
      A[ai++].copy(m);
      const h1 = dirs[1].clone().multiplyScalar(1.09), h2 = dirs[2].clone().multiplyScalar(1.09);
      A[ai++].copy(h1); A[ai++].copy(h2);
      const mh = methylH(m, dirs[0]);
      for (const h of mh) A[ai++].copy(h);
      this.#setBond(B[bi++], C, m, 1); this.#setBond(B[bi++], C, h1, 1); this.#setBond(B[bi++], C, h2, 1);
      for (const h of mh) this.#setBond(B[bi++], m, h, 1);
    } else {
      for (let k = 0; k < 3; k++) {
        const m = dirs[k].clone().multiplyScalar(1.53);
        A[ai++].copy(m);
        const mh = methylH(m, dirs[k]);
        for (const h of mh) A[ai++].copy(h);
        this.#setBond(B[bi++], C, m, 1);
        for (const h of mh) this.#setBond(B[bi++], m, h, 1);
      }
    }
    // the OH⁻ and Br labels
    if (co < 0.25) { T.ohm.visible = true; T.ohm.position.copy(oPos).add(V(-0.1 * side, -0.62, 0.3)); T.oh.visible = true; T.oh.position.copy(oPos).add(V(0, -1.2, 0)); }
    if (cbr < 0.2 && brD > 3) { T.brm.visible = true; T.brm.position.copy(A[1]).add(V(0, 0.85, 0)); }
    if (T.dp.visible) { T.dp.position.set(0.25, 0.5, 0.55); T.dm.position.copy(A[1]).add(V(0, 0.8, 0)); }
    this.#atoms[2].m.material.opacity = 1;

    // curly arrows, just before the electrons move
    const lp = oPos.clone().add(V(-side * 0.45, 0.42, 0.15));
    if (L.sn === 'sn2' && p > 0.05 && p < 0.34) {
      this.#curl(lp, V(side * 0.45, 0.05, 0), V(0, 1.0, 0.4));
      this.#curl(V(brD * 0.45, 0.12, 0.1), A[1].clone().add(V(-0.05, 0.5, 0)), V(0, 0.8, 0.3));
    }
    if (L.sn === 'sn1') {
      if (p > 0.01 && p < 0.2) this.#curl(V(brD * 0.45, 0.12, 0.1), A[1].clone().add(V(-0.05, 0.5, 0)), V(0, 0.8, 0.3));
      if (p > 0.5 && p < 0.64) this.#curl(lp, V(side * 0.42, 0.05, 0), V(0, 1.0, 0.4));
    }
  }

  dispose() { this.#clearArrows(); this.#cyl.dispose(); this.#arrowMat.dispose(); super.dispose(); }
}
