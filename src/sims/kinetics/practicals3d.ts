/* Kinetics Lab, Core practicals: the bench in 3D (1 world unit ≈ 5 cm).

   CP9a: the reaction flask of propanone, acid and iodine (amber, fading as the iodine is used), the stopclock, a
   burette on a stand over the titration flask on a white tile, and the quenched samples lined up behind. Each sample
   is titrated in turn: amber → pale straw → starch added, blue-black → colourless at the end point. In colorimeter
   mode the burette is swapped for a colorimeter whose cuvette shows the same colour and whose blue filter glows.

   CP9b: a beaker on a white tile with the five reagents behind; the stopwatch runs, the mixture stays colourless and
   then turns blue-black all at once.

   CP10: the same clock reaction in a boiling tube in a thermostatic water bath with a thermometer; steam above a hot
   bath. Everything here is driven from the tab through the look (clock times, colours, phases); nothing reads the
   chemistry directly. */

import { THREE, Stage3D, pointCloud, label, rand } from '../particles/gl';

export interface CPLook {
  view: 'cp9a' | 'cp9b' | 'cp10';
  follow: 'titrate' | 'color';
  i2: number;          // reaction flask [I₂] / [I₂]₀ (CP9a)
  phase: number;       // titration of the latest sample, 0…1 (−1: none yet)
  titre: number;       // titre of the sample being titrated / cm³
  samples: number;     // samples taken so far
  clock: number;       // stopwatch / s
  blue: number;        // 0…1 the clock mixture’s blue-black
  fill: number;        // 0…1 how full the clock beaker or tube is (mixing)
  T: number;           // bath temperature / °C (CP10)
  playing: boolean;
}

const AMBER = new THREE.Color(0.78, 0.42, 0.06);
const STRAW = new THREE.Color(0.95, 0.88, 0.45);
const CLEAR = new THREE.Color(0.82, 0.9, 0.98);
const INK = new THREE.Color(0.05, 0.04, 0.2);
const mix = (a: THREE.Color, b: THREE.Color, f: number) => a.clone().lerp(b, Math.min(1, Math.max(0, f)));
const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

const glassMat = () => new THREE.MeshStandardMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
const liquidMat = (c: THREE.Color) => new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.82, roughness: 0.25, side: THREE.DoubleSide });
const steel = () => new THREE.MeshStandardMaterial({ color: 0x8a93a6, metalness: 0.8, roughness: 0.35 });

/** profile [radius, height] → lathe; for glass (open) or liquid (closed at the top) */
function lathe(prof: [number, number][]) { return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 40); }
/** a conical flask's outline, base radius rb, neck radius rn, height h */
function flaskProfile(rb: number, rn: number, h: number): [number, number][] {
  return [[0, 0], [rb * 0.92, 0], [rb, 0.06 * h], [rb * 0.97, 0.16 * h], [rn, 0.72 * h], [rn, h], [rn * 1.15, h]];
}
/** the liquid in a flask filled to height hl (the same outline, clipped) */
function fillProfile(prof: [number, number][], hl: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < prof.length; i++) {
    const [r, y] = prof[i];
    if (y <= hl) out.push([r * 0.96, y]);
    else { const [r0, y0] = prof[i - 1]; const f = (hl - y0) / Math.max(1e-6, y - y0); out.push([(r0 + (r - r0) * f) * 0.96, hl]); break; }
  }
  out.push([0, hl]);
  return out;
}

