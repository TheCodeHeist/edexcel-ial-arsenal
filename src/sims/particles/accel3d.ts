/* Particle Lab: the accelerators in 3D. One scene, four apparatus groups, shown one at a time.

   Everything moves on one real clock (seconds), slowed down by the factor the slider sets (look.scale = real seconds
   per second on screen); positions come from the plans in accel.ts, which are exact kinematics, so a particle
   speeds up only where a field pushes it and coasts everywhere else.
   Electron gun (units: cm): a 16 cm glass bulb between Helmholtz coils (axis z, so B is along z). Electrons speed up
   uniformly from the filament to the anode (3.2 cm), then go round a circle of the real radius at constant speed,
   stopping where it meets the glass. The stream is denser where they are slow, as a real beam is.
   Linac: tubes and gaps to scale with each other; the a.c. p.d. follows cos 2πft, so the colours flip while the
   bunch is inside a tube and the field peaks as it crosses each gap.
   Cyclotron: two dees, B upwards (+y); every semicircle of the real spiral is drawn and takes πγm/QB, however big.
   Synchrotron: a ring of bending dipoles and RF cavities; two beams go round at their real lap rate (about 11 kHz) in
   opposite directions and collide in the four detectors. The dipoles glow brighter as B ramps up with the energy. */

import { Stage3D, THREE, pointCloud, label, rand, gauss, fin } from './gl';
import { type Kind, type GunPlan, type LinacPlan, type CycloPlan, linacAt, cycloAt, push } from './accel';

export interface ALook {
  kind: Kind;
  playing: boolean;
  scale: number;                  // real seconds per second on screen
  gun: { r: number /* cm */; plan: GunPlan };
  linac: LinacPlan;
  cyclo: CycloPlan;
  sync: { B: number /* 0–1 of top field */; frev: number /* laps per second */ };
  epoch: number;                  // bump to start the run again
}
/** What the particle is doing now, for the readouts (sent about ten times a second). */
export interface ALive { kind: Kind; t: number; v: number; p: number; stage: string; k: number; r: number }

type Cloud = ReturnType<typeof pointCloud>;

const HOME: Record<Kind, [[number, number, number], [number, number, number]]> = {
  gun: [[10, 5, 37], [0, -0.5, 0]],
  linac: [[2, 8.5, 21], [0, -0.5, 0]],
  cyclo: [[0, 12.5, 13.5], [0, 0, 0.4]],
  sync: [[0, 15, 18], [0, 0, 0]],
};

const COPPER = 0xc87f4a, PLUS = new THREE.Color(1.0, 0.25, 0.18), MINUS = new THREE.Color(0.2, 0.45, 1.0);

/** Empty a group, freeing its geometry, materials and label textures (but not the shared glow texture). */
function clear(g: THREE.Group, keep: THREE.Texture) {
  for (const o of [...g.children]) {
    g.remove(o);
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      const each = (y: THREE.Material) => { const t = (y as THREE.SpriteMaterial).map; if (t && t !== keep) t.dispose(); y.dispose(); };
      if (Array.isArray(mat)) mat.forEach(each); else if (mat) each(mat);
    });
  }
}
const metal = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.42, ...o });
function arrow(from: THREE.Vector3, dir: THREE.Vector3, len: number, color: number) {
  return new THREE.ArrowHelper(dir.clone().normalize(), from, len, color, Math.min(0.6, len * 0.25), Math.min(0.32, len * 0.14));
}

