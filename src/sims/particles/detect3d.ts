/* Particle Lab: the 3D detectors (three.js).

   Cloud chamber: a round chamber on a cold black plate, a thin sensitive layer just above it where the alcohol
   vapour is supersaturated. Tracks are lines of droplets that form in a fraction of a second, drift down and fade.
   Bubble chamber: the window of a liquid-hydrogen chamber with fiducial crosses, the field out of the window;
   each event's bubbles appear as the particles move, and stay (as on the photograph).
   Collider detector: a cut-away cylinder of layers; fired particles leave tracker hits, showers or muon hits.

   Coordinates: the 2D tracks from detect.ts are in cm. Cloud: (u, v) → (x, z) = (u, −v) × 0.5 with B up (+y), so the
   camera above sees the same handedness. Bubble: (u, v) → (x, y) × 0.15 with B along +z, towards the camera.
   Collider: metres × 0.75 in the transverse plane (x, y), beams along z. */

import { Stage3D, THREE, pointCloud, label, fin } from './gl';
import {
  bubbleEvents, cloudEmit, backgroundTrack, holders, csource, seeded, CLOUD_R, CLOUD_B, LAYERS, COLLIDER_B, SHOTS,
  type Track, type BEvent, type Shot, type TPt, type Emit,
} from './detect';

export type Det = 'cloud' | 'bubble' | 'collider';
export interface DLook {
  det: Det; srcs: string[]; together: boolean; cosmic: boolean; radon: boolean;
  field: boolean; ev: number; playing: boolean; run: number; speed: number; neutral: boolean;
  bmode: 'classic' | 'collide'; ckey: number;
  fire: { id: Shot; n: number }[];
}
export interface Picked { track: Track; k: number }

const SC = 0.5, SB = 0.15, SL = 0.75;
const EVENTS = bubbleEvents();

interface Live { track: Track; born: number; life: number; id: number; world: THREE.Vector3[] }
interface ShotLive { id: Shot; born: number; world: THREE.Vector3[]; track: Track; dur: number }

export class DetectScene extends Stage3D<DLook> {
  #mode: Det | '' = '';
  #rnd = seeded(7);

  /* cloud */
  #cloud = new THREE.Group();
  #mist = pointCloud(this.small ? 1200 : 2600, this.px);
  #mistSeed: Float32Array;
  #drops = pointCloud(this.small ? 26000 : 46000, this.px);
  #dVel: Float32Array;
  #dBirth: Float32Array;
  #dLife: Float32Array;
  #dTrack: Int32Array;
  #dBase: Float32Array;
  #dNext = 0;
  #live: Live[] = [];
  #nextId = 1;
  #cloudT = 0;
  #bArrow: THREE.ArrowHelper;
  #bLabel: THREE.Sprite;
  #holderGroup = new THREE.Group();
  #holderKey = '';

  /* bubble */
  #bubble = new THREE.Group();
  #bub = pointCloud(this.small ? 30000 : 50000, this.px);
  #bT: Float32Array;          // time each bubble forms
  #bTrack: Int16Array;
  #bBase: Float32Array;       // base brightness
  #bCount = 0;
  #heads: ReturnType<typeof pointCloud>;
  #neutralLines = new THREE.Group();
  #vertexLabels = new THREE.Group();
  #evT = 0;
  #evKey = '';
  #cur: BEvent | null = null;
  #custom: BEvent | null = null;
  #customKey = -1;
  #run = -1;
  #bubbleWorld: THREE.Vector3[][] = [];

  /* collider */
  #collider = new THREE.Group();
  #hits = pointCloud(this.small ? 22000 : 36000, this.px);
  #hT: Float32Array;
  #hBase: Float32Array;
  #hShot: Int16Array;
  #hN = 0;
  #shots: ShotLive[] = [];
  #fired = new Map<number, number>();  // index in look.fire → n handled
  #missing = new THREE.Group();
  #colT = 0;

  /* picking */
  #pick: { kind: Det; id: number; k: number } | null = null;
  #ring: THREE.Line;
  #ringLabel: THREE.Sprite | null = null;
  #mark: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [0, 7.5, 7.5], bloom: [0.75, 0.5, 0.55] });

