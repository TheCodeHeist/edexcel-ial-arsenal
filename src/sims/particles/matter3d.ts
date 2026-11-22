/* Particle Lab: annihilation and pair production in 3D. The floor of a liquid-hydrogen bubble chamber (1 world unit =
   1 cm) with a nucleus at the centre. Each event comes from matter.ts as polylines with real times; this view plays
   them on a slowed clock: tracks grow behind their particles, photons are wavy lines (in the chamber they leave no
   track, so there they are faint and dashed), and every creation or annihilation flashes. */

import { THREE, Stage3D, pointCloud, label, rand } from './gl';
import { annihilation, pair, R_CH, type Event, type Seg, type Who } from './matter';

export interface MLook {
  mode: 'annih' | 'pair';
  who: Who;
  K: number;          // annihilation: kinetic energy of each / MeV
  Eg: number;         // pair: photon energy / MeV
  B: number;          // pair: field / T
  slow: number;       // log₁₀ real seconds per screen second
  playing: boolean;
  seq: number;        // bump to start a new event now
}

const COL = { neg: new THREE.Color(0.45, 0.72, 1.6), pos: new THREE.Color(1.7, 0.5, 0.62), neu: new THREE.Color(1.1, 1.1, 1.15), ph: new THREE.Color(1.5, 1.3, 2.0) };
const colOf = (s: Seg) => (s.kind === 'photon' || s.kind === 'ghost' ? COL.ph : s.q > 0 ? COL.pos : s.q < 0 ? COL.neg : s.name.includes('̄') || s.name.includes('⁺') ? COL.pos : COL.neg);

interface Live { seg: Seg; line: THREE.Line; n: number; tag: THREE.Sprite; head: THREE.Vector3 | null }

