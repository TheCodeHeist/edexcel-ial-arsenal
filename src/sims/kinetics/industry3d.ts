/* Kinetics Lab, Industry tab: the 3D view. The equilibrium yield as a landscape over temperature (across) and
   pressure (into the screen), computed point by point from K_p(T). The surface can be coloured by yield, by rate or by
   cost, so the compromise can be seen: the high ground (best yield) is cold and slow, the fast corner is hot and gives
   little. A glowing marker stands at the chosen conditions, with drop lines to the floor; a gold ring marks the
   conditions used in industry. */

import { THREE, Stage3D, label } from '../particles/gl';
import { PROCS, yieldAt, rateRel, costRel, type Proc } from './industry';

export interface ILook { proc: string; measure: 'frac' | 'conv'; colour: 'yield' | 'rate' | 'cost'; T: number; P: number }

const W = 8, D = 8, H = 4, N = 56;

/** A perceptual-ish ramp (deep blue → teal → yellow). */
function ramp(t: number, c: THREE.Color) {
  t = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const stops: [number, number, number][] = [[0.18, 0.12, 0.42], [0.13, 0.4, 0.62], [0.13, 0.66, 0.55], [0.55, 0.82, 0.3], [0.99, 0.88, 0.25]];
  const s = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(s)), f = s - i;
  c.setRGB(stops[i][0] + (stops[i + 1][0] - stops[i][0]) * f, stops[i][1] + (stops[i + 1][1] - stops[i][1]) * f, stops[i][2] + (stops[i + 1][2] - stops[i][2]) * f);
  return c;
}

