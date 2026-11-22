/* Kinetics Lab, Measuring rates: the bench in 3D (1 world unit ≈ 5 cm).

   Four arrangements share one conical flask:
   - gas syringe: a bung and delivery tube lead to a 100 cm³ syringe whose plunger slides out with the volume;
   - mass loss: the flask stands on a top-pan balance with a cotton wool plug; the display reads to 0.01 g;
   - disappearing cross: the flask stands on a paper cross, seen from above; the liquid clouds with sulfur;
   - colorimetry: a lamp, a blue filter, the cuvette and a detector; the beam after the cuvette dims as 10⁻ᴬ.
   Bubbles rise from the solid (chips, ribbon or catalyst) at a rate in step with the true rate of reaction. */

import { THREE, Stage3D, pointCloud, label, rand } from '../particles/gl';
import type { RxId, Method, Size } from './measure';

export interface BLook {
  rx: RxId; method: Method; size: Size; cat: number;
  ext: number;          // fraction of the limiting reagent used
  rate: number;         // the rate now ÷ the initial rate (0–1)
  V: number;            // cm³ of gas in the syringe
  mass: string;         // balance display
  cloud: number;        // thio: cloudiness, 1 = the cross has gone
  A: number;            // absorbance
  i2: number;           // iodine left, 0–1
  temp: number;
  playing: boolean;
}

const FLASK: [number, number][] = [[0, 0], [1.0, 0], [1.05, 0.08], [1.0, 0.4], [0.4, 1.9], [0.32, 2.05], [0.32, 2.6], [0.36, 2.66]];
const LIQ_H = 0.75;
const SX0 = 1.2, SLEN = 4, SY = 3.05;    // the syringe: barrel from x = SX0 to SX0 + SLEN (100 cm³), at height SY
const FX = -1.6;                          // the flask's x when the syringe is attached