    /* ===== cloud chamber ===== */
    {
      const g = this.#cloud;
      const R = CLOUD_R * SC;
      // the cold plate, black (dry ice underneath), with a faint blue sheen at the edge
      const plate = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshBasicMaterial({ color: 0x050608 }));
      plate.rotation.x = -Math.PI / 2;
      g.add(plate);
      const sheen = new THREE.Mesh(new THREE.RingGeometry(R * 0.92, R, 96), new THREE.MeshBasicMaterial({ color: 0x1b2a4a, transparent: true, opacity: 0.5 }));
      sheen.rotation.x = -Math.PI / 2; sheen.position.y = 0.002;
      g.add(sheen);
      // glass wall and rims
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 2.6, 96, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }));
      wall.position.y = 1.3;
      g.add(wall);
      for (const y of [0, 2.6]) {
        const pts = Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos((i / 128) * Math.PI * 2) * R, y, Math.sin((i / 128) * Math.PI * 2) * R));
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x5d6f9a, transparent: true, opacity: 0.6 })));
      }
      // the felt ring soaked in alcohol, at the top
      const felt = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.995, R * 0.995, 0.3, 96, 1, true), new THREE.MeshBasicMaterial({ color: 0x3a2f4a, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
      felt.position.y = 2.45;
      g.add(felt);
      // the sources sit on holders, rebuilt whenever the choice changes
      g.add(this.#holderGroup);
      // lamp glow from the side, as in a school demonstration
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0x9fb4ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      lamp.position.set(R * 1.05, 0.4, -R * 0.4); lamp.scale.setScalar(3.2);
      g.add(lamp);
      // the mist: droplets falling gently through the chamber
      const n = this.#mist.n;
      this.#mistSeed = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const a = this.#rnd() * Math.PI * 2, r = Math.sqrt(this.#rnd()) * R * 0.97;
        this.#mistSeed.set([Math.cos(a) * r, this.#rnd() * 2.5, Math.sin(a) * r, this.#rnd()], i * 4);
        this.#mist.col.set([0.55, 0.62, 0.8], i * 3);
        this.#mist.size[i] = 0.025 + this.#rnd() * 0.03;
      }
      g.add(this.#mist.obj);
      // droplets of the tracks
      const m = this.#drops.n;
      this.#dVel = new Float32Array(m * 3); this.#dBirth = new Float32Array(m).fill(-99); this.#dLife = new Float32Array(m).fill(1);
      this.#dTrack = new Int32Array(m); this.#dBase = new Float32Array(m);
      g.add(this.#drops.obj);
      // B up, when the magnet is on
      this.#bArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(R * 0.72, 0.02, -R * 0.62), 2.3, 0x7fb2ff, 0.4, 0.22);
      g.add(this.#bArrow);
      this.#bLabel = label(`B = ${CLOUD_B} T`, 0.32, '#9cc2ff');
      this.#bLabel.position.set(R * 0.72, 2.65, -R * 0.62);
      g.add(this.#bLabel);
      this.scene.add(g);
    }

    /* ===== bubble chamber ===== */
    {
      const g = this.#bubble;
      const W = 80 * SB, Hh = 50 * SB;
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh), new THREE.MeshBasicMaterial({ color: 0x0b1424, transparent: true, opacity: 0.9 }));
      glass.position.z = -0.08;
      g.add(glass);
      const edge = [[-W / 2, -Hh / 2], [W / 2, -Hh / 2], [W / 2, Hh / 2], [-W / 2, Hh / 2], [-W / 2, -Hh / 2]].map(([x, y]) => new THREE.Vector3(x, y, -0.07));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(edge), new THREE.LineBasicMaterial({ color: 0x4a6aa8 })));
      // fiducial crosses engraved on the windows (used to measure tracks on the photographs)
      const crosses: THREE.Vector3[] = [];
      for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) {
        const x = i * 10 * SB * 1.3, y = j * 10 * SB * 1.0, s = 0.12;
        crosses.push(new THREE.Vector3(x - s, y, -0.06), new THREE.Vector3(x + s, y, -0.06), new THREE.Vector3(x, y - s, -0.06), new THREE.Vector3(x, y + s, -0.06));
      }
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(crosses), new THREE.LineBasicMaterial({ color: 0x2b4170 })));
      // B out of the window: a field of ⊙ marks and an arrow
      const dots: THREE.Vector3[] = [];
      for (let i = -5; i <= 5; i++) for (let j = -3; j <= 3; j++) {
        const cx = (i + 0.5) * 1.1, cy = (j + 0.5) * 1.1;
        if (Math.abs(cx) > W / 2 - 0.3 || Math.abs(cy) > Hh / 2 - 0.3) continue;
        for (let k = 0; k <= 16; k++) dots.push(new THREE.Vector3(cx + Math.cos((k / 16) * Math.PI * 2) * 0.09, cy + Math.sin((k / 16) * Math.PI * 2) * 0.09, -0.05));
      }
      const dm = new THREE.Points(new THREE.BufferGeometry().setFromPoints(dots), new THREE.PointsMaterial({ color: 0x1e3156, size: 1.5, sizeAttenuation: false }));
      g.add(dm);
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(W / 2 - 0.6, Hh / 2 - 0.6, -0.05), 1.4, 0x7fb2ff, 0.35, 0.2);
      g.add(arrow);
      const bl = label('B', 0.34, '#9cc2ff');
      bl.position.set(W / 2 - 0.6, Hh / 2 - 0.6, 1.6);
      g.add(bl);
      const n = this.#bub.n;
      this.#bT = new Float32Array(n); this.#bTrack = new Int16Array(n); this.#bBase = new Float32Array(n);
      g.add(this.#bub.obj);
      this.#heads = pointCloud(64, this.px);
      g.add(this.#heads.obj);
      g.add(this.#neutralLines);
      g.add(this.#vertexLabels);
      this.scene.add(g);
    }

    /* ===== collider detector ===== */
    {
      const g = this.#collider;
      const L = 7;
      const COL: Record<string, number> = { tracker: 0x6fa8ff, ecal: 0x3fd6a0, hcal: 0xf0a04a, coil: 0xb0b6c8, muon: 0xd46cff };
      for (const ly of LAYERS) {
        const c = COL[ly.id];
        for (const r of [ly.r0, ly.r1]) {
          if (ly.id === 'muon') continue;   // the big outer layer only as rings, or it veils everything
          const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r * SL, r * SL, L, 96, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.04, side: THREE.DoubleSide, depthWrite: false }));
          cyl.rotation.x = Math.PI / 2;
          g.add(cyl);
          for (const z of [-L / 2, L / 2]) {
            const pts = Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos((i / 128) * Math.PI * 2) * r * SL, Math.sin((i / 128) * Math.PI * 2) * r * SL, z));
            g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: z > 0 ? 0.75 : 0.25 })));
          }
        }
        // the end face: a coloured ring showing the onion
        const face = new THREE.Mesh(new THREE.RingGeometry(ly.r0 * SL, ly.r1 * SL, 96), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: ly.id === 'muon' ? 0.025 : 0.08, side: THREE.DoubleSide, depthWrite: false }));
        face.position.z = L / 2;
        g.add(face);
        if (ly.id === 'tracker') {
          // silicon layers
          for (const r of [0.07, 0.11, 0.16, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05]) {
            const pts = Array.from({ length: 97 }, (_, i) => new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2) * r * SL, Math.sin((i / 96) * Math.PI * 2) * r * SL, L / 2));
            g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.22 })));
          }
        }
        if (ly.id === 'muon') {
          // iron between the muon stations
          for (const r of [4.6, 5.4, 6.3]) {
            const ring = new THREE.Mesh(new THREE.RingGeometry((r - 0.25) * SL, r * SL, 96), new THREE.MeshBasicMaterial({ color: 0x8a5a5a, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
            ring.position.z = L / 2 + 0.001;
            g.add(ring);
          }
          // the muon stations: thin gas layers between the iron
          for (const r of [4.2, 4.95, 5.85, 6.8]) {
            const pts = Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos((i / 128) * Math.PI * 2) * r * SL, Math.sin((i / 128) * Math.PI * 2) * r * SL, L / 2));
            g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.35 })));
          }
        }
        const lb = label(ly.name, 0.26, '#' + c.toString(16).padStart(6, '0'));
        const la = ({ tracker: 215, ecal: 160, hcal: 118, coil: 72, muon: 32 } as Record<string, number>)[ly.id] * Math.PI / 180;
        const lr = ((ly.r0 + ly.r1) / 2) * SL;
        lb.position.set(Math.cos(la) * lr, Math.sin(la) * lr, L / 2 + 0.05);
        g.add(lb);
      }
      const pipe = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -L / 2 - 1.5), new THREE.Vector3(0, 0, L / 2 + 1.5)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
      g.add(pipe);
      const n = this.#hits.n;
      this.#hT = new Float32Array(n); this.#hBase = new Float32Array(n); this.#hShot = new Int16Array(n);
      g.add(this.#hits.obj);
      g.add(this.#missing);
      this.scene.add(g);
    }

    /* picking marks */
    this.#ring = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffc861, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.9 }));
    this.#ring.visible = false;
    this.scene.add(this.#ring);
    this.#mark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffc861 }));
    this.#mark.visible = false;
    this.scene.add(this.#mark);

    this.start();
  }

  /* ---------- switching detector ---------- */
  #enter(d: Det) {
    this.#mode = d;
    this.#cloud.visible = d === 'cloud';
    this.#bubble.visible = d === 'bubble';
    this.#collider.visible = d === 'collider';
    this.clearPick();
    // pull back on a narrow (phone) view so the whole apparatus fits
    const f = Math.max(1, 1.5 / Math.max(0.4, this.camera.aspect));
    if (d === 'cloud') this.setHome([0, 9.4 * f, 8.4 * f], [0, 0.2, 0]);
    else if (d === 'bubble') this.setHome([0, -1.0 * f, 11.2 * f], [0, 0, 0]);
    else this.setHome([4.6 * f, 3.0 * f, 13 * f], [0, 0, 0]);
  }

  protected update(dt: number) {
    const L = this.look!;
    if (L.det !== this.#mode) this.#enter(L.det);
    const sdt = L.playing ? dt * L.speed : 0;
    if (L.det === 'cloud') this.#updCloud(sdt, L);
    else if (L.det === 'bubble') this.#updBubble(sdt, L);
    else this.#updCollider(sdt, L);
    this.#updPickRing();
  }

  /* ======================= cloud chamber ======================= */

  #spawn(tracks: Track[]) {
    for (const tr of tracks) {
      if (tr.pts.length < 2) continue;
      const alpha = tr.pid === 'alpha', muon = tr.pid === 'mu' || tr.pid === 'anti-mu';
      const id = this.#nextId++;
      const life = alpha ? 2.6 : muon ? 1.8 : 1.6;
      const world = tr.pts.map((p) => new THREE.Vector3(p.x * SC, 0.25, -p.y * SC));
      this.#live.push({ track: tr, born: tr.pts[0].t, life, id, world });
      // droplets along it: number per cm ∝ ionisation
      const d = this.#drops;
      const per = alpha ? 4.5 : muon ? 5 : 8;
      for (let i = 1; i < tr.pts.length; i++) {
        const a = tr.pts[i - 1], b = tr.pts[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        let count = len * per * b.d;
        while (count > 0) {
          if (count < 1 && this.#rnd() > count) break;
          count--;
          const f = this.#rnd();
          const j = this.#dNext; this.#dNext = (this.#dNext + 1) % d.n;
          const spread = alpha ? 0.05 : 0.02;
          const x = (a.x + (b.x - a.x) * f) * SC + (this.#rnd() - 0.5) * spread, z = -(a.y + (b.y - a.y) * f) * SC + (this.#rnd() - 0.5) * spread;
          d.pos.set([x, 0.25 + (this.#rnd() - 0.5) * 0.04, z], j * 3);
          this.#dVel.set([(this.#rnd() - 0.5) * 0.03, -0.05 - this.#rnd() * 0.05, (this.#rnd() - 0.5) * 0.03], j * 3);
          this.#dBirth[j] = a.t + (b.t - a.t) * f + 0.05;
          this.#dLife[j] = life * (0.8 + this.#rnd() * 0.4);
          this.#dTrack[j] = id;
          this.#dBase[j] = muon ? 0.55 : alpha ? 0.75 : 0.8;
          d.size[j] = (alpha ? 0.05 : 0.035) * (0.7 + this.#rnd() * 0.6);
        }
      }
    }
  }

  /** Little source capsules on holders, one per solid source (or one holder for a mixed sample). */
  #buildHolders(L: DLook) {
    const key = L.srcs.join(',') + L.together;
    if (key === this.#holderKey) return;
    this.#holderKey = key;
    const g = this.#holderGroup;
    for (const o of [...g.children]) { g.remove(o); o.traverse((c) => { const m = c as THREE.Mesh; m.geometry?.dispose(); const mt = m.material as THREE.Material | undefined; (mt as THREE.SpriteMaterial | undefined)?.map?.dispose(); mt?.dispose(); }); }
    const hs = holders(L.srcs, L.together);
    const seen = new Set<string>();
    for (const h of hs) {
      const at = `${h.x.toFixed(2)},${h.y.toFixed(2)}`;
      if (seen.has(at)) continue;
      seen.add(at);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 24), new THREE.MeshBasicMaterial({ color: 0xb9a36a }));
      cap.position.set(h.x * SC, 0.25, -h.y * SC);
      cap.rotation.z = Math.PI / 2; cap.rotation.y = h.dir;
      g.add(cap);
      const names = L.together ? hs.map((x) => csource(x.id).label).join(' + ') : csource(h.id).label;
      const lb = label(names.length > 34 ? 'mixed source' : names, 0.26);
      lb.position.set(h.x * SC, 0.7, -h.y * SC);
      g.add(lb);
    }
  }

  #updCloud(dt: number, L: DLook) {
    this.#cloudT += dt;
    const B = L.field ? CLOUD_B : 0;
    this.#bArrow.visible = this.#bLabel.visible = L.field;
    this.#buildHolders(L);
    if (dt > 0) {
      const hs = holders(L.srcs, L.together);
      // several sources at once share the time: each keeps its own rate
      for (const id of L.srcs) {
        const src = csource(id);
        if (this.#rnd() >= src.rate * dt) continue;
        const tot = src.mix.reduce((x, [w]) => x + w, 0);
        let u = this.#rnd() * tot, e: Emit = src.mix[0][1];
        for (const [w, em] of src.mix) { if ((u -= w) <= 0) { e = em; break; } }
        const h = hs.find((x) => x.id === id);
        const o = src.gas || !h ? { x: (this.#rnd() * 2 - 1) * 6, y: (this.#rnd() * 2 - 1) * 6, dir: null, spread: 0 } : { x: h.x, y: h.y, dir: h.dir, spread: L.together ? 0.6 : 0.45 };
        if (src.gas) { const a = this.#rnd() * Math.PI * 2, r = Math.sqrt(this.#rnd()) * CLOUD_R * 0.75; o.x = Math.cos(a) * r; o.y = Math.sin(a) * r; }
        this.#spawn(cloudEmit(e, o, B, this.#rnd, this.#cloudT));
      }
      if (L.cosmic && this.#rnd() < 0.32 * dt) this.#spawn(backgroundTrack('muon', B, this.#rnd, this.#cloudT));
      if (L.cosmic && this.#rnd() < 0.025 * dt) this.#spawn(backgroundTrack('shower', B, this.#rnd, this.#cloudT));
      if (L.radon && this.#rnd() < 0.06 * dt) this.#spawn(backgroundTrack('radon', B, this.#rnd, this.#cloudT));
      if (L.radon && this.#rnd() < 0.012 * dt) this.#spawn(backgroundTrack('thoron', B, this.#rnd, this.#cloudT));
    }
    const t = this.#cloudT;
    // the mist sinks slowly and loops back to the top
    const m = this.#mist, s = this.#mistSeed;
    for (let i = 0; i < m.n; i++) {
      const y = (((s[i * 4 + 1] - t * 0.12 * (0.5 + s[i * 4 + 3])) % 2.5) + 2.5) % 2.5;
      m.pos[i * 3] = s[i * 4] + Math.sin(t * 0.3 + s[i * 4 + 3] * 20) * 0.05;
      m.pos[i * 3 + 1] = y;
      m.pos[i * 3 + 2] = s[i * 4 + 2] + Math.cos(t * 0.27 + s[i * 4 + 3] * 17) * 0.05;
      m.alpha[i] = 0.05 + 0.13 * (1 - y / 2.5) ** 2;   // thickest near the cold plate
    }
    m.flush();
    // droplets: form fast, drift down, fade
    const d = this.#drops;
    const pickId = this.#pick?.kind === 'cloud' ? this.#pick.id : -1;
    for (let i = 0; i < d.n; i++) {
      const age = t - this.#dBirth[i];
      if (age < 0 || age > this.#dLife[i]) { d.alpha[i] = 0; continue; }
      if (dt > 0) {
        d.pos[i * 3] += this.#dVel[i * 3] * dt; d.pos[i * 3 + 1] += this.#dVel[i * 3 + 1] * dt * 0.4; d.pos[i * 3 + 2] += this.#dVel[i * 3 + 2] * dt;
      }
      const f = Math.min(1, age / 0.12) * (1 - age / this.#dLife[i]) ** 1.3;
      const hot = this.#dTrack[i] === pickId;
      d.alpha[i] = fin(f * this.#dBase[i] * (hot ? 1.4 : 1));
      if (hot) d.col.set([1.4, 0.85, 0.3], i * 3); else d.col.set([0.85, 0.9, 1.0], i * 3);
    }
    d.flush();
    // forget tracks that have faded
    this.#live = this.#live.filter((l) => t - l.born < l.life + 0.5 || l.born > t || l.id === pickId);
  }

  /* ======================= bubble chamber ======================= */

  /** A collision from the collision lab: shown in place of the classic events while the lab is open. */
  showCollision(ev: BEvent, key: number) { this.#custom = ev; this.#customKey = key; this.clearPick(); this.kick(); }

  #buildEvent(ev: BEvent, seed: number) {
    const b = this.#bub;
    let n = 0;
    this.#bubbleWorld = [];
    const rnd = seeded(100 + seed);
    for (const [k, tr] of ev.tracks.entries()) {
      this.#bubbleWorld.push(tr.pts.map((p) => new THREE.Vector3(p.x * SB, p.y * SB, 0)));
      if (tr.neutral) continue;
      for (let j = 1; j < tr.pts.length; j++) {
        const a = tr.pts[j - 1], c = tr.pts[j];
        const len = Math.hypot(c.x - a.x, c.y - a.y);
        let count = len * 5.5 * Math.min(c.d, 4.5);
        while (count > 0 && n < b.n) {
          if (count < 1 && rnd() > count) break;
          count--;
          const f = rnd();
          const jit = 0.012 * Math.min(c.d, 4);
          b.pos.set([(a.x + (c.x - a.x) * f) * SB + (rnd() - 0.5) * jit, (a.y + (c.y - a.y) * f) * SB + (rnd() - 0.5) * jit, (rnd() - 0.5) * 0.02], n * 3);
          this.#bT[n] = a.t + (c.t - a.t) * f;
          this.#bTrack[n] = k;
          this.#bBase[n] = 0.6 + 0.06 * Math.min(c.d, 4);
          b.size[n] = 0.045 + 0.012 * Math.min(c.d, 5) + rnd() * 0.01;
          n++;
        }
      }
    }
    this.#bCount = n;
    // neutral particles: dashed lines, shown on request
    for (const o of [...this.#neutralLines.children]) { this.#neutralLines.remove(o); (o as THREE.Line).geometry.dispose(); ((o as THREE.Line).material as THREE.Material).dispose(); }
    for (const [k, tr] of ev.tracks.entries()) {
      if (!tr.neutral) continue;
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.#bubbleWorld[k]), new THREE.LineDashedMaterial({ color: 0x8fa6d8, dashSize: 0.14, gapSize: 0.12, transparent: true, opacity: 0.75 }));
      line.computeLineDistances();
      line.userData = { t0: tr.pts[0].t, t1: tr.pts[tr.pts.length - 1].t, n: tr.pts.length };
      this.#neutralLines.add(line);
    }
    for (const o of [...this.#vertexLabels.children]) { this.#vertexLabels.remove(o); ((o as THREE.Sprite).material as THREE.SpriteMaterial).map?.dispose(); ((o as THREE.Sprite).material as THREE.Material).dispose(); }
    for (const v of ev.vertex ?? []) {
      const s = label(v.label, 0.28, '#ffd58a');
      s.position.set(v.x * SB, v.y * SB + 0.42, 0.1);
      const tAt = Math.min(...ev.tracks.flatMap((t) => t.pts.filter((p) => Math.hypot(p.x - v.x, p.y - v.y) < 0.3).map((p) => p.t)), ev.dur);
      s.userData = { t: tAt };
      this.#vertexLabels.add(s);
    }
    this.#cur = ev;
  }

  #updBubble(dt: number, L: DLook) {
    const i = Math.max(0, Math.min(EVENTS.length - 1, L.ev));
    const coll = L.bmode === 'collide';
    const key = coll ? `c${this.#customKey}` : `e${i}`;
    if (key !== this.#evKey) {
      this.#evKey = key; this.#evT = 0; this.clearPick();
      if (coll && this.#custom) this.#buildEvent(this.#custom, this.#customKey);
      else if (coll) { this.#cur = null; this.#bCount = 0; }
      else this.#buildEvent(EVENTS[i], i);
    }
    if (L.run !== this.#run) { this.#run = L.run; this.#evT = 0; }
    const ev = this.#cur;
    if (!ev) { this.#bub.flush(0); this.#heads.flush(0); for (const o of this.#neutralLines.children) o.visible = false; for (const o of this.#vertexLabels.children) o.visible = false; return; }
    this.#evT = Math.min(ev.dur + 0.5, this.#evT + dt * 0.8);
    const t = this.#evT;
    const b = this.#bub;
    const pk = this.#pick?.kind === 'bubble' ? this.#pick.id : -1;
    for (let j = 0; j < this.#bCount; j++) {
      const age = t - this.#bT[j];
      if (age < 0) { b.alpha[j] = 0; continue; }
      const grow = Math.min(1, age / 0.25);
      const hot = this.#bTrack[j] === pk;
      b.alpha[j] = this.#bBase[j] * (0.35 + 0.65 * grow) * (hot ? 1.5 : 1);
      if (hot) b.col.set([1.5, 0.85, 0.25], j * 3);
      else b.col.set([0.78 + 0.5 * (1 - grow), 0.88 + 0.4 * (1 - grow), 1.0], j * 3);
    }
    b.flush(this.#bCount);
    // the moving heads of the particles
    const h = this.#heads;
    let hn = 0;
    for (const tr of ev.tracks) {
      if (tr.neutral || hn >= h.n) continue;
      const pts = tr.pts;
      if (t < pts[0].t || t > pts[pts.length - 1].t) continue;
      let lo = 0, hi = pts.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].t <= t) lo = m; else hi = m; }
      h.pos.set([pts[lo].x * SB, pts[lo].y * SB, 0.01], hn * 3);
      h.col.set([1.4, 1.3, 1.1], hn * 3);
      h.size[hn] = 0.22; h.alpha[hn] = 0.9;
      hn++;
    }
    h.flush(hn);
    for (const o of this.#neutralLines.children) {
      const line = o as THREE.Line, u = line.userData as { t0: number; t1: number; n: number };
      const f = Math.max(0, Math.min(1, (t - u.t0) / Math.max(0.01, u.t1 - u.t0)));
      line.visible = L.neutral && f > 0;
      line.geometry.setDrawRange(0, Math.ceil(f * u.n));
    }
    for (const o of this.#vertexLabels.children) o.visible = t >= (o.userData as { t: number }).t + 0.1;
  }

  /** Seconds of the current event still to draw (0 when it is complete). */
  get eventLeft() { const ev = this.#cur; return ev ? Math.max(0, ev.dur - this.#evT) : 0; }

  /* ======================= collider detector ======================= */

  #fire(id: Shot) {
    const sh = SHOTS.find((s) => s.id === id)!;
    const rnd = this.#rnd;
    const phi = rnd() * Math.PI * 2, slope = (rnd() - 0.5) * 0.5;
    const pGeV = 1.2 + rnd() * 2.2;
    const q = id === 'e' || id === 'mu' ? -1 : id === 'pi+' ? 1 : 0;
    const rT = q ? pGeV / (0.3 * COLLIDER_B) : Infinity; // m
    const tracker = LAYERS[0], ecal = LAYERS[1], hcal = LAYERS[2], coil = LAYERS[3], mu = LAYERS[4];
    const stopR = sh.stops === 'ecal' ? ecal.r0 + 0.12 : sh.stops === 'hcal' ? hcal.r0 + 0.25 : sh.stops === 'escapes' ? mu.r1 + 0.4 : 0;
    // path in the transverse plane, stepped (m); charged particles curve inside the solenoid only
    const path: { x: number; y: number; z: number; r: number }[] = [];
    let x = 0, y = 0, ang = phi, s = 0;
    const ds = 0.02;
    while (Math.hypot(x, y) < stopR && s < 20) {
      const R = Math.hypot(x, y);
      if (q && R < coil.r0) ang -= Math.sign(q) * ds / rT;
      x += Math.cos(ang) * ds; y += Math.sin(ang) * ds; s += ds;
      path.push({ x, y, z: s * slope, r: q && R < coil.r0 ? rT * 100 : Infinity });
    }
    const v = 6; // m per second of animation
    const k0 = this.#hN;
    const H = this.#hits;
    const shotIdx = this.#shots.length;
    const put = (px: number, py: number, pz: number, t: number, c: [number, number, number], size: number, base: number) => {
      const j = this.#hN % H.n; this.#hN++;
      H.pos.set([px * SL, py * SL, pz * SL], j * 3); H.col.set(c, j * 3); H.size[j] = size; this.#hT[j] = this.#colT + t; this.#hBase[j] = base; this.#hShot[j] = shotIdx;
    };
    const silicon = [0.07, 0.11, 0.16, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05];
    let li = 0;
    for (const [i, p] of path.entries()) {
      const R = Math.hypot(p.x, p.y), t = (i * ds) / v;
      if (q) {
        if (R < tracker.r1) {
          if (i % 2 === 0) put(p.x, p.y, p.z, t, [0.45, 0.7, 1.4], 0.03, 0.35);  // the reconstructed track
          if (li < silicon.length && R >= silicon[li]) { put(p.x, p.y, p.z, t, [1.3, 1.5, 1.8], 0.09, 1); li++; }
        } else if (id === 'mu' && i % 3 === 0) put(p.x, p.y, p.z, t, [0.9, 0.55, 1.4], 0.03, 0.3);
        if (id === 'mu' && R > mu.r0 && i % 2 === 0 && [4.2, 4.95, 5.85, 6.8].some((r) => Math.abs(R - r) < 0.12)) put(p.x, p.y, p.z, t, [1.6, 0.6, 1.9], 0.1, 1);
      }
    }
    // showers
    const end = path[path.length - 1] ?? { x: 0, y: 0, z: 0 };
    const tEnd = path.length * ds / v;
    const shower = (len: number, wid: number, nPts: number, col: [number, number, number], fromR: number) => {
      const ux = Math.cos(Math.atan2(end.y, end.x)), uy = Math.sin(Math.atan2(end.y, end.x));
      const sx0 = ux * fromR, sy0 = uy * fromR;
      for (let k = 0; k < nPts; k++) {
        const depth = len * Math.pow(rnd(), 0.7);
        const spread = wid * (depth / len) * Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * 0.5;
        const a = rnd() * Math.PI * 2;
        const ox = -uy * Math.cos(a) * spread, oy = ux * Math.cos(a) * spread, oz = Math.sin(a) * spread;
        put(sx0 + ux * depth + ox, sy0 + uy * depth + oy, end.z + oz, tEnd + depth / 3, col, 0.05 + rnd() * 0.05, 0.75);
      }
    };
    if (sh.stops === 'ecal') shower(0.42, 0.18, 420, [0.4, 1.5, 0.9], ecal.r0);
    if (id === 'pi+') shower(0.12, 0.08, 60, [0.4, 1.3, 0.8], ecal.r0);   // a little energy in the ECAL first
    if (sh.stops === 'hcal') shower(1.0, 0.55, 700, [1.6, 0.85, 0.3], hcal.r0);
    // world points for picking, and the track's numbers
    const world = path.filter((_, i) => i % 3 === 0).map((p) => new THREE.Vector3(p.x * SL, p.y * SL, p.z * SL));
    const tpts: TPt[] = path.filter((_, i) => i % 3 === 0).map((p, i) => ({ x: p.x * 100, y: p.y * 100, r: p.r, p: pGeV * 1000, t: (i * 3 * ds) / v, d: 1 }));
    const names: Record<Shot, string> = { e: 'electron', 'anti-e': 'positron', gamma: 'photon', 'pi+': 'π⁺ (charged hadron)', n: 'neutron (neutral hadron)', mu: 'muon', nue: 'neutrino' };
    const track: Track = { pid: id === 'nue' ? 'nue' : id, name: names[id], q, pts: tpts, why: sh.why, B: q ? COLLIDER_B : 0, neutral: !q };
    this.#shots.push({ id, born: this.#colT, world, track, dur: tEnd + 0.6 });
    // a neutrino: draw the missing momentum once it has gone
    if (id === 'nue') {
      const dir = new THREE.Vector3(Math.cos(phi), Math.sin(phi), 0);
      const arr = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), 5.2, 0xff6f91, 0.4, 0.22);
      arr.userData = { t: this.#colT + 1.0 };
      arr.visible = false;
      const lb = label('missing momentum', 0.26, '#ff9fb4');
      lb.position.copy(dir.clone().multiplyScalar(5.7));
      lb.userData = { t: this.#colT + 1.0 };
      lb.visible = false;
      this.#missing.add(arr, lb);
    }
    void k0;
  }

  #updCollider(dt: number, L: DLook) {
    this.#colT += dt;
    // new shots requested
    for (const [i, f] of L.fire.entries()) {
      // the first time a button's counter is seen, only note it: nothing fires on load or after a rebuild
      if (!this.#fired.has(i)) { this.#fired.set(i, f.n); continue; }
      const done = this.#fired.get(i)!;
      if (f.n > done) { this.#fired.set(i, f.n); this.#fire(f.id); }
    }
    const H = this.#hits, t = this.#colT;
    const count = Math.min(this.#hN, H.n);
    const pk = this.#pick?.kind === 'collider' ? this.#pick.id : -1;
    for (let j = 0; j < count; j++) {
      const age = t - this.#hT[j];
      const fade = age > 24 ? Math.max(0, 1 - (age - 24) / 4) : 1;   // old shots fade away
      H.alpha[j] = age < 0 ? 0 : this.#hBase[j] * Math.min(1, age * 8) * fade * (this.#hShot[j] === pk ? 1.6 : 1);
    }
    H.flush(count);
    for (const o of this.#missing.children) o.visible = t >= (o.userData as { t: number }).t;
  }
  clearShots() {
    this.#hN = 0; this.#shots = [];
    for (const o of [...this.#missing.children]) {
      this.#missing.remove(o);
      o.traverse((c) => { const m = c as THREE.Mesh; m.geometry?.dispose(); const mt = m.material as THREE.Material | undefined; (mt as THREE.SpriteMaterial | undefined)?.map?.dispose(); mt?.dispose(); });
    }
    if (this.#pick?.kind === 'collider') this.clearPick();
    this.kick();
  }
  clearCloud() { this.#dBirth.fill(-99); this.#live = []; if (this.#pick?.kind === 'cloud') this.clearPick(); this.kick(); }

  /* ======================= picking ======================= */

  /** The track nearest a click (client coordinates), within 22 px; it is highlighted. */
  pick(cx: number, cy: number): Picked | null {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    let best: { kind: Det; id: number; k: number; track: Track; d: number } | null = null;
    const test = (kind: Det, id: number, track: Track, world: THREE.Vector3[], step: number, visibleUpTo: (k: number) => boolean) => {
      for (let k = 0; k < world.length; k += step) {
        if (!visibleUpTo(k)) continue;
        v.copy(world[k]).project(this.camera);
        if (v.z > 1) continue;
        const sx = r.left + ((v.x + 1) / 2) * r.width, sy = r.top + ((1 - v.y) / 2) * r.height;
        const d = Math.hypot(sx - cx, sy - cy);
        if (d < 22 && (!best || d < best.d)) best = { kind, id, k, track, d };
      }
    };
    if (this.#mode === 'cloud') {
      for (const l of this.#live) if (this.#cloudT - l.born < l.life) test('cloud', l.id, l.track, l.world, 1, (k) => l.track.pts[k].t <= this.#cloudT);
    } else if (this.#mode === 'bubble') {
      const ev = this.#cur;
      ev?.tracks.forEach((tr, i) => { if (!tr.neutral) test('bubble', i, tr, this.#bubbleWorld[i], 1, (k) => tr.pts[k].t <= this.#evT); });
    } else {
      this.#shots.forEach((s, i) => { if (s.track.q) test('collider', i, s.track, s.world, 1, (k) => s.track.pts[k].t + s.born <= this.#colT); });
    }
    if (!best) { this.clearPick(); return null; }
    const b = best as { kind: Det; id: number; k: number; track: Track };
    this.#pick = { kind: b.kind, id: b.id, k: b.k };
    this.kick();
    return { track: b.track, k: b.k };
  }
  clearPick() { this.#pick = null; this.#ring.visible = false; this.#mark.visible = false; if (this.#ringLabel) this.#ringLabel.visible = false; }

  /** The circle that fits the track where it was picked (its radius of curvature there), drawn dashed. */
  #updPickRing() {
    const pk = this.#pick;
    if (!pk || pk.kind !== this.#mode) { this.#ring.visible = false; this.#mark.visible = false; if (this.#ringLabel) this.#ringLabel.visible = false; return; }
    let tr: Track | undefined, world: THREE.Vector3[] | undefined, up = new THREE.Vector3(0, 0, 1), scale = SB;
    if (pk.kind === 'bubble') { tr = this.#cur?.tracks[pk.id]; world = this.#bubbleWorld[pk.id]; }
    else if (pk.kind === 'cloud') { const l = this.#live.find((x) => x.id === pk.id); tr = l?.track; world = l?.world; up = new THREE.Vector3(0, 1, 0); scale = SC; }
    else { const s = this.#shots[pk.id]; tr = s?.track; world = s?.world; scale = SL / 100; }
    if (!tr || !world || !world[pk.k]) { this.#ring.visible = false; this.#mark.visible = false; return; }
    const k = Math.min(pk.k, world.length - 2);
    const P = world[k], Q = world[k + 1];
    this.#mark.position.copy(P); this.#mark.visible = true;
    const r = tr.pts[pk.k]?.r ?? Infinity;
    const rw = r * scale;
    if (!isFinite(rw) || rw <= 0 || rw > 40) { this.#ring.visible = false; if (this.#ringLabel) this.#ringLabel.visible = false; return; }
    const dir = Q.clone().sub(P).normalize();
    // the centre is on the side the force pushes: to the right of the motion (looking along B) for a positive charge
    const right = dir.clone().cross(up).normalize();
    const centre = P.clone().addScaledVector(right, tr.q > 0 ? rw : -rw);
    const pts = Array.from({ length: 129 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      const e1 = P.clone().sub(centre).normalize(), e2 = up.clone().cross(e1).normalize();
      return centre.clone().addScaledVector(e1, Math.cos(a) * rw).addScaledVector(e2, Math.sin(a) * rw);
    });
    this.#ring.geometry.dispose();
    this.#ring.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.#ring.computeLineDistances();
    (this.#ring.material as THREE.LineDashedMaterial).dashSize = Math.max(0.05, rw * 0.06);
    (this.#ring.material as THREE.LineDashedMaterial).gapSize = Math.max(0.04, rw * 0.04);
    this.#ring.visible = true;
    const txt = `r = ${r >= 100 ? (r / 100).toPrecision(3) + ' m' : r.toPrecision(3) + ' cm'}`;
    if (!this.#ringLabel || this.#ringLabel.userData.txt !== txt) {
      if (this.#ringLabel) { this.scene.remove(this.#ringLabel); (this.#ringLabel.material as THREE.SpriteMaterial).map?.dispose(); this.#ringLabel.material.dispose(); }
      this.#ringLabel = label(txt, pk.kind === 'cloud' ? 0.32 : 0.3, '#ffd58a');
      this.#ringLabel.userData.txt = txt;
      this.scene.add(this.#ringLabel);
    }
    this.#ringLabel.position.copy(centre).addScaledVector(up, 0.05).add(new THREE.Vector3(0, pk.kind === 'cloud' ? 0 : 0.25, pk.kind === 'cloud' ? -0.25 : 0));
    this.#ringLabel.visible = true;
  }
}

export { EVENTS };
export type { BEvent };
