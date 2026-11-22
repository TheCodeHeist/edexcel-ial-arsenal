/* Kinetics Lab, Rate equations: the rate surface in 3D.

   Over a floor of [A] (left to right, 0–1 mol dm⁻³) and [B] (front to back, 0–1 mol dm⁻³) the height is the rate,
   k[A]^m[B]^n, scaled so the corner [A] = [B] = 1 is always the same height (that height is k). Zero order in A makes
   the surface flat along [A]; first order, a straight ramp; second order, a curve that steepens. Two slices are lit:
   along [A] at the current [B] (the rate–[A] graph) and along [B] at the current [A]. A glowing bead rides the surface
   as the reaction runs, leaving a trail: with B in excess it slides straight down the [A] slice; without, both fall. */

import { THREE, Stage3D, label } from '../particles/gl';
import type { Ord } from './orders';

export interface OLook {
  m: Ord; n: Ord;
  A: number; B: number;          // the concentrations now
  A0: number; B0: number;
  path: number[];                // A, B pairs sampled along the run, up to now
  playing: boolean;
}

const S = 6, HMAX = 3.2, SEG = 48;
const X = (a: number) => a * S - S / 2;
const Z = (b: number) => S / 2 - b * S;
const Y = (m: Ord, n: Ord, a: number, b: number) => HMAX * (a <= 0 && m > 0 ? 0 : Math.pow(Math.max(0, a), m)) * (b <= 0 && n > 0 ? 0 : Math.pow(Math.max(0, b), n));

const heat = (u: number) => {
  // deep blue → cyan → amber → rose, by height
  const stops: [number, number, number, number][] = [[0, 0.12, 0.2, 0.55], [0.35, 0.1, 0.65, 0.85], [0.7, 0.98, 0.72, 0.25], [1, 1.0, 0.35, 0.5]];
  for (let i = 1; i < stops.length; i++) if (u <= stops[i][0]) {
    const [u0, r0, g0, b0] = stops[i - 1], [u1, r1, g1, b1] = stops[i], f = (u - u0) / (u1 - u0);
    return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f];
  }
  return [1, 0.35, 0.5];
};