export class MatterScene extends Stage3D<MLook> {
  /** told about each new event (for the readings beside the view) */
  onevent: ((e: Event) => void) | null = null;
  #ev: Event | null = null;
  #t = 0;
  #wait = 0;
  #seq = -1;
  #key = '';
  #live: Live[] = [];
  #ev3 = new THREE.Group();
  #heads = pointCloud(16, this.px);
  #flashes: { s: THREE.Sprite; t: number; big: boolean }[] = [];
  #field = new THREE.Group();
  #nuc: THREE.Mesh;
  #nucLab = label('nucleus', 0.55, '#ffd58a');

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [0, 24, 15], target: [0, 0, 0.6], bloom: [0.85, 0.5, 0.55], fov: 42 });
    this.scene.add(new THREE.AmbientLight(0x8a92b0, 1));
    // chamber floor, rim and a faint 1 cm grid
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R_CH + 0.6, 96), new THREE.MeshBasicMaterial({ color: 0x0b1222 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.05;
    this.scene.add(floor);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R_CH + 0.6, 0.12, 8, 120), new THREE.MeshStandardMaterial({ color: 0x5a6378, metalness: 0.7, roughness: 0.4 }));
    rim.rotation.x = Math.PI / 2;
    this.scene.add(rim);
    const g: number[] = [];
    for (let k = -R_CH; k <= R_CH; k += 1) {
      const h = Math.sqrt(Math.max(0, (R_CH + 0.5) ** 2 - k * k));
      g.push(k, 0, -h, k, 0, h, -h, 0, k, h, 0, k);
    }
    const grid = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(g, 3)),
      new THREE.LineBasicMaterial({ color: 0x24324f, transparent: true, opacity: 0.55 }));
    grid.position.y = -0.03;
    this.scene.add(grid);
    // the field: dots on a coarse grid (B out of the floor, towards the camera)
    for (let x = -12; x <= 12; x += 4) for (let z = -12; z <= 12; z += 4) {
      if (Math.hypot(x, z) > R_CH - 1) continue;
      const d = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 20), new THREE.MeshBasicMaterial({ color: 0x4a5a80, side: THREE.DoubleSide }));
      d.rotation.x = -Math.PI / 2; d.position.set(x, 0, z);
      const c = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10), new THREE.MeshBasicMaterial({ color: 0x6a7aa8 }));
      c.rotation.x = -Math.PI / 2; c.position.set(x, 0.01, z);
      this.#field.add(d, c);
    }
    const bl = label('B out of the floor ⊙', 0.6, '#9fb4ff'); bl.position.set(-R_CH + 3.2, 0.5, -R_CH + 2.2);
    this.#field.add(bl);
    this.scene.add(this.#field);
    this.#nuc = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.2, 0.4) }));
    this.#nucLab.position.set(0.4, 0.9, 1.6);
    this.scene.add(this.#nuc, this.#nucLab, this.#ev3, this.#heads.obj);
    this.start();
  }

  #clear() {
    for (const l of this.#live) {
      l.line.geometry.dispose(); (l.line.material as THREE.Material).dispose();
      l.tag.material.map?.dispose(); l.tag.material.dispose();
    }
    for (const f of this.#flashes) f.s.material.dispose();
    this.#ev3.clear();
    this.#live = []; this.#flashes = [];
  }

  #newEvent(L: MLook) {
    this.#clear();
    const ev = L.mode === 'annih' ? annihilation(L.who, L.K, rand) : pair(L.who === 'n' ? 'e' : L.who, L.Eg, L.B, rand);
    this.#ev = ev; this.#t = 0; this.#wait = 0;
    this.onevent?.(ev);
    for (const seg of ev.segs) {
      const pts: THREE.Vector3[] = [];
      const wavy = seg.kind === 'photon' || seg.kind === 'ghost';
      for (let i = 0; i < seg.pts.length; i += 2) {
        const x = seg.pts[i], z = seg.pts[i + 1];
        if (wavy && i + 2 < seg.pts.length) {
          // a wiggle across the direction of travel, to read as "a photon"
          const dx = seg.pts[i + 2] - x, dz = seg.pts[i + 3] - z, L0 = Math.hypot(dx, dz) || 1;
          const along = Math.hypot(x - seg.pts[0], z - seg.pts[1]);
          const w = Math.sin(along * 7) * 0.16;
          pts.push(new THREE.Vector3(x - (dz / L0) * w, 0.12, z + (dx / L0) * w));
        } else pts.push(new THREE.Vector3(x, seg.kind === 'ball' ? 0.35 : 0.08, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const c = colOf(seg);
      const mat = seg.kind === 'ghost'
        ? new THREE.LineDashedMaterial({ color: c, dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.5 })
        : new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: seg.kind === 'ball' ? 0.25 : 0.95 });
      const line = new THREE.Line(geo, mat);
      if (seg.kind === 'ghost') line.computeLineDistances();
      geo.setDrawRange(0, 0);
      const tag = label(seg.E && seg.kind !== 'ball' ? `${seg.name} ${seg.E >= 100 ? seg.E.toFixed(0) : seg.E.toPrecision(3)} MeV` : seg.name, 0.62,
        seg.kind === 'photon' || seg.kind === 'ghost' ? '#e4d8ff' : seg.q > 0 || (seg.q === 0 && /̄|⁺/.test(seg.name)) ? '#ff9aac' : '#9cc8ff');
      tag.visible = false;
      this.#ev3.add(line, tag);
      this.#live.push({ seg, line, n: 0, tag, head: null });
    }
    for (const f of ev.flashes) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: f.big ? 0xfff0d0 : 0xd8d0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.set(f.x, 0.3, f.z);
      this.#ev3.add(s);
      this.#flashes.push({ s, t: f.t, big: f.big });
    }
  }

  protected update(dt: number) {
    const L = this.look!;
    this.#field.visible = L.mode === 'pair' && L.B > 0;
    this.#nuc.visible = this.#nucLab.visible = L.mode === 'pair';
    const key = `${L.mode}|${L.who}|${L.K}|${L.Eg}|${L.B}`;
    if (L.seq !== this.#seq || key !== this.#key || !this.#ev) { this.#seq = L.seq; this.#key = key; this.#newEvent(L); }
    const ev = this.#ev!;
    if (L.playing) {
      if (this.#t < ev.end) this.#t = Math.min(ev.end, this.#t + dt * 10 ** L.slow);
      else if ((this.#wait += dt) > 1.6) this.#newEvent(L);
    }
    const t = this.#t;
    let h = 0;
    const H = this.#heads;
    for (const l of this.#live) {
      const { ts, pts } = l.seg;
      // how far along: the last point already reached, plus the fraction to the next
      let i = 0;
      while (i + 1 < ts.length && ts[i + 1] <= t) i++;
      const started = t >= ts[0];
      const done = t >= ts[ts.length - 1];
      const n = started ? (done ? ts.length : i + 1) : 0;
      if (n !== l.n) { l.line.geometry.setDrawRange(0, l.seg.kind === 'ball' ? n : n + (done ? 0 : 1)); l.n = n; }
      const vis = started && (l.seg.kind !== 'ball' || !done);
      l.tag.visible = started;
      let x = pts[2 * i], z = pts[2 * i + 1];
      if (!done && started && i + 1 < ts.length) {
        const f = (t - ts[i]) / Math.max(1e-30, ts[i + 1] - ts[i]);
        x += (pts[2 * i + 2] - x) * f; z += (pts[2 * i + 3] - z) * f;
      }
      if (l.seg.kind === 'ball' && done) { x = pts[pts.length - 2]; z = pts[pts.length - 1]; }
      const tx = l.seg.kind === 'ball' ? x : pts[pts.length - 2], tz = l.seg.kind === 'ball' ? z : pts[pts.length - 1];
      const end = done || l.seg.kind === 'ball' ? [tx, tz] : [x, z];
      l.tag.position.set(end[0] + 0.3, 0.9, end[1] + (l.seg.kind === 'ball' ? -0.9 : 0.5));
      if (vis && !done && h < H.n) {
        const c = colOf(l.seg);
        H.pos[3 * h] = x; H.pos[3 * h + 1] = l.seg.kind === 'ball' ? 0.35 : 0.1; H.pos[3 * h + 2] = z;
        H.col[3 * h] = c.r; H.col[3 * h + 1] = c.g; H.col[3 * h + 2] = c.b;
        H.size[h] = l.seg.kind === 'ball' ? 1.1 : l.seg.kind === 'track' ? 0.55 : 0.5;
        H.alpha[h] = l.seg.kind === 'ghost' ? 0.6 : 1;
        h++;
      }
    }
    H.flush(h);
    for (const f of this.#flashes) {
      const a = t - f.t;
      const real = 10 ** L.slow;                    // flash lasts ~0.6 s on screen
      const k = a < 0 ? 0 : Math.max(0, 1 - a / (0.6 * real));
      f.s.material.opacity = k;
      f.s.scale.setScalar((f.big ? 4.5 : 2.2) * (0.4 + 0.6 * k));
    }
    this.#nuc.scale.setScalar(1 + 0.15 * Math.sin(this.time.value * 3));
  }

  dispose() { this.#clear(); super.dispose(); }
}