export class IndustryScene extends Stage3D<ILook> {
  #surf: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  #wire: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  #axes = new THREE.Group();
  #ball: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  #glow: THREE.Sprite;
  #drop: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  #ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  #key = '';
  #ckey = '';
  #y: Float32Array = new Float32Array((N + 1) * (N + 1));
  #p: Proc = PROCS[0];
  #t = 0;

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [8.6, 7.6, 11.2], target: [0, 1.0, 0], bloom: [0.6, 0.45, 0.82], fov: 42 });
    this.scene.add(new THREE.AmbientLight(0xb8c0dc, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-4, 10, 6); this.scene.add(sun);
    const g = new THREE.PlaneGeometry(W, D, N, N);
    g.rotateX(-Math.PI / 2);
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(3 * (N + 1) * (N + 1)), 3));
    this.#surf = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.05, transparent: true, opacity: 0.94 }));
    this.#wire = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 }));
    this.#ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.#glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xff7ad0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.#glow.scale.setScalar(1.2);
    this.#drop = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(18), 3)), new THREE.LineBasicMaterial({ color: 0xff9ad8, transparent: true, opacity: 0.8 }));
    this.#ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 10, 40), new THREE.MeshBasicMaterial({ color: 0xffc94a }));
    this.#ring.rotation.x = Math.PI / 2;
    this.scene.add(this.#surf, this.#wire, this.#axes, this.#ball, this.#glow, this.#drop, this.#ring);
    this.start();
  }

  #xOf = (Tc: number) => ((Tc - this.#p.Tr[0]) / (this.#p.Tr[1] - this.#p.Tr[0]) - 0.5) * W;
  #zOf = (P: number) => (0.5 - (P - this.#p.Pr[0]) / (this.#p.Pr[1] - this.#p.Pr[0])) * D;

  #build(L: ILook) {
    const p = this.#p = PROCS.find((x) => x.id === L.proc) ?? PROCS[0];
    const pos = this.#surf.geometry.getAttribute('position') as THREE.BufferAttribute;
    const lines: number[] = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const k = j * (N + 1) + i;
      const Tc = p.Tr[0] + (i / N) * (p.Tr[1] - p.Tr[0]);
      const P = p.Pr[1] - (j / N) * (p.Pr[1] - p.Pr[0]);           // plane rows run from −z (far) to +z (near)
      const y = yieldAt(p, Tc + 273, P), v = L.measure === 'frac' ? y.frac : y.conv;
      const h = Number.isFinite(v) ? v : 0;
      this.#y[k] = h;
      pos.setY(k, h * H);
    }
    pos.needsUpdate = true;
    this.#surf.geometry.computeVertexNormals();
    // contour-like mesh lines every 8 cells
    for (let j = 0; j <= N; j += 8) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; lines.push(pos.getX(a), pos.getY(a) + 0.01, pos.getZ(a), pos.getX(a + 1), pos.getY(a + 1) + 0.01, pos.getZ(a + 1)); }
    for (let i = 0; i <= N; i += 8) for (let j = 0; j < N; j++) { const a = j * (N + 1) + i, b = a + N + 1; lines.push(pos.getX(a), pos.getY(a) + 0.01, pos.getZ(a), pos.getX(b), pos.getY(b) + 0.01, pos.getZ(b)); }
    this.#wire.geometry.dispose();
    this.#wire.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    // axes and labels
    this.#axes.traverse((o) => { const s = o as THREE.Sprite; if (s.isSprite) { s.material.map?.dispose(); s.material.dispose(); } });
    this.#axes.clear();
    const ax: number[] = [], x0 = -W / 2, z0 = D / 2;
    ax.push(x0, 0, z0, W / 2, 0, z0, x0, 0, z0, x0, 0, -D / 2, x0, 0, -D / 2, x0, H, -D / 2);
    for (let f = 0; f <= 1.0001; f += 0.25) ax.push(x0, f * H, -D / 2, W / 2, f * H, -D / 2, x0, f * H, -D / 2, x0, f * H, D / 2);
    this.#axes.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(ax, 3)), new THREE.LineBasicMaterial({ color: 0x5a6688, transparent: true, opacity: 0.7 })));
    const add = (t: string, x: number, y: number, z: number, h = 0.3, c = '#cdd5ea') => { const s = label(t, h, c); s.position.set(x, y, z); this.#axes.add(s); };
    const nice = (a: number, b: number) => { const raw = (b - a) / 5, m = 10 ** Math.floor(Math.log10(raw)), f = raw / m; const st = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * m; const out: number[] = []; for (let v = Math.ceil(a / st) * st; v <= b + 1e-9; v += st) out.push(Number(v.toPrecision(6))); return out; };
    for (const Tc of nice(p.Tr[0], p.Tr[1])) add(`${Tc}`, this.#xOf(Tc), -0.05, z0 + 0.5, 0.26);
    for (const P of nice(p.Pr[0], p.Pr[1])) add(`${P}`, W / 2 + 0.55, -0.05, this.#zOf(P), 0.26);
    add('temperature / °C', 0, -0.6, z0 + 1.5, 0.34, '#ffffff');
    add('pressure / atm', W / 2 + 1.7, -0.6, 0, 0.34, '#ffffff');
    for (let f = 0.25; f <= 1.0001; f += 0.25) add(`${Math.round(f * 100)}%`, x0 - 0.45, f * H, -D / 2, 0.26);
    add(L.measure === 'frac' ? `% ${p.product} at equilibrium` : '% converted', x0 - 0.2, H + 0.5, -D / 2, 0.32, '#ffffff');
    // the real conditions
    this.#ring.position.set(this.#xOf(p.real.T), this.#height(p.real.T, p.real.P) + 0.02, this.#zOf(p.real.P));
    add('used in industry', this.#ring.position.x, this.#ring.position.y + 0.55, this.#ring.position.z, 0.26, '#ffd27a');
  }

  #height(Tc: number, P: number) {
    const p = this.#p;
    const i = ((Tc - p.Tr[0]) / (p.Tr[1] - p.Tr[0])) * N, j = ((p.Pr[1] - P) / (p.Pr[1] - p.Pr[0])) * N;
    const i0 = Math.max(0, Math.min(N - 1, Math.floor(i))), j0 = Math.max(0, Math.min(N - 1, Math.floor(j)));
    const fi = Math.max(0, Math.min(1, i - i0)), fj = Math.max(0, Math.min(1, j - j0));
    const y = (a: number, b: number) => this.#y[b * (N + 1) + a];
    const v = (y(i0, j0) * (1 - fi) + y(i0 + 1, j0) * fi) * (1 - fj) + (y(i0, j0 + 1) * (1 - fi) + y(i0 + 1, j0 + 1) * fi) * fj;
    return Number.isFinite(v) ? v * H : 0;
  }

  #paint(L: ILook) {
    const p = this.#p, col = this.#surf.geometry.getAttribute('color') as THREE.BufferAttribute, c = new THREE.Color();
    // rate and cost on log scales across the whole surface
    const lr = (Tc: number, P: number) => Math.log10(Math.max(1e-30, rateRel(p, Tc, P)));
    const lo = lr(p.Tr[0], p.Pr[0]), hi = lr(p.Tr[1], p.Pr[1]);
    const cmax = costRel(p, p.Tr[1], p.Pr[1]), cmin = costRel(p, p.Tr[0], p.Pr[0]);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const k = j * (N + 1) + i;
      const Tc = p.Tr[0] + (i / N) * (p.Tr[1] - p.Tr[0]), P = p.Pr[1] - (j / N) * (p.Pr[1] - p.Pr[0]);
      const t = L.colour === 'yield' ? this.#y[k] / Math.max(1e-6, Math.max(...[this.#y[0], this.#y[N], this.#y[N * (N + 1)], this.#y[(N + 1) * (N + 1) - 1]]))
        : L.colour === 'rate' ? (lr(Tc, P) - lo) / Math.max(1e-6, hi - lo)
        : 1 - (costRel(p, Tc, P) - cmin) / Math.max(1e-6, cmax - cmin);
      ramp(t, c);
      col.setXYZ(k, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  #fit = false;
  protected update(dt: number) {
    const L = this.look!;
    // a phone's near-square view: stand further back so the whole set-up fits
    if (!this.#fit) { this.#fit = true; if (this.camera.aspect < 1.2) this.zoomBy(1.4); }
    const key = `${L.proc}|${L.measure}`;
    if (key !== this.#key) { this.#key = key; this.#build(L); this.#ckey = ''; }
    const ck = `${key}|${L.colour}`;
    if (ck !== this.#ckey) { this.#ckey = ck; this.#paint(L); }
    const p = this.#p;
    const Tc = Math.max(p.Tr[0], Math.min(p.Tr[1], L.T)), P = Math.max(p.Pr[0], Math.min(p.Pr[1], L.P));
    const x = this.#xOf(Tc), z = this.#zOf(P), y = this.#height(Tc, P);
    this.#t += dt;
    this.#ball.position.set(x, y + 0.16, z);
    this.#glow.position.copy(this.#ball.position);
    const s = 1.1 + 0.15 * Math.sin(this.#t * 3);
    this.#glow.scale.setScalar(Number.isFinite(s) ? s : 1.1);
    const a = this.#drop.geometry.getAttribute('position') as THREE.BufferAttribute;
    a.setXYZ(0, x, y, z); a.setXYZ(1, x, 0, z);
    a.setXYZ(2, x, 0, z); a.setXYZ(3, x, 0, D / 2);
    a.setXYZ(4, x, 0, z); a.setXYZ(5, W / 2, 0, z);
    a.needsUpdate = true;
  }
}