export class AccelScene extends Stage3D<ALook> {
  #groups: Record<Kind, THREE.Group> = { gun: new THREE.Group(), linac: new THREE.Group(), cyclo: new THREE.Group(), sync: new THREE.Group() };
  #kind: Kind | null = null;
  #key: Record<Kind, string> = { gun: '', linac: '', cyclo: '', sync: '' };
  #t = 0;              // real time (s) since the run started; runs only while playing
  #epoch = -1;
  #lastTick = 0;
  /** Called with the particle's state about ten times a second. */
  onTick: ((s: ALive) => void) | null = null;
  #beam: Cloud;        // moving particles
  #glow: Cloud;        // static glows (gun's gas trail, cyclotron path)
  #burst: Cloud;       // sparks: target hits, collisions
  #sparks: { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; c: [number, number, number] }[] = [];
  // per-apparatus state
  #gunPath: THREE.Vector3[] = [];
  #gunHit: THREE.Sprite | null = null;
  #lin: { xs: [number, number][]; gaps: [number, number][]; mats: THREE.MeshStandardMaterial[]; signs: THREE.Sprite[][]; src: number; tgt: number; neg: boolean } | null = null;
  #cyc: { path: THREE.Vector3[]; ends: number[]; dees: THREE.MeshStandardMaterial[]; exit: THREE.Vector3[] } | null = null;
  #syn: { dipoles: THREE.MeshStandardMaterial[]; ips: number[] } | null = null;
  #lastBurst = 0;
  #lastMeet = 0;

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { bloom: [0.75, 0.5, 0.62], cam: HOME.gun[0], target: HOME.gun[1], bg: 0x04050b });
    this.scene.add(new THREE.AmbientLight(0x8a93b8, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 12, 9);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x6f8cff, 0.5);
    fill.position.set(-8, 4, -6);
    this.scene.add(fill);
    const floor = new THREE.GridHelper(60, 30, 0x1d2238, 0x12162a);
    floor.position.y = -9;
    (floor.material as THREE.Material).transparent = true;
    (floor.material as THREE.Material).opacity = 0.5;
    this.scene.add(floor);
    for (const g of Object.values(this.#groups)) { g.visible = false; this.scene.add(g); }
    this.#beam = pointCloud(this.small ? 900 : 1600, this.px);
    this.#glow = pointCloud(this.small ? 2400 : 4000, this.px);
    this.#burst = pointCloud(900, this.px);
    this.scene.add(this.#glow.obj, this.#beam.obj, this.#burst.obj);
    this.start();
  }

  protected update(dt: number) {
    const L = this.look!;
    if (L.playing) this.#t += dt * Math.max(0, fin(L.scale));
    if (L.epoch !== this.#epoch) { this.#epoch = L.epoch; this.#t = 0; this.#sparks = []; }
    if (L.kind !== this.#kind) {
      this.#t = 0;
      this.#kind = L.kind;
      for (const [k, g] of Object.entries(this.#groups)) g.visible = k === L.kind;
      const [c, t] = HOME[L.kind];
      this.setHome(c, t);
      this.#sparks = [];
    }
    let n = 0, ng = 0;
    if (L.kind === 'gun') [n, ng] = this.#gun(L);
    else if (L.kind === 'linac') [n, ng] = this.#linac(L, dt);
    else if (L.kind === 'cyclo') [n, ng] = this.#cyclotron(L, dt);
    else [n, ng] = this.#sync(L, dt);
    this.#beam.flush(n);
    this.#glow.flush(ng);
    this.#stepSparks(dt);
  }
  #tick(s: Omit<ALive, 'kind' | 't'>, t: number) {
    const now = this.time.value;
    if (!this.onTick || now - this.#lastTick < 0.1) return;
    this.#lastTick = now;
    this.onTick({ kind: this.look!.kind, t, ...s });
  }

  /* ---------- helpers ---------- */

  #put(c: Cloud, i: number, p: THREE.Vector3 | [number, number, number], col: [number, number, number], size: number, alpha: number) {
    if (i >= c.n) return i;
    const [x, y, z] = Array.isArray(p) ? p : [p.x, p.y, p.z];
    c.pos[i * 3] = fin(x); c.pos[i * 3 + 1] = fin(y); c.pos[i * 3 + 2] = fin(z);
    c.col.set(col, i * 3);
    c.size[i] = size; c.alpha[i] = alpha;
    return i + 1;
  }
  #spark(at: THREE.Vector3, k: number, speed: number, col: [number, number, number], life = 0.7) {
    for (let i = 0; i < k; i++) {
      const d = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(speed * (0.4 + rand()));
      this.#sparks.push({ x: at.x, y: at.y, z: at.z, vx: d.x, vy: d.y, vz: d.z, age: 0, life: life * (0.6 + rand() * 0.6), c: col });
    }
    if (this.#sparks.length > this.#burst.n) this.#sparks.splice(0, this.#sparks.length - this.#burst.n);
  }
  #stepSparks(dt: number) {
    let n = 0;
    const playing = this.look?.playing;
    this.#sparks = this.#sparks.filter((s) => (s.age += playing ? dt : 0) < s.life);
    for (const s of this.#sparks) {
      if (playing) { s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; }
      const f = 1 - s.age / s.life;
      n = this.#put(this.#burst, n, [s.x, s.y, s.z], s.c, 0.12, f * f);
    }
    this.#burst.flush(n);
  }
  /** Walk a polyline: the point a distance d along it, and the segment index. */
  static along(path: THREE.Vector3[], cum: number[], d: number) {
    const total = cum[cum.length - 1];
    d = Math.max(0, Math.min(total, d));
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
    const seg = cum[hi] - cum[lo] || 1;
    return path[lo].clone().lerp(path[hi], (d - cum[lo]) / seg);
  }
  static cumulative(path: THREE.Vector3[]) {
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + path[i].distanceTo(path[i - 1]));
    return cum;
  }

  /* ---------- electron gun and fine-beam tube (units: cm) ---------- */

  #gunCum: number[] = [];
  #buildGun(r: number) {
    const g = this.#groups.gun;
    clear(g, this.tex);
    const R = 8, Y = -5.5;
    const glass = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 40), new THREE.MeshPhysicalMaterial({
      color: 0xbfd6ff, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0, depthWrite: false, side: THREE.DoubleSide,
    }));
    g.add(glass);
    const rim = new THREE.Mesh(new THREE.SphereGeometry(R * 1.002, 48, 24), new THREE.MeshBasicMaterial({ color: 0x5a78b8, wireframe: true, transparent: true, opacity: 0.05 }));
    g.add(rim);
    // stem and base
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 4, 32), metal(0x2b2f3d));
    stem.position.set(0, -R - 1.2, 0);
    g.add(stem);
    // Helmholtz coils: radius 10, 10 apart (separation = radius), axis along z
    for (const z of [-5, 5]) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(10, 0.65, 18, 96), metal(COPPER, { metalness: 0.55, roughness: 0.3 }));
      coil.position.z = z;
      g.add(coil);
    }
    const lc = label('Helmholtz coils', 0.75, '#ffd6b0'); lc.position.set(10.5, 8.2, 5); g.add(lc);
    // B field arrows along +z through the bulb
    for (const [x, y] of [[-4, 3], [3, 3], [-4, -3], [3, -2.5], [0, 0]]) g.add(arrow(new THREE.Vector3(x, y, -9), new THREE.Vector3(0, 0, 1), 18, 0x6f8fd6));
    const lb = label('B', 0.9, '#9fbcff'); lb.position.set(0.5, 0.8, 9.8); g.add(lb);
    // the electron gun: filament (cathode), anode with a hole, pointing along +x, exit at (0, Y, 0)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.6, 24), metal(0x8f97ad));
    body.rotation.z = Math.PI / 2; body.position.set(-2.4, Y, 0); g.add(body);
    const anode = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.18, 12, 32), metal(0xd0d6e6));
    anode.rotation.y = Math.PI / 2; anode.position.set(-0.6, Y, 0); g.add(anode);
    const fil = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    fil.position.set(-3.8, Y, 0); fil.scale.setScalar(2.2); g.add(fil);
    const lf = label('hot filament: thermionic emission', 0.6, '#ffcf9a'); lf.position.set(-5.5, Y - 1.5, 1); g.add(lf);
    const la = label('anode (+V)', 0.6); la.position.set(-0.8, Y + 1.4, 1); g.add(la);
    // the beam's circle, ending where it meets the glass
    const c = new THREE.Vector3(0, Y + r, 0), path: THREE.Vector3[] = [new THREE.Vector3(-0.6, Y, 0)];
    let hit: THREE.Vector3 | null = null;
    for (let i = 0; i <= 720; i++) {
      const th = (i / 720) * Math.PI * 2;
      const p = new THREE.Vector3(c.x + r * Math.sin(th), c.y - r * Math.cos(th), 0);
      if (p.length() > R * 0.98) { hit = p; break; }
      path.push(p);
    }
    this.#gunPath = path;
    this.#gunCum = AccelScene.cumulative(path);
    this.#gunHit = null;
    if (hit) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0x66ffb0, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.copy(hit); s.scale.setScalar(1.6); g.add(s); this.#gunHit = s;
      const lh = label('hits the glass', 0.55, '#a8ffd0'); lh.position.copy(hit).add(new THREE.Vector3(0, 0.9, 0.5)); g.add(lh);
    } else {
      const lr = label(`r = ${r.toFixed(1)} cm`, 0.6, '#a8ffd0'); lr.position.set(0, c.y, 0.5); g.add(lr);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([c, new THREE.Vector3(c.x + r * 0.71, c.y - r * 0.71, 0)]),
        new THREE.LineDashedMaterial({ color: 0x7affc0, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.6 })).computeLineDistances());
    }
    // the force arrow at the top of the circle (towards the centre)
    if (!hit || path.length > 360) {
      const top = new THREE.Vector3(0, c.y + r, 0);
      g.add(arrow(top, new THREE.Vector3(0, -1, 0), Math.min(2.2, r * 0.6), 0xffd166));
      const lF = label('F = Bev', 0.55, '#ffe08a'); lF.position.set(1.2, c.y + r - 1, 0.5); g.add(lF);
    }
  }
  #gun(L: ALook): [number, number] {
    const key = `${L.gun.r.toFixed(3)}`;
    if (this.#key.gun !== key) { this.#key.gun = key; this.#buildGun(L.gun.r); }
    const path = this.#gunPath, cum = this.#gunCum, total = cum[cum.length - 1] || 1;   // cm
    const P = L.gun.plan, Y = -5.5, xF = -3.8;
    let n = 0, ng = 0;
    // the glow of the gas the beam excites: blue-green, all along the path
    const step = Math.max(1, Math.floor(path.length / 380));
    for (let i = 0; i < path.length; i += step) ng = this.#put(this.#glow, ng, path[i], [0.25, 1.0, 0.62], 0.55, 0.32);
    // a steady stream: electron i left the filament a time age_i ago; the oldest reach the end of the path
    const tPath = P.tAcc + (total / 100) / P.v;
    const k = this.small ? 110 : 190;
    for (let i = 0; i < k; i++) {
      const age = (((this.#t + (i / k) * tPath) % tPath) + tPath) % tPath;
      let q: THREE.Vector3;
      if (age < P.tAcc) {
        const [d] = push(P.m, 0, P.F, age);                       // uniform acceleration from rest, metres
        q = new THREE.Vector3(xF + d * 100, Y, 0);
      } else q = AccelScene.along(path, cum, ((age - P.tAcc) * P.v) * 100);
      n = this.#put(this.#beam, n, q, [0.55, 1.2, 0.9], 0.2, 0.9);
    }
    if (this.#gunHit) (this.#gunHit.material as THREE.SpriteMaterial).opacity = 0.6 + 0.3 * Math.sin(this.time.value * 9);
    // the readout follows one electron through a whole trip
    const a1 = this.#t % tPath;
    const v1 = a1 < P.tAcc ? push(P.m, 0, P.F, a1)[1] / P.m : P.v;
    this.#tick({ v: v1, p: P.m * v1, stage: a1 < P.tAcc ? 'accelerating: filament → anode' : 'circling at constant speed', k: 0, r: a1 < P.tAcc ? 0 : L.gun.r / 100 }, this.#t);
    return [n, ng];
  }

  /* ---------- linac ---------- */

  #linX = (x: number) => x;
  #buildLinac(P: LinacPlan) {
    const g = this.#groups.linac;
    clear(g, this.tex);
    const N = P.tubes.length, span = 20;
    const sc = span / P.target;                     // scene units per metre: tubes and gaps to scale
    const x00 = -span / 2;
    const X = (x: number) => x00 + x * sc;
    this.#linX = X;
    const src = X(0);
    // ion source / electron gun
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), metal(0x59607a));
    box.position.set(src - 0.7, 0, 0); g.add(box);
    const ls = label(P.neg ? 'electron gun' : 'ion source', 0.55); ls.position.set(src - 0.7, 1.4, 0); g.add(ls);
    const mats: THREE.MeshStandardMaterial[] = [], signs: THREE.Sprite[][] = [];
    const xs: [number, number][] = P.tubes.map(([a, b]) => [X(a), X(b)]);
    const gaps: [number, number][] = P.gaps.map(([a, b]) => [X(a), X(b)]);
    for (let k = 0; k < N; k++) {
      const [x, x2] = xs[k], len = Math.max(0.05, x2 - x);
      const mat = metal(COPPER, { emissive: new THREE.Color(0, 0, 0), side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false });
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, len, 40, 1, true), mat);
      tube.rotation.z = Math.PI / 2; tube.position.set(x + len / 2, 0, 0);
      g.add(tube);
      const rimG = new THREE.TorusGeometry(0.5, 0.06, 8, 40);
      for (const e of [x, x + len]) { const rr = new THREE.Mesh(rimG.clone(), mat); rr.rotation.y = Math.PI / 2; rr.position.set(e, 0, 0); g.add(rr); }
      rimG.dispose();
      mats.push(mat);
      const plus = label('+', 0.7, '#ff8a7a'), minus = label('−', 0.7, '#8ab4ff');
      for (const s2 of [plus, minus]) { s2.position.set(x + len / 2, 1.05, 0); g.add(s2); }
      signs.push([plus, minus]);
      // wire down to a bus bar: alternate tubes to the two terminals
      const yb = k % 2 ? -2.6 : -2.1;
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x + len / 2, -0.5, 0), new THREE.Vector3(x + len / 2, yb, 0)]),
        new THREE.LineBasicMaterial({ color: 0x8890aa })));
    }
    const x0 = xs[0][0], x1 = xs[N - 1][1];
    for (const yb of [-2.1, -2.6]) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x0, yb, 0), new THREE.Vector3(x1 + 0.2, yb, 0)]), new THREE.LineBasicMaterial({ color: 0x8890aa })));
    // the a.c. supply
    const acx = x1 + 1.0;
    const ac = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    ac.position.set(acx, -2.35, 0); g.add(ac);
    const wave = Array.from({ length: 25 }, (_, i) => new THREE.Vector3(acx - 0.38 + (i / 24) * 0.76, -2.35 + 0.22 * Math.sin((i / 24) * Math.PI * 2), 0));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wave), new THREE.LineBasicMaterial({ color: 0xffd166 })));
    for (const yb of [-2.1, -2.6]) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1 + 0.2, yb, 0), new THREE.Vector3(acx - 0.5, -2.35, 0)]), new THREE.LineBasicMaterial({ color: 0x8890aa })));
    const lac = label('alternating p.d.', 0.55, '#ffe08a'); lac.position.set(acx, -3.4, 0); g.add(lac);
    const ld = label('drift tubes: no field inside', 0.6); ld.position.set(0, 2.4, 0); g.add(ld);
    // target
    const tgt = X(P.target);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 2.2), metal(0x9aa3bd));
    plate.position.set(tgt + 0.1, 0, 0); g.add(plate);
    const lt = label('target', 0.55); lt.position.set(tgt + 0.1, 1.6, 0); g.add(lt);
    this.#lin = { xs, gaps, mats, signs, src, tgt, neg: P.neg };
  }
  #linac(L: ALook, dt: number): [number, number] {
    void dt;
    const P = L.linac;
    const key = P.tubes.map((x) => x[1].toPrecision(5)).join(',') + P.neg + P.f;
    if (this.#key.linac !== key) { this.#key.linac = key; this.#buildLinac(P); this.#t = 0; }
    const S = this.#lin!, N = S.xs.length, X = this.#linX;
    const t = ((this.#t % P.cycle) + P.cycle) % P.cycle;
    // the p.d.: tube k is at (−1)^k cos 2πf(t − t_c0) (times −1 for electrons); it peaks as the bunch crosses each gap
    const c = Math.cos(2 * Math.PI * P.f * (t - P.tc0)), amp = Math.abs(c);
    for (let j = 0; j < N; j++) {
      let plus = ((j + 1) % 2 ? -c : c) > 0;
      if (S.neg) plus = !plus;
      const col = plus ? PLUS : MINUS;
      S.mats[j].emissive.copy(col).multiplyScalar(0.12 + 0.45 * amp);
      S.signs[j][0].visible = plus; S.signs[j][1].visible = !plus;
    }
    const now = linacAt(P, t);
    let n = 0, ng = 0;
    const colB: [number, number, number] = S.neg ? [0.6, 1.1, 1.4] : [1.4, 0.75, 0.45];
    if (!now.done) {
      // the bunch, with a tail showing where it was a moment ago (longer when it is faster)
      const k = this.small ? 40 : 70;
      for (let i = 0; i < k; i++) {
        if (i < 18) {
          const back = linacAt(P, Math.max(0, t - i * P.half * 0.03));
          n = this.#put(this.#beam, n, [X(back.x), 0, 0], colB, 0.3 - i * 0.01, 1 - i / 20);
        } else n = this.#put(this.#beam, n, [X(now.x) + gauss() * 0.04, gauss() * 0.05, gauss() * 0.05], colB, 0.14, 0.7);
      }
    } else if (L.playing && this.time.value - this.#lastBurst > 0.5 && t - P.tEnd < P.half) {
      this.#lastBurst = this.time.value;
      this.#spark(new THREE.Vector3(S.tgt, 0, 0), 120, 4, [1.2, 0.9, 0.5]);
    }
    // the field in every gap, as strong as the p.d. is now
    for (let j = 0; j < N; j++) {
      const [ga, gb] = S.gaps[j];
      for (let i = 0; i < 14; i++) ng = this.#put(this.#glow, ng, [ga + (gb - ga) * rand(), (rand() - 0.5) * 0.8, (rand() - 0.5) * 0.8], [1.1, 1.0, 0.5], 0.07, 0.6 * amp * amp);
    }
    this.#tick({ v: now.v, p: now.p, stage: now.done ? 'at the target' : now.gap >= 0 ? `accelerating in gap ${now.gap + 1}` : `coasting in tube ${(P.segs.findIndex((s2) => t < s2.t1) + 1) >> 1}`, k: now.gap, r: 0 }, t);
    return [n, ng];
  }

  /* ---------- cyclotron ---------- */

  #cycS = 1;
  #buildCyclo(P: CycloPlan) {
    const g = this.#groups.cyclo;
    clear(g, this.tex);
    const R = 6, H = 0.9, Rp = 5.75;
    const sc = Rp / P.R;                         // scene units per metre
    this.#cycS = sc;
    const gap = Math.max(0.08, P.g * sc);
    const dees: THREE.MeshStandardMaterial[] = [];
    for (const side of [1, -1]) {
      const mat = metal(COPPER, { transparent: true, opacity: 0.26, side: THREE.DoubleSide, emissive: new THREE.Color(0, 0, 0), depthWrite: false });
      const d = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 64, 1, false, side > 0 ? 0 : Math.PI, Math.PI), mat);
      d.position.x = (side * gap) / 2;
      g.add(d);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(d.geometry, 30), new THREE.LineBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.5 }));
      edge.position.copy(d.position); g.add(edge);
      dees.push(mat);
      const ld = label('dee', 0.42, '#ffd6b0'); ld.position.set(side * (R * 0.55 + gap), H / 2 + 0.6, -R * 0.55); g.add(ld);
    }
    // magnet poles above and below; B upwards (from the N pole below to the S pole above)
    for (const [y, t] of [[-2.1, 'N'], [2.1, 'S']] as const) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.12, R * 1.12, 0.5, 64), new THREE.MeshStandardMaterial({ color: 0x3a4466, transparent: true, opacity: 0.22, depthWrite: false, roughness: 0.6 }));
      pole.position.y = y; g.add(pole);
      const lp = label(`${t} pole`, 0.42, '#b8c6ff'); lp.position.set(-R * 1.05, y + (y > 0 ? 0.6 : -0.6), R * 0.7); g.add(lp);
    }
    for (const [x, z] of [[-3.5, -2], [3.5, -2], [-3.5, 2.5], [3.5, 2.5], [0, -4.4], [-4.6, 0.2], [4.6, 0.2]]) g.add(arrow(new THREE.Vector3(x, -1.7, z), new THREE.Vector3(0, 1, 0), 3.3, 0x6f8fd6));
    const lb = label('B upwards, through the dees', 0.4, '#9fbcff'); lb.position.set(4.8, 2.9, 2.6); g.add(lb);
    const lg = label('gap: alternating p.d. accelerates', 0.4, '#ffe08a'); lg.position.set(0, 1.0, -R - 0.6); g.add(lg);
    const src = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    src.scale.setScalar(1.1); g.add(src);
    const lsrc = label('ion source', 0.36); lsrc.position.set(-1.2, 1, 0); g.add(lsrc);
    // the whole real spiral: every semicircle, sampled from the plan (fewer points each when there are thousands)
    const pts: THREE.Vector3[] = [];
    const per = Math.max(6, Math.min(48, Math.floor(60000 / Math.max(1, P.segs.length))));
    for (const sg of P.segs) {
      const m = sg.kind === 'dee' ? per : 2;
      for (let i = 0; i <= m; i++) {
        const q = cycloAt(P, sg.t0 + ((sg.t1 - sg.t0) * i) / m);
        pts.push(new THREE.Vector3(q.x * sc, 0, q.z * sc));
      }
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffb27a, transparent: true, opacity: P.n > 300 ? 0.32 : 0.55 })));
    const last = P.segs[P.segs.length - 1];
    const e0 = cycloAt(P, last.t0), e1 = cycloAt(P, last.t1);
    const pEnd = new THREE.Vector3(e0.x * sc, 0, e0.z * sc), exit = new THREE.Vector3(e1.x * sc, 0, e1.z * sc);
    const defl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 1.6), metal(0xd0d6e6));
    defl.position.copy(pEnd).add(new THREE.Vector3(Math.sign(pEnd.x || 1) * 0.3, 0, Math.sign(exit.z - pEnd.z) * 0.6)); g.add(defl);
    const lo = label('beam out', 0.4); lo.position.copy(exit).add(new THREE.Vector3(0, 0.7, 0)); g.add(lo);
    this.#cyc = { path: [], ends: [], dees, exit: [pEnd, exit] };
  }
  #cyclotron(L: ALook, dt: number): [number, number] {
    void dt;
    const P = L.cyclo;
    const key = `${P.n},${P.R},${P.B},${P.m},${P.segs.length}`;
    if (this.#key.cyclo !== key) { this.#key.cyclo = key; this.#buildCyclo(P); this.#t = 0; }
    const S = this.#cyc!, sc = this.#cycS;
    const t = ((this.#t % P.cycle) + P.cycle) % P.cycle;
    const now = cycloAt(P, t);
    // the p.d. on the dees: peaks at each gap crossing and passes through zero half way round each dee
    let i = 0;
    while (i < P.crossT.length - 1 && P.crossT[i + 1] <= t) i++;
    const ta = P.crossT[i], tb = i + 1 < P.crossT.length ? P.crossT[i + 1] : ta + (ta - (P.crossT[i - 1] ?? 0));
    const u = Math.max(0, Math.min(1, (t - ta) / Math.max(1e-30, tb - ta)));
    const amp = t < P.tEnd ? Math.abs(Math.cos(Math.PI * u)) : 0.3;
    // crossing i goes into the right dee when i is even; the dee ahead is − then, until the p.d. reverses
    const rightAhead = (u < 0.5 ? i : i + 1) % 2 === 0;
    S.dees[0].emissive.copy(rightAhead ? MINUS : PLUS).multiplyScalar(0.06 + 0.22 * amp);
    S.dees[1].emissive.copy(rightAhead ? PLUS : MINUS).multiplyScalar(0.06 + 0.22 * amp);
    let n = 0, ng = 0;
    if (!now.done) {
      // the particle and a short tail: where it was over the last twentieth of a half-turn
      const Th = (Math.PI * Math.hypot(now.p * 3e8, P.m * 9e16)) / (9e16 * P.B * P.q);   // πγm/QB
      for (let k = 0; k < 26; k++) {
        const q = k ? cycloAt(P, Math.max(0, t - k * Th * 0.012)) : now;
        n = this.#put(this.#beam, n, [q.x * sc, 0, q.z * sc], [1.6, 0.95, 0.5], 0.34 - k * 0.009, 1 - k / 28);
      }
    } else if (L.playing && this.time.value - this.#lastBurst > 0.5) {
      this.#lastBurst = this.time.value;
      this.#spark(S.exit[1], 100, 3.5, [1.2, 0.85, 0.5]);
    }
    // the field in the gap, strongest as the p.d. peaks
    const gw = Math.max(0.08, P.g * sc);
    for (let k = 0; k < 90; k++) ng = this.#put(this.#glow, ng, [(rand() - 0.5) * gw, (rand() - 0.5) * 0.8, (rand() * 2 - 1) * 5.8], [1.1, 1.0, 0.5], 0.06, 0.45 * amp);
    this.#tick({ v: now.v, p: now.p, stage: now.done ? 'extracted' : now.kind === 'gap' ? 'accelerating across the gap' : now.kind === 'out' ? 'leaving through the deflector' : 'coasting round a dee', k: now.half, r: now.r }, t);
    return [n, ng];
  }

  /* ---------- synchrotron (LHC) ---------- */

  #buildSync() {
    const g = this.#groups.sync;
    clear(g, this.tex);
    const R = 8;
    const pipe = new THREE.Mesh(new THREE.TorusGeometry(R, 0.18, 12, 200), metal(0x8a93ad, { transparent: true, opacity: 0.35, depthWrite: false }));
    pipe.rotation.x = Math.PI / 2; g.add(pipe);
    const ips = [Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 0];       // ATLAS (front), ALICE, CMS (back), LHCb
    const names = ['ATLAS', 'ALICE', 'CMS', 'LHCb'];
    const dipoles: THREE.MeshStandardMaterial[] = [];
    const nd = 32;
    for (let i = 0; i < nd; i++) {
      const th = ((i + 0.5) / nd) * Math.PI * 2;
      if (ips.some((a) => Math.abs(Math.atan2(Math.sin(th - a), Math.cos(th - a))) < 0.2)) continue;
      const isRF = i === 4 || i === 20;
      const mat = isRF ? metal(0xb08a30, { emissive: new THREE.Color(0.12, 0.08, 0.01), metalness: 0.6 }) : metal(0x1d3f94, { emissive: new THREE.Color(0, 0, 0), roughness: 0.55 });
      const box = new THREE.Mesh(isRF ? new THREE.CylinderGeometry(0.55, 0.55, 1.1, 24) : new THREE.BoxGeometry(0.9, 0.7, 1.25), mat);
      box.position.set(R * Math.cos(th), 0, R * Math.sin(th));
      if (isRF) { box.rotation.set(Math.PI / 2, 0, 0); box.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -th); }
      else box.rotation.y = -th;
      g.add(box);
      if (!isRF) dipoles.push(mat);
      if (i === 20) { const l = label('RF cavity: accelerates', 0.42, '#ffe08a'); l.position.set(R * 1.25 * Math.cos(th), 1.1, R * 1.25 * Math.sin(th)); g.add(l); }
      if (i === 27) { const l = label('dipole magnets: bend (r = p/BQ)', 0.42, '#a9c2ff'); l.position.set(R * 1.3 * Math.cos(th), 1.3, R * 1.3 * Math.sin(th)); g.add(l); }
    }
    ips.forEach((a, k) => {
      const det = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.8, 32), metal(0x6b7290, { transparent: true, opacity: 0.55, depthWrite: false }));
      det.rotation.set(0, Math.PI / 2 - a, Math.PI / 2);
      det.position.set(R * Math.cos(a), 0, R * Math.sin(a));
      g.add(det);
      const l = label(names[k], 0.45, '#ffffff'); l.position.set(R * Math.cos(a), 1.7, R * Math.sin(a)); g.add(l);
    });
    this.#syn = { dipoles, ips };
  }
  #sync(L: ALook, dt: number): [number, number] {
    void dt;
    if (!this.#key.sync) { this.#key.sync = 'built'; this.#buildSync(); }
    const S = this.#syn!, R = 8;
    for (const m of S.dipoles) m.emissive.setRGB(0.01 + 0.05 * L.sync.B, 0.03 + 0.12 * L.sync.B, 0.08 + 0.3 * L.sync.B);
    let n = 0;
    const nb = this.small ? 16 : 28, per = this.small ? 7 : 10;   // drawn bunches (a multiple of 4, so they meet in the detectors)
    const w = 2 * Math.PI * L.sync.frev;                            // real angular speed, rad s⁻¹
    const ph = w * this.#t;
    const ipDist = (th: number) => Math.min(...S.ips.map((a) => Math.abs(Math.atan2(Math.sin(th - a), Math.cos(th - a)))));
    // a tail as long as the distance covered in a short time on screen
    const tail = Math.min(0.25, Math.max(0.004, w * L.scale * 0.02) / per);
    for (const dir of [1, -1]) {
      const col: [number, number, number] = dir > 0 ? [1.5, 0.45, 0.35] : [0.4, 0.7, 1.6];
      for (let b = 0; b < nb; b++) {
        const th0 = dir * ph + (b / nb) * Math.PI * 2;
        for (let i = 0; i < per; i++) {
          const th = th0 - dir * i * tail;
          const off = dir * 0.16 * Math.min(1, ipDist(th) / 0.3);
          const r = R + off;
          n = this.#put(this.#beam, n, [r * Math.cos(th), gauss() * 0.02, r * Math.sin(th)], col, i ? 0.17 : 0.28, 1 - i / per);
        }
      }
    }
    // the bunches meet in the detectors every time the ring turns by 2π/nb
    const meet = Math.floor(ph / ((2 * Math.PI) / nb));
    if (L.playing && meet !== this.#lastMeet && this.time.value - this.#lastBurst > 0.2) {
      this.#lastBurst = this.time.value;
      for (const a of S.ips) this.#spark(new THREE.Vector3(R * Math.cos(a), 0, R * Math.sin(a)), 30, 2.2, [1.4, 1.2, 0.7], 0.6);
    }
    this.#lastMeet = meet;
    this.#tick({ v: 0, p: 0, stage: 'circulating', k: Math.floor(this.#t * L.sync.frev), r: 0 }, this.#t);
    return [n, 0];
  }
}