function display(w = 320, h = 96, bg = '#0c1a12', fg = '#8dffb4') {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  let last = '';
  return {
    tex,
    draw(text: string) {
      if (text === last) return;
      last = text;
      const g = c.getContext('2d')!;
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = fg; g.font = `700 ${Math.round(h * 0.58)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillText(text, w - 16, h / 2 + 3);
      tex.needsUpdate = true;
    },
  };
}

export class BenchScene extends Stage3D<BLook> {
  #flask = new THREE.Group();
  #liquid: THREE.Mesh<THREE.LatheGeometry, THREE.MeshStandardMaterial>;
  #bung: THREE.Group = new THREE.Group();
  #wool = new THREE.Group();
  #syringe = new THREE.Group();
  #plunger = new THREE.Group();
  #gasFill: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  #balance = new THREE.Group();
  #balDisp = display();
  #paper = new THREE.Group();
  #colorimeter = new THREE.Group();
  #colDisp = display(320, 96, '#0d1220', '#9cc8ff');
  #cuvLiquid: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  #beamOut: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  #chips: THREE.InstancedMesh | null = null;
  #chipKey = '';
  #mno2: THREE.InstancedMesh;
  #ribbon: THREE.Mesh;
  #bub = pointCloud(500, this.px);
  #b: { x: number; y: number; z: number; v: number; ph: number; on: boolean }[] = [];
  #spawn = 0;
  #therm: THREE.Sprite | null = null;
  #thermT = NaN;
  #arr = '';
  #sources: [number, number, number][] = [];

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [0.8, 5.2, 10], target: [0.6, 1.4, 0], bloom: [0.45, 0.4, 0.8], bg: 0x05070d });
    this.scene.add(new THREE.AmbientLight(0xa8b0d0, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-4, 10, 7); this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x9fb8ff, 0.7); rim.position.set(6, 3, -6); this.scene.add(rim);

    // the bench
    const top = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 9), new THREE.MeshStandardMaterial({ color: 0x252a35, roughness: 0.85 }));
    top.position.y = -0.17; this.scene.add(top);

    // the flask, its liquid and stopper / wool
    const glass = new THREE.MeshStandardMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0.17, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });
    const shell = new THREE.Mesh(new THREE.LatheGeometry(FLASK.map(([r, y]) => new THREE.Vector2(r, y)), 56), glass);
    shell.renderOrder = 2;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 8, 40), new THREE.MeshStandardMaterial({ color: 0xe6f0ff, transparent: true, opacity: 0.5 }));
    lip.rotation.x = Math.PI / 2; lip.position.y = 2.66;
    const rFlask = (y: number) => (y < 0.4 ? 1.0 : 1.0 - ((y - 0.4) / 1.5) * 0.6);
    const lq = [[0, 0.04], [0.95, 0.04], [0.96, 0.4], [rFlask(LIQ_H) - 0.05, LIQ_H], [0, LIQ_H]].map(([r, y]) => new THREE.Vector2(r, y));
    this.#liquid = new THREE.Mesh(new THREE.LatheGeometry(lq, 56), new THREE.MeshStandardMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.3, roughness: 0.2, depthWrite: false }));
    this.#liquid.renderOrder = 1;
    const bung = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.3, 0.32, 24), new THREE.MeshStandardMaterial({ color: 0x7a2a2a, roughness: 0.7 }));
    bung.position.y = 2.62;
    this.#bung.add(bung);
    for (let i = 0; i < 6; i++) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.16 + rand() * 0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 1 }));
      w.position.set((rand() - 0.5) * 0.3, 2.55 + rand() * 0.25, (rand() - 0.5) * 0.3);
      this.#wool.add(w);
    }
    const wl = label('cotton wool', 0.26); wl.position.set(0, 3.25, 0); this.#wool.add(wl);
    // MnO₂ powder and magnesium ribbon (shown as needed)
    this.#mno2 = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.9 }), 160);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 160; i++) { const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.8; m4.makeTranslation(r * Math.cos(a), 0.07 + rand() * 0.03, r * Math.sin(a)); this.#mno2.setMatrixAt(i, m4); }
    this.#ribbon = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.025, 0.14), new THREE.MeshStandardMaterial({ color: 0xd9dde4, metalness: 0.85, roughness: 0.3 }));
    this.#ribbon.position.set(0, 0.12, 0.1); this.#ribbon.rotation.set(0.1, 0.5, 0.06);
    this.#flask.add(this.#liquid, shell, lip, this.#bung, this.#wool, this.#mno2, this.#ribbon);
    this.scene.add(this.#flask, this.#bub.obj);

    // the gas syringe and delivery tube
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0xd8e4f0, transparent: true, opacity: 0.55, roughness: 0.2 });
    const path = new THREE.CatmullRomCurve3([new THREE.Vector3(FX, 2.75, 0), new THREE.Vector3(FX, 3.25, 0), new THREE.Vector3(FX + 0.6, SY, 0), new THREE.Vector3(SX0 - 0.35, SY, 0)]);
    this.#syringe.add(new THREE.Mesh(new THREE.TubeGeometry(path, 40, 0.06, 10), tubeMat));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, SLEN, 32, 1, true), glass.clone());
    barrel.rotation.z = Math.PI / 2; barrel.position.set(SX0 + SLEN / 2, SY, 0); barrel.renderOrder = 2;
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.3, 0.35, 20), new THREE.MeshStandardMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0.4 }));
    nose.rotation.z = Math.PI / 2; nose.position.set(SX0 - 0.17, SY, 0);
    this.#gasFill = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1, 24), new THREE.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.12, depthWrite: false }));
    this.#gasFill.rotation.z = Math.PI / 2;
    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 28), new THREE.MeshStandardMaterial({ color: 0x3a3f4c, roughness: 0.5 }));
    piston.rotation.z = Math.PI / 2;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, SLEN + 0.3, 12), new THREE.MeshStandardMaterial({ color: 0xc8d0dc, metalness: 0.5, roughness: 0.3 }));
    rod.rotation.z = Math.PI / 2; rod.position.x = (SLEN + 0.3) / 2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 24), new THREE.MeshStandardMaterial({ color: 0x3a3f4c }));
    cap.rotation.z = Math.PI / 2; cap.position.x = SLEN + 0.3;
    this.#plunger.add(piston, rod, cap);
    this.#plunger.position.set(SX0, SY, 0);
    const tk: number[] = [];
    for (let v = 0; v <= 100; v += 5) { const x = SX0 + (v / 100) * SLEN, l = v % 50 === 0 ? 0.2 : v % 10 === 0 ? 0.13 : 0.07; tk.push(x, SY + 0.37, 0, x, SY + 0.37 + l, 0); }
    const ticks = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tk, 3)), new THREE.LineBasicMaterial({ color: 0xdfe8ff }));
    this.#syringe.add(barrel, nose, this.#gasFill, this.#plunger, ticks);
    for (const v of [0, 50, 100]) { const l = label(`${v}`, 0.26); l.position.set(SX0 + (v / 100) * SLEN, SY + 0.8, 0); this.#syringe.add(l); }
    const sl = label('gas syringe / cm³', 0.28); sl.position.set(SX0 + SLEN / 2, SY + 1.2, 0); this.#syringe.add(sl);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, SY, 0.12), new THREE.MeshStandardMaterial({ color: 0x4a5162, metalness: 0.6 }));
    stand.position.set(SX0 + 1.2, SY / 2, -0.5);
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.6), new THREE.MeshStandardMaterial({ color: 0x4a5162, metalness: 0.6 }));
    clamp.position.set(SX0 + 1.2, SY, -0.25);
    this.#syringe.add(stand, clamp);
    this.scene.add(this.#syringe);

    // the balance
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 2.4), new THREE.MeshStandardMaterial({ color: 0xd4d7de, roughness: 0.5 }));
    base.position.y = 0.25;
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.06, 40), new THREE.MeshStandardMaterial({ color: 0xb8bec8, metalness: 0.7, roughness: 0.3 }));
    pan.position.y = 0.53;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.39), new THREE.MeshBasicMaterial({ map: this.#balDisp.tex }));
    face.position.set(0, 0.26, 1.205);
    const bl = label('top-pan balance, ±0.01 g', 0.24, '#cfd6ea'); bl.position.set(0, -0.35, 1.5);
    this.#balance.add(base, pan, face, bl);
    this.scene.add(this.#balance);

    // the paper cross
    const pc = document.createElement('canvas'); pc.width = pc.height = 256;
    const g = pc.getContext('2d')!;
    g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#111'; g.lineWidth = 18; g.lineCap = 'round';
    g.beginPath(); g.moveTo(70, 70); g.lineTo(186, 186); g.moveTo(186, 70); g.lineTo(70, 186); g.stroke();
    const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace;
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.95 }));
    paper.rotation.x = -Math.PI / 2; paper.position.y = 0.005;
    this.#paper.add(paper);
    this.scene.add(this.#paper);

    // the colorimeter: lamp → blue filter → cuvette → detector
    const plate = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 2), new THREE.MeshStandardMaterial({ color: 0x2f3442, roughness: 0.6 }));
    plate.position.y = 0.12;
    const lampBox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 0.8), new THREE.MeshStandardMaterial({ color: 0x3c4252 }));
    lampBox.position.set(-2.4, 0.75, 0);
    const bulb = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xfff4d8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    bulb.position.set(-1.95, 0.8, 0); bulb.scale.setScalar(0.9);
    const filt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0x3a6cff, transparent: true, opacity: 0.7, emissive: 0x1a3088 }));
    filt.position.set(-1.3, 0.8, 0);
    const beamIn = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 10), new THREE.MeshBasicMaterial({ color: 0x5b8cff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    beamIn.rotation.z = Math.PI / 2; beamIn.position.set(-0.75, 0.8, 0);
    const cuv = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.1, 0.42), glass.clone());
    cuv.position.set(0, 0.8, 0); cuv.renderOrder = 2;
    this.#cuvLiquid = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.8, 0.36), new THREE.MeshStandardMaterial({ color: 0xa0521c, transparent: true, opacity: 0.85, depthWrite: false }));
    this.#cuvLiquid.position.set(0, 0.67, 0);
    this.#beamOut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 10), new THREE.MeshBasicMaterial({ color: 0x5b8cff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.#beamOut.rotation.z = Math.PI / 2; this.#beamOut.position.set(0.95, 0.8, 0);
    const det = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1, 0.8), new THREE.MeshStandardMaterial({ color: 0x3c4252 }));
    det.position.set(2.0, 0.75, 0);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.42), new THREE.MeshBasicMaterial({ map: this.#colDisp.tex }));
    scr.position.set(2.0, 1.75, 0.2);
    const scrBack = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.52, 0.12), new THREE.MeshStandardMaterial({ color: 0x252a36 }));
    scrBack.position.set(2.0, 1.75, 0.13);
    this.#colorimeter.add(plate, lampBox, bulb, filt, beamIn, cuv, this.#cuvLiquid, this.#beamOut, det, scrBack, scr);
    for (const [t, x, y] of [['lamp', -2.4, 1.55], ['blue filter', -1.3, 1.35], ['cuvette, 1 cm', 0, 1.65], ['detector', 2.0, 2.25]] as const) {
      const l = label(t, 0.24); l.position.set(x, y, 0); this.#colorimeter.add(l);
    }
    this.scene.add(this.#colorimeter);

    for (let i = 0; i < this.#bub.n; i++) this.#b.push({ x: 0, y: 0, z: 0, v: 0, ph: 0, on: false });
    this.start();
  }

  #layout(L: BLook) {
    const k = `${L.method}`;
    if (k === this.#arr) return;
    this.#arr = k;
    const syr = L.method === 'syringe', mass = L.method === 'mass', cross = L.method === 'cross', col = L.method === 'colour';
    this.#syringe.visible = syr;
    this.#balance.visible = mass;
    this.#paper.visible = cross;
    this.#colorimeter.visible = col;
    this.#flask.visible = !col;
    this.#bung.visible = syr;
    this.#wool.visible = mass;
    this.#flask.position.set(syr ? FX : 0, mass ? 0.56 : 0, 0);
    if (syr) this.setHome([0.6, 5.0, 10.5], [0.8, 1.5, 0]);
    else if (mass) this.setHome([0, 4.4, 8], [0, 1.4, 0]);
    else if (cross) this.setHome([0, 6.4, 3.2], [0, 0.3, 0]);
    else this.setHome([1.2, 3.6, 6.4], [0, 0.8, 0]);
  }

  #setChips(L: BLook) {
    const key = L.rx === 'marble' ? L.size : '';
    if (key === this.#chipKey) return;
    this.#chipKey = key;
    if (this.#chips) { this.#flask.remove(this.#chips); this.#chips.geometry.dispose(); (this.#chips.material as THREE.Material).dispose(); this.#chips = null; }
    if (!key) return;
    const [n, r] = key === 'large' ? [6, 0.2] : key === 'small' ? [18, 0.11] : [140, 0.035];
    const mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.75 }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    this.#sources = [];
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * 0.78, s = r * (0.75 + rand() * 0.5);
      e.set(rand() * 6, rand() * 6, rand() * 6); q.setFromEuler(e);
      m.compose(new THREE.Vector3(rr * Math.cos(a), 0.05 + s * 0.8, rr * Math.sin(a)), q, new THREE.Vector3(s, s * 0.85, s));
      mesh.setMatrixAt(i, m);
      this.#sources.push([rr * Math.cos(a), 0.05 + s, rr * Math.sin(a)]);
    }
    this.#chips = mesh;
    this.#flask.add(mesh);
  }

  protected update(dt: number) {
    const L = this.look!;
    this.#layout(L);
    this.#setChips(L);
    const gasRx = L.rx === 'marble' || L.rx === 'h2o2' || L.rx === 'mg';
    // the solid in the flask
    this.#mno2.visible = L.rx === 'h2o2';
    this.#mno2.count = Math.max(10, Math.min(160, Math.round(L.cat * 320)));
    const left = Math.max(0, 1 - L.ext);
    this.#ribbon.visible = L.rx === 'mg' && left > 0.004;
    if (this.#ribbon.visible) { const s = Math.cbrt(left); this.#ribbon.scale.set(0.3 + 0.7 * s, s, s); }
    if (this.#chips) this.#chips.scale.setScalar(1 - 0.12 * L.ext);

    // the liquid's colour
    const lm = this.#liquid.material;
    if (L.rx === 'thio') {
      const c = Math.min(1, Math.max(0, L.cloud));
      lm.color.setRGB(0.62 + 0.33 * c, 0.78 + 0.16 * c, 1.0 - 0.25 * c);
      lm.opacity = 0.22 + 0.76 * Math.pow(c, 0.8);
    } else { lm.color.setHex(0x9fc8ff); lm.opacity = 0.28; }
    // the colorimeter
    if (L.method === 'colour') {
      const f = Math.min(1, Math.max(0, L.i2));
      this.#cuvLiquid.material.color.setRGB(0.95 - 0.3 * f, 0.92 - 0.6 * f, 0.88 - 0.78 * f);
      this.#cuvLiquid.material.opacity = 0.25 + 0.65 * f;
      this.#beamOut.material.opacity = 0.85 * Math.pow(10, -Math.min(3, Math.max(0, L.A)));
      this.#colDisp.draw(`A ${Math.max(0, L.A).toFixed(3)}`);
    }
    // the syringe
    if (L.method === 'syringe') {
      const x = (Math.min(100, Math.max(0, L.V)) / 100) * SLEN;
      this.#plunger.position.x = SX0 + x;
      this.#gasFill.visible = x > 0.02;
      this.#gasFill.scale.set(1, Math.max(0.001, x), 1);
      this.#gasFill.position.set(SX0 + x / 2, SY, 0);
    }
    if (L.method === 'mass') this.#balDisp.draw(`${L.mass} g`);
    // a thermometer reading beside the flask
    if (L.temp !== this.#thermT) {
      this.#thermT = L.temp;
      if (this.#therm) { this.scene.remove(this.#therm); this.#therm.material.map?.dispose(); this.#therm.material.dispose(); }
      this.#therm = label(`${Math.round(L.temp)} °C`, 0.3, '#ffd58a');
      this.scene.add(this.#therm);
    }
    if (this.#therm) {
      const p = L.method === 'colour' ? [-2.4, 2.1, 0.5] : L.method === 'syringe' ? [FX - 1.5, 1.2, 0.6] : L.method === 'mass' ? [-1.8, 1.6, 0.6] : [-1.6, 0.5, 1.2];
      this.#therm.position.set(p[0], p[1], p[2]);
    }

    // bubbles: from the solid, at a rate that follows the rate of reaction
    const B = this.#bub, fx = this.#flask.position.x, fy = this.#flask.position.y;
    if (gasRx && L.playing && L.method !== 'colour') {
      const per = (L.rx === 'h2o2' ? 160 : 130) * Math.max(0, L.rate) * (L.rx === 'mg' ? Math.max(0.2, Math.cbrt(left)) : 1);
      this.#spawn += per * dt;
      while (this.#spawn >= 1) {
        this.#spawn -= 1;
        const p = this.#b.find((q) => !q.on);
        if (!p) break;
        let sx: number, sy: number, sz: number;
        if (L.rx === 'marble' && this.#sources.length) [sx, sy, sz] = this.#sources[Math.floor(rand() * this.#sources.length)];
        else if (L.rx === 'mg') { const u = (rand() - 0.5) * 1.1 * Math.cbrt(left); sx = u * Math.cos(0.5); sy = 0.15; sz = 0.1 - u * Math.sin(0.5); }
        else { const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.8; sx = r * Math.cos(a); sy = 0.1; sz = r * Math.sin(a); }
        Object.assign(p, { x: sx + (rand() - 0.5) * 0.08, y: sy, z: sz + (rand() - 0.5) * 0.08, v: 0.5 + rand() * 0.6, ph: rand() * 6, on: true });
      }
    } else this.#spawn = 0;
    let h = 0;
    for (const p of this.#b) {
      if (!p.on) continue;
      if (L.playing) { p.y += p.v * dt * (1 + p.y); p.ph += dt * 6; }
      if (p.y > LIQ_H - 0.02) { p.on = false; continue; }
      const w = Math.sin(p.ph) * 0.02;
      B.pos[3 * h] = fx + p.x + w; B.pos[3 * h + 1] = fy + p.y; B.pos[3 * h + 2] = p.z;
      B.col[3 * h] = 0.85; B.col[3 * h + 1] = 0.93; B.col[3 * h + 2] = 1.0;
      B.size[h] = 0.05 + 0.025 * p.y; B.alpha[h] = 0.85;
      h++;
    }
    B.flush(h);
  }

  dispose() { this.#balDisp.tex.dispose(); this.#colDisp.tex.dispose(); super.dispose(); }
}