/** A sprite whose text can change (a stopclock face). */
class Face {
  readonly sprite: THREE.Sprite;
  #c = document.createElement('canvas');
  #t: THREE.CanvasTexture;
  #last = '';
  constructor(h: number, readonly color = '#8dffb5') {
    this.#c.width = 320; this.#c.height = 112;
    this.#t = new THREE.CanvasTexture(this.#c);
    this.#t.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.#t, transparent: true, depthWrite: false }));
    this.sprite.scale.set((h * 320) / 112, h, 1);
  }
  set(text: string, sub = '') {
    const key = text + '|' + sub;
    if (key === this.#last) return;
    this.#last = key;
    const g = this.#c.getContext('2d')!;
    g.clearRect(0, 0, 320, 112);
    g.fillStyle = 'rgba(8,12,16,0.92)'; g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 4;
    g.beginPath(); g.roundRect(4, 4, 312, 104, 18); g.fill(); g.stroke();
    g.fillStyle = this.color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 58px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.fillText(text, 160, sub ? 48 : 58);
    if (sub) { g.font = '600 22px ui-monospace, monospace'; g.fillStyle = 'rgba(200,220,210,0.8)'; g.fillText(sub, 160, 92); }
    this.#t.needsUpdate = true;
  }
  dispose() { this.#t.dispose(); this.sprite.material.dispose(); }
}

const mmss = (s: number) => { const t = Math.max(0, s); const m = Math.floor(t / 60); return `${String(m).padStart(2, '0')}:${(t - m * 60).toFixed(1).padStart(4, '0')}`; };

export class CPScene extends Stage3D<CPLook> {
  #g9a = new THREE.Group();
  #g9b = new THREE.Group();
  #g10 = new THREE.Group();
  #view = '';
  // CP9a
  #rxLiquid!: THREE.Mesh<THREE.LatheGeometry, THREE.MeshStandardMaterial>;
  #tLiquid!: THREE.Mesh<THREE.LatheGeometry, THREE.MeshStandardMaterial>;
  #tProf: [number, number][] = [];
  #tFill = -1;
  #buretteCol!: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  #drip!: THREE.Mesh;
  #burette = new THREE.Group();
  #colorimeter = new THREE.Group();
  #cuvette!: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  #beam!: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  #rowFlasks: THREE.Group[] = [];
  #face9a = new Face(0.7);
  #face9b = new Face(0.7);
  #face10 = new Face(0.7, '#ffcf7a');
  // CP9b
  #beakerLiquid!: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  #swirl = pointCloud(120, this.px);
  #sw: { a: number; r: number; y: number; w: number }[] = [];
  // CP10
  #tubeLiquid!: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  #water!: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  #mercury!: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  #steam = pointCloud(90, this.px);
  #st: { x: number; z: number; y: number; v: number }[] = [];
  #heaterGlow!: THREE.Sprite;

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [0.5, 5.2, 10.5], target: [0, 1.4, 0], bloom: [0.45, 0.4, 0.82], bg: 0x05070d });
    this.scene.add(new THREE.AmbientLight(0xb8c2e0, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-3, 9, 6); this.scene.add(sun);
    const fill = new THREE.PointLight(0x99bbff, 12, 30); fill.position.set(4, 4, 4); this.scene.add(fill);
    // the bench top
    const bench = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 7), new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.85 }));
    bench.position.y = -0.15; this.scene.add(bench);
    this.scene.add(this.#g9a, this.#g9b, this.#g10);
    this.#build9a(); this.#build9b(); this.#build10();
    this.start();
  }

  /* ---------- glassware ---------- */
  #flask(rb: number, rn: number, h: number) {
    const g = new THREE.Group();
    const prof = flaskProfile(rb, rn, h);
    g.add(new THREE.Mesh(lathe(prof), glassMat()));
    return { g, prof };
  }
  #tile(w: number, d: number) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.4 }));
    t.position.y = 0.03; return t;
  }
  #stand(x: number, z: number, h: number) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.1), new THREE.MeshStandardMaterial({ color: 0x2b313f, metalness: 0.4, roughness: 0.6 }));
    base.position.set(0, 0.05, -0.2); g.add(base);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 12), steel()); rod.position.set(-0.55, h / 2, -0.5); g.add(rod);
    g.position.set(x, 0, z); return g;
  }

  #build9a() {
    const g = this.#g9a;
    // reaction flask (500 cm³) on the left
    const rf = this.#flask(1.25, 0.38, 2.6); rf.g.position.set(-4, 0, 0.2); g.add(rf.g);
    this.#rxLiquid = new THREE.Mesh(lathe(fillProfile(rf.prof, 1.0)), liquidMat(AMBER)); rf.g.add(this.#rxLiquid);
    const rl = label('propanone + H⁺ + I₂', 0.34, '#ffd79a'); rl.position.set(-4, 3.2, 0.2); g.add(rl);
    // pipette standing in it
    const pip = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.4, 10), glassMat()); stem.position.y = 1.7; pip.add(stem);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), glassMat()); bulb.scale.y = 2.2; bulb.position.y = 1.6; pip.add(bulb);
    const filler = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: 0xc8343c, roughness: 0.6 })); filler.position.y = 3.5; pip.add(filler);
    pip.position.set(-3.6, 0.3, 0.2); pip.rotation.z = -0.12; g.add(pip);
    // the stopclock
    this.#face9a.sprite.position.set(-4, 4.1, 0.2); g.add(this.#face9a.sprite);
    // the quenched samples, waiting in a row at the back
    for (let i = 0; i < 7; i++) {
      const f = this.#flask(0.42, 0.14, 0.95); f.g.position.set(-2.4 + i * 0.75, 0, -2.3);
      const liq = new THREE.Mesh(lathe(fillProfile(f.prof, 0.32)), liquidMat(STRAW)); f.g.add(liq);
      f.g.visible = false; this.#rowFlasks.push(f.g); g.add(f.g);
    }
    const ql = label('quenched in NaHCO₃', 0.28, '#b9c6e6'); ql.position.set(-0.15, 1.35, -2.3); g.add(ql);
    // the burette on its stand over the titration flask on a white tile
    const bx = 2.9, bz = 0.6;
    { const tl = this.#tile(1.5, 1.5); tl.position.set(bx, 0.03, bz); g.add(tl); }
    const tf = this.#flask(0.62, 0.2, 1.4); tf.g.position.set(bx, 0.06, bz); g.add(tf.g);
    this.#tProf = tf.prof;
    this.#tLiquid = new THREE.Mesh(lathe(fillProfile(tf.prof, 0.4)), liquidMat(AMBER)); tf.g.add(this.#tLiquid);
    const B = this.#burette;
    B.add(this.#stand(0, 0, 6.6));
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 4.2, 16, 1, true), glassMat()); tube.position.set(0, 4.05, 0); B.add(tube);
    this.#buretteCol = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 1, 16), new THREE.MeshStandardMaterial({ color: 0xe8f1ff, transparent: true, opacity: 0.55 }));
    B.add(this.#buretteCol);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.02, 0.5, 12), glassMat()); tip.position.set(0, 1.7, 0); B.add(tip);
    const cock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0x3a7bd5 })); cock.position.set(0, 1.85, 0); B.add(cock);
    for (let k = 0; k <= 10; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(k % 5 ? 0.06 : 0.11, 0.008, 0.01), new THREE.MeshBasicMaterial({ color: 0xc8d4ee })); m.position.set(0.1, 6 - k * 0.38, 0.06); B.add(m); }
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.12), steel()); clamp.position.set(-0.3, 5.2, -0.25); B.add(clamp);
    this.#drip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe8f1ff, transparent: true, opacity: 0.8 }));
    B.add(this.#drip);
    const bl = label('0.010 M thiosulfate', 0.3, '#cfe0ff'); bl.position.set(0.9, 6.25, 0); B.add(bl);
    B.position.set(bx, 0, bz); g.add(B);
    // the colorimeter (instead of the burette)
    const C = this.#colorimeter;
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.3), new THREE.MeshStandardMaterial({ color: 0x2a3446, metalness: 0.3, roughness: 0.5 }));
    box.position.y = 0.45; C.add(box);
    this.#cuvette = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.26), new THREE.MeshStandardMaterial({ color: AMBER, transparent: true, opacity: 0.85 }));
    this.#cuvette.position.set(0, 1.1, 0); C.add(this.#cuvette);
    this.#beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.5, 1.8), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.#beam.rotation.z = Math.PI / 2; this.#beam.position.set(0, 0.62, 0); C.add(this.#beam);
    const scr = label('A', 0.5, '#8dffb5'); scr.position.set(0, 0.5, 0.7); C.add(scr);
    const cl = label('colorimeter, blue filter', 0.3, '#cfe0ff'); cl.position.set(0, 1.85, 0); C.add(cl);
    C.position.set(bx, 0, bz); g.add(C);
  }

  #build9b() {
    const g = this.#g9b;
    { const tl = this.#tile(2.6, 2.2); tl.position.set(0, 0.03, 0.4); g.add(tl); }
    const beaker = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.8, 2.0, 40, 1, true), glassMat()); beaker.position.set(0, 1.06, 0.4); g.add(beaker);
    const base = new THREE.Mesh(new THREE.CircleGeometry(0.8, 40), glassMat()); base.rotation.x = -Math.PI / 2; base.position.set(0, 0.07, 0.4); g.add(base);
    this.#beakerLiquid = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.76, 1, 40), liquidMat(CLEAR));
    this.#beakerLiquid.position.set(0, 0.07, 0.4); g.add(this.#beakerLiquid);
    // the reagents in measuring cylinders behind
    const reag: [string, number][] = [['KI', 0xf2f2f2], ['H₂O₂', 0xe8f4ff], ['H₂SO₄', 0xf6f6ea], ['Na₂S₂O₃', 0xeef6ff], ['starch', 0xf4f0e6]];
    reag.forEach(([n, c], i) => {
      const x = -2.6 + i * 1.3, z = -2.2;
      const cy = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.7, 20, 1, true), glassMat()); cy.position.set(x, 0.95, z); g.add(cy);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 6), glassMat()); foot.position.set(x, 0.04, z); g.add(foot);
      const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 20), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.45 })); liq.position.set(x, 0.5, z); g.add(liq);
      const l = label(n, 0.3, '#d6e2ff'); l.position.set(x, 2.1, z); g.add(l);
    });
    this.#face9b.sprite.position.set(2.6, 1.8, 0.6); g.add(this.#face9b.sprite);
    for (let i = 0; i < this.#swirl.n; i++) this.#sw.push({ a: rand() * 6.28, r: 0.1 + rand() * 0.62, y: rand(), w: 0.6 + rand() * 1.6 });
    g.add(this.#swirl.obj);
  }

  #build10() {
    const g = this.#g10;
    // the water bath: a steel tank of water, a heater element, a thermometer, a boiling tube held in it
    const tank = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.0, 2.6), new THREE.MeshStandardMaterial({ color: 0x9aa6bb, metalness: 0.75, roughness: 0.3, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
    tank.position.set(0, 1.0, 0); g.add(tank);
    this.#water = new THREE.Mesh(new THREE.BoxGeometry(4.05, 1.6, 2.45), new THREE.MeshStandardMaterial({ color: 0x3a7cc0, transparent: true, opacity: 0.38, roughness: 0.1, depthWrite: false }));
    this.#water.position.set(0, 0.85, 0); g.add(this.#water);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x252d3c })); panel.position.set(0, 0.25, 1.4); g.add(panel);
    this.#face10.sprite.position.set(0.9, 0.3, 1.75); this.#face10.sprite.scale.multiplyScalar(0.55); g.add(this.#face10.sprite);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 40), new THREE.MeshStandardMaterial({ color: 0x804030, emissive: 0x401000 }));
    coil.rotation.x = Math.PI / 2; coil.position.set(-1.3, 0.2, 0); g.add(coil);
    this.#heaterGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xff7030, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.#heaterGlow.position.set(-1.3, 0.25, 0); this.#heaterGlow.scale.setScalar(1.6); g.add(this.#heaterGlow);
    // boiling tube
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.6, 24, 1, true), glassMat()); tube.position.set(0.6, 1.5, 0); g.add(tube);
    const tb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glassMat()); tb.position.set(0.6, 0.2, 0); g.add(tb);
    this.#tubeLiquid = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 24), liquidMat(CLEAR)); g.add(this.#tubeLiquid);
    const tl = label('clock mixture', 0.3, '#d6e2ff'); tl.position.set(0.6, 3.15, 0); g.add(tl);
    // thermometer
    const th = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 10), glassMat()); th.position.set(1.4, 1.8, 0.3); g.add(th);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd02030 })); bulb.position.set(1.4, 0.24, 0.3); g.add(bulb);
    this.#mercury = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 8), new THREE.MeshBasicMaterial({ color: 0xe02838 })); g.add(this.#mercury);
    const thl = label('thermometer', 0.26, '#d6e2ff'); thl.position.set(1.9, 3.5, 0.3); g.add(thl);
    const sw = new Face(0.7); this.#face10b = sw; sw.sprite.position.set(-2.9, 2.6, 0.4); g.add(sw.sprite);
    for (let i = 0; i < this.#steam.n; i++) this.#st.push({ x: (rand() - 0.5) * 3.8, z: (rand() - 0.5) * 2.2, y: 1.7 + rand() * 1.6, v: 0.3 + rand() * 0.5 });
    g.add(this.#steam.obj);
  }
  #face10b: Face | null = null;

  /** go home, standing further back on a portrait screen so the whole bench fits */
  #home(cam: [number, number, number], target: [number, number, number]) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const k = w > 0 && h > 0 && w / h < 1.2 ? 1.35 : 1;
    this.setHome([target[0] + (cam[0] - target[0]) * k, target[1] + (cam[1] - target[1]) * k, target[2] + (cam[2] - target[2]) * k], target);
  }

  /* ---------- per frame ---------- */
  #setFill(f: number) {
    const hl = 0.06 + 0.5 * clamp01(f);
    if (Math.abs(hl - this.#tFill) < 0.004) return;
    this.#tFill = hl;
    this.#tLiquid.geometry.dispose();
    this.#tLiquid.geometry = lathe(fillProfile(this.#tProf, hl));
  }

  protected update(dt: number) {
    const L = this.look!;
    if (L.view !== this.#view) {
      this.#view = L.view;
      this.#g9a.visible = L.view === 'cp9a'; this.#g9b.visible = L.view === 'cp9b'; this.#g10.visible = L.view === 'cp10';
      if (L.view === 'cp9a') this.#home([0.2, 5.6, 11.5], [-0.3, 1.8, 0]);
      else if (L.view === 'cp9b') this.#home([0.4, 3.6, 7.2], [0, 1.2, 0]);
      else this.#home([1.2, 4.4, 8.2], [0, 1.3, 0]);
    }
    const t = this.time.value;
    if (L.view === 'cp9a') {
      this.#face9a.set(mmss(L.clock), 'reaction time');
      this.#rxLiquid.material.color.copy(mix(CLEAR, AMBER, Math.pow(clamp01(L.i2), 0.8)));
      this.#rowFlasks.forEach((f, i) => (f.visible = i < L.samples - (L.phase >= 0 && L.phase < 1 ? 1 : 0)));
      const titr = L.follow === 'titrate';
      this.#burette.visible = titr; this.#colorimeter.visible = !titr;
      if (titr) {
        const p = L.phase;
        // titration flask: pour, fade to straw, starch → blue-black, fade to colourless at the end point
        let col = CLEAR, fill = 0, used = 0;
        if (p >= 0) {
          const amber = mix(STRAW, AMBER, Math.min(1, L.titre / 20));
          if (p < 0.08) { fill = (p / 0.08) * 0.35; col = amber; }
          else if (p < 0.55) { const f = (p - 0.08) / 0.47; fill = 0.35 + f * 0.4; col = mix(amber, STRAW, f); used = f * 0.88; }
          else if (p < 0.6) { fill = 0.76; col = mix(STRAW, INK, (p - 0.55) / 0.05); used = 0.88; }
          else if (p < 0.86) { const f = (p - 0.6) / 0.26; fill = 0.76 + f * 0.1; col = mix(INK, CLEAR, f * f); used = 0.88 + f * 0.12; }
          else { fill = 0.86; col = CLEAR; used = 1; }
        }
        this.#setFill(fill);
        this.#tLiquid.visible = p >= 0;
        this.#tLiquid.material.color.copy(col);
        this.#tLiquid.material.opacity = col === CLEAR ? 0.35 : 0.82;
        const vol = 50 - Math.min(50, L.titre * used + 1);       // burette starts at 1.00 cm³
        const top = 6.1, h = (vol / 50) * 4.0;
        this.#buretteCol.scale.y = Math.max(0.01, h);
        this.#buretteCol.position.set(0, top - (4.0 - h) - h / 2, 0);
        const dripping = p > 0.08 && p < 0.86 && L.playing;
        this.#drip.visible = dripping;
        if (dripping) this.#drip.position.set(0, 1.4 - ((t * 2.2) % 1) * 0.55, 0);
      } else {
        this.#cuvette.material.color.copy(mix(CLEAR, AMBER, Math.pow(clamp01(L.i2), 0.8)));
        this.#beam.material.opacity = 0.35 + 0.3 * (1 - clamp01(L.i2));
      }
    } else if (L.view === 'cp9b') {
      this.#face9b.set(mmss(L.clock), L.blue > 0.5 ? 'stop!' : L.fill > 0.99 ? 'timing…' : 'ready');
      const h = 0.15 + 1.55 * clamp01(L.fill);
      this.#beakerLiquid.scale.y = h; this.#beakerLiquid.position.y = 0.07 + h / 2;
      this.#beakerLiquid.material.color.copy(mix(CLEAR, INK, clamp01(L.blue)));
      this.#beakerLiquid.material.opacity = 0.3 + 0.62 * clamp01(L.blue);
      const S = this.#swirl;
      const live = L.fill > 0 && L.fill < 1 ? 1 : L.playing && L.blue < 1 ? 0.35 : 0.12;
      for (let i = 0; i < S.n; i++) {
        const s = this.#sw[i];
        s.a += dt * s.w * (0.4 + live * 2);
        S.pos[3 * i] = Math.cos(s.a) * s.r; S.pos[3 * i + 1] = 0.12 + s.y * (h - 0.1); S.pos[3 * i + 2] = 0.4 + Math.sin(s.a) * s.r;
        const c = L.blue > 0.5 ? [0.35, 0.4, 1.4] : [0.9, 0.95, 1.1];
        S.col[3 * i] = c[0]; S.col[3 * i + 1] = c[1]; S.col[3 * i + 2] = c[2];
        S.size[i] = 0.05; S.alpha[i] = 0.25 * live + 0.05;
      }
      S.flush();
    } else {
      this.#face10.set(`${L.T.toFixed(1)}°C`, 'set point');
      this.#face10b?.set(mmss(L.clock), L.blue > 0.5 ? 'stop!' : L.fill > 0.99 ? 'timing…' : 'in the bath');
      const h = 0.25 + 1.2 * clamp01(L.fill);
      this.#tubeLiquid.scale.y = h; this.#tubeLiquid.position.set(0.6, 0.2 + h / 2, 0);
      this.#tubeLiquid.material.color.copy(mix(CLEAR, INK, clamp01(L.blue)));
      this.#tubeLiquid.material.opacity = 0.35 + 0.6 * clamp01(L.blue);
      const warm = clamp01((L.T - 15) / 50);
      this.#water.material.color.setRGB(0.23 + 0.25 * warm, 0.49 - 0.08 * warm, 0.75 - 0.25 * warm);
      this.#heaterGlow.material.opacity = 0.15 + 0.55 * warm * (0.8 + 0.2 * Math.sin(t * 3));
      const mh = 0.2 + (Math.min(100, Math.max(0, L.T)) / 100) * 2.9;
      this.#mercury.scale.y = mh; this.#mercury.position.set(1.4, 0.24 + mh / 2, 0.3);
      const S = this.#steam, hot = clamp01((L.T - 40) / 25);
      for (let i = 0; i < S.n; i++) {
        const s = this.#st[i];
        s.y += dt * s.v; s.x += dt * 0.08 * Math.sin(t + i);
        if (s.y > 3.6) { s.y = 1.7; s.x = (rand() - 0.5) * 3.8; }
        S.pos[3 * i] = s.x; S.pos[3 * i + 1] = s.y; S.pos[3 * i + 2] = s.z;
        S.col[3 * i] = 0.8; S.col[3 * i + 1] = 0.85; S.col[3 * i + 2] = 0.95;
        S.size[i] = 0.35; S.alpha[i] = hot * 0.12 * (1 - (s.y - 1.7) / 1.9);
      }
      S.flush();
    }
  }

  dispose() { this.#face9a.dispose(); this.#face9b.dispose(); this.#face10.dispose(); this.#face10b?.dispose(); super.dispose(); }
}