export class RateSurfaceScene extends Stage3D<OLook> {
  #surf: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  #wire: THREE.LineSegments;
  #sliceA: THREE.Line;
  #sliceB: THREE.Line;
  #trail: THREE.Line;
  #bead: THREE.Mesh;
  #glow: THREE.Sprite;
  #drop: THREE.Line;
  #shape = '';
  #slice = '';

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [-6.2, 6.4, 8.2], target: [0, 1.2, 0], bloom: [0.55, 0.45, 0.7], fov: 42 });
    this.scene.add(new THREE.AmbientLight(0x9aa4c8, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-5, 9, 6); this.scene.add(sun);
    const back = new THREE.DirectionalLight(0x8fb0ff, 0.6); back.position.set(6, 4, -6); this.scene.add(back);

    // floor grid and axes
    const grid = new THREE.GridHelper(S, 10, 0x34405e, 0x232b40); grid.position.y = -0.01; this.scene.add(grid);
    const axMat = new THREE.LineBasicMaterial({ color: 0xc8d2ec });
    const axes = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([
      X(0), 0, Z(0), X(1.08), 0, Z(0),
      X(0), 0, Z(0), X(0), 0, Z(1.08),
      X(0), 0, Z(0), X(0), HMAX * 1.15, Z(0),
    ], 3));
    this.scene.add(new THREE.LineSegments(axes, axMat));
    const cone = (x: number, y: number, z: number, rx: number, rz: number) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 12), new THREE.MeshBasicMaterial({ color: 0xc8d2ec }));
      c.position.set(x, y, z); c.rotation.set(rx, 0, rz); this.scene.add(c);
    };
    cone(X(1.08), 0, Z(0), 0, -Math.PI / 2); cone(X(0), 0, Z(1.08), -Math.PI / 2, 0); cone(X(0), HMAX * 1.15, Z(0), 0, 0);
    const lab = (t: string, x: number, y: number, z: number, h = 0.3, c = '#dfe6ff') => { const l = label(t, h, c); l.position.set(x, y, z); this.scene.add(l); };
    lab('[A] / mol dm⁻³', X(0.8), -0.35, Z(0) + 0.6);
    lab('[B] / mol dm⁻³', X(0) - 1.0, -0.35, Z(0.75));
    lab('rate', X(0) - 0.35, HMAX * 1.22, Z(0));
    for (const v of [0.5, 1]) { lab(`${v}`, X(v), -0.25, Z(0) + 0.28, 0.24, '#aab4d4'); lab(`${v}`, X(0) - 0.3, -0.25, Z(v), 0.24, '#aab4d4'); }
    lab('k', X(0) - 0.3, HMAX, Z(0), 0.26, '#aab4d4');
    const kt = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([X(0) - 0.1, HMAX, Z(0), X(0) + 0.1, HMAX, Z(0)], 3));
    this.scene.add(new THREE.LineSegments(kt, axMat));

    // the surface
    const geo = new THREE.PlaneGeometry(S, S, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    this.#surf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide, transparent: true, opacity: 0.88 }));
    this.#wire = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 }));
    this.#sliceA = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffe08a }));
    this.#sliceB = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff9ac8 }));
    this.#trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.#bead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.5, 1.2) }));
    this.#glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xfff2c8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.#glow.scale.setScalar(1.1);
    this.#drop = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xdfe6ff, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.7 }));
    this.scene.add(this.#surf, this.#wire, this.#sliceA, this.#sliceB, this.#trail, this.#drop, this.#bead, this.#glow);
    this.start();
  }

  #build(m: Ord, n: Ord) {
    const g = this.#surf.geometry, p = g.attributes.position as THREE.BufferAttribute, c = g.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const a = (p.getX(i) + S / 2) / S, b = (S / 2 - p.getZ(i)) / S;
      const y = Y(m, n, a, b);
      p.setY(i, y);
      const [r, gg, bb] = heat(y / HMAX);
      c.setXYZ(i, r, gg, bb);
    }
    p.needsUpdate = true; c.needsUpdate = true;
    g.computeVertexNormals();
    const w: number[] = [];
    for (let k = 0; k <= 10; k++) {
      const v = k / 10;
      for (let j = 0; j < 40; j++) {
        const u0 = j / 40, u1 = (j + 1) / 40;
        w.push(X(u0), Y(m, n, u0, v) + 0.005, Z(v), X(u1), Y(m, n, u1, v) + 0.005, Z(v));
        w.push(X(v), Y(m, n, v, u0) + 0.005, Z(u0), X(v), Y(m, n, v, u1) + 0.005, Z(u1));
      }
    }
    this.#wire.geometry.dispose();
    this.#wire.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(w, 3));
  }

  #slices(L: OLook) {
    const pa: THREE.Vector3[] = [], pb: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      pa.push(new THREE.Vector3(X(u), Y(L.m, L.n, u, L.B) + 0.02, Z(L.B)));
      pb.push(new THREE.Vector3(X(L.A), Y(L.m, L.n, L.A, u) + 0.02, Z(u)));
    }
    this.#sliceA.geometry.dispose(); this.#sliceA.geometry = new THREE.BufferGeometry().setFromPoints(pa);
    this.#sliceB.geometry.dispose(); this.#sliceB.geometry = new THREE.BufferGeometry().setFromPoints(pb);
  }

  protected update() {
    const L = this.look!;
    const sk = `${L.m}|${L.n}`;
    if (sk !== this.#shape) { this.#shape = sk; this.#build(L.m, L.n); this.#slice = ''; }
    const ck = `${sk}|${L.A.toFixed(3)}|${L.B.toFixed(3)}|${L.path.length}`;
    if (ck !== this.#slice) {
      this.#slice = ck;
      this.#slices(L);
      const tp: THREE.Vector3[] = [];
      for (let i = 0; i + 1 < L.path.length; i += 2) tp.push(new THREE.Vector3(X(L.path[i]), Y(L.m, L.n, L.path[i], L.path[i + 1]) + 0.04, Z(L.path[i + 1])));
      tp.push(new THREE.Vector3(X(L.A), Y(L.m, L.n, L.A, L.B) + 0.04, Z(L.B)));
      this.#trail.geometry.dispose(); this.#trail.geometry = new THREE.BufferGeometry().setFromPoints(tp);
      const y = Y(L.m, L.n, L.A, L.B);
      this.#bead.position.set(X(L.A), y + 0.1, Z(L.B));
      this.#glow.position.copy(this.#bead.position);
      this.#drop.geometry.dispose();
      this.#drop.geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(X(L.A), 0, Z(L.B)), new THREE.Vector3(X(L.A), y, Z(L.B))]);
      this.#drop.computeLineDistances();
    }
    const pulse = 1 + 0.12 * Math.sin(this.time.value * 4);
    this.#glow.scale.setScalar(1.1 * pulse);
  }
}
