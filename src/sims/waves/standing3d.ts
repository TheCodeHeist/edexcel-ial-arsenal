/* Waves Lab · Standing waves in 3D. Three benches share one stage:

   string  Core Practical 5: a signal generator drives a vibration generator, which shakes one end of a string; the
           string runs along the bench, over a pulley, down to a mass hanger (T = mg). The string's shape comes from the
           exact steady state in standing.ts. Lit by a stroboscope set a little below f, it appears to move slowly
           (the apparent frequency is the difference); with the strobe off it blurs, as it does to the eye.
   sound   Core Practical 4: a loudspeaker and a microphone on a metre rule, both wired to a two-beam oscilloscope.
           The air between them is drawn as molecules, pushed to and fro along the direction the sound travels;
           compressions glow brighter. The scope's screen shows the same two traces as the panel beside the view.
   tube    an air column (closed or open at the far end) driven by a speaker at its open end: the molecules inside
           oscillate with a standing-wave envelope (displacement nodes at a closed end, antinodes at open ends).

   Lengths are true to scale along each bench; displacements are exaggerated (a real string moves a few mm, air
   molecules far less), and the HUD says so. */

import { THREE, Stage3D, pointCloud, label, rand } from '../particles/gl';
import { stringState, re, mag, tubeState, type TubeEnd } from './standing';
import { scopeDraw } from './standingScope';

export interface StLook {
  mode: 'string' | 'sound' | 'tube';
  strobe: number;        // apparent frequency / Hz (0: strobe off, the motion blurs)
  // string
  l: number; f: number; v: number; mass: number; parts: boolean; n: number; on: boolean;
  // sound
  fs: number; vs: number; mic: number; scope: { tb: number; v1: number; v2: number };
  // tube
  tube: TubeEnd; L: number; ft: number; tn: number; ton: boolean;
}

const S = 6;          // string bench: world units per metre
const PX = 4.6;       // the pulley's top, where the string leaves the bench
const NP = 241;       // points along the string
const S2 = 8;         // sound bench: units per metre
const SPK = -4.6;     // speaker face x
const S3 = 8.5;       // tube: units per metre
const TX = -3.9;      // tube's open end

const mat = (c: number, r = 0.6, m = 0.2) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });

function lineOf(n: number, color: number, opacity = 1, dashed = false) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const m = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity })
    : new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  const l = new THREE.Line(geo, m);
  l.frustumCulled = false;
  return l;
}
function setLine(l: THREE.Line, f: (i: number) => [number, number, number], n: number, dashed = false) {
  const a = l.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < n; i++) a.setXYZ(i, ...f(i));
  a.needsUpdate = true;
  l.geometry.setDrawRange(0, n);
  if (dashed) l.computeLineDistances();
}

export class StandingScene extends Stage3D<StLook> {
  #mode: StLook['mode'] | '' = '';
  #ph = 0;
  // string bench
  #sg = new THREE.Group();
  #gen = new THREE.Group();
  #rod: THREE.Mesh;
  #str = lineOf(NP, 0xf4f1ff);
  #glow = pointCloud(NP, this.px);
  #envU = lineOf(NP, 0x8fa8ff, 0.55, true);
  #envD = lineOf(NP, 0x8fa8ff, 0.55, true);
  #inc = lineOf(NP, 0x5aa8ff, 0.9);
  #ref = lineOf(NP, 0xff6b7a, 0.9);
  #hang = new THREE.Group();
  #dim = lineOf(2, 0xf2c14e);
  #dimLabel: THREE.Sprite | null = null;
  #genLabel: THREE.Sprite | null = null;
  #genText = '';
  #dimText = '';
  #nodes: THREE.Sprite[] = [];
  #antis: THREE.Sprite[] = [];
  #state: ReturnType<typeof stringState> | null = null;
  #amps: [number, number][] = [];
  #scale = 1;
  // sound bench
  #snd = new THREE.Group();
  #mic = new THREE.Group();
  #air = pointCloud(170 * 5 * 4, this.px);
  #airBase: Float32Array = new Float32Array(0);
  #scr: THREE.CanvasTexture;
  #scrCanvas: HTMLCanvasElement;
  #scopeKey = '';
  #cable2 = lineOf(40, 0x56c7ff, 0.8);
  // tube
  #tb = new THREE.Group();
  #tubeMesh: THREE.Mesh;
  #cap: THREE.Mesh;
  #tubeAir = pointCloud(2600, this.px);
  #tubeBase: Float32Array = new Float32Array(0);
  #tEnv = lineOf(160, 0xf2c14e, 0.9);
  #tEnv2 = lineOf(160, 0xf2c14e, 0.9);
  #tNodes: THREE.Sprite[] = [];
  #tAntis: THREE.Sprite[] = [];
  #tState: ReturnType<typeof tubeState> | null = null;

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [0.4, 3.2, 12.5], target: [0, -0.8, 0], bloom: [0.55, 0.45, 0.7], fov: 42 });
    this.scene.add(new THREE.AmbientLight(0x8a92b0, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(-3, 8, 7);
    this.scene.add(sun);
    this.scene.add(this.#sg, this.#snd, this.#tb);

    /* ===== string bench ===== */
    const bench = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.3, 2.2), mat(0x6b4a33, 0.85, 0));
    bench.position.set(-1.2, -1.55, 0);
    this.#sg.add(bench);
    // pulley clamped to the bench end
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.5), mat(0x40465a, 0.5, 0.6));
    clamp.position.set(PX - 0.2, -0.85, 0);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 40), mat(0xb8bfcc, 0.3, 0.8));
    wheel.rotation.x = Math.PI / 2; wheel.position.set(PX, -0.34, 0);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 12), mat(0x30343f, 0.4, 0.8));
    axle.rotation.x = Math.PI / 2; axle.position.copy(wheel.position);
    this.#sg.add(clamp, wheel, axle);
    // the string's vertical run over the pulley to the hanger
    const drop = lineOf(2, 0xf4f1ff);
    setLine(drop, (i) => (i ? [PX + 0.34, -3.3, 0] : [PX + 0.34, -0.34, 0]), 2);
    const wrap = lineOf(16, 0xf4f1ff);
    setLine(wrap, (i) => { const a = Math.PI / 2 - (i / 15) * (Math.PI / 2); return [PX + 0.34 * Math.cos(a), -0.34 + 0.34 * Math.sin(a), 0]; }, 16);
    this.#sg.add(drop, wrap, this.#hang);
    // vibration generator (moves to l from the pulley)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.9), mat(0x2b3550, 0.45, 0.35));
    body.position.y = -0.9;
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.08, 28), mat(0x1a1d26, 0.7, 0.1));
    cone.position.y = -0.36;
    this.#rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 10), mat(0xd9dde6, 0.3, 0.9));
    this.#rod.position.y = -0.18;
    const gl = label('vibration generator', 0.26); gl.position.set(0, -1.65 + 0.0, 0.75);
    this.#gen.add(body, cone, this.#rod, gl);
    this.#sg.add(this.#gen);
    // signal generator on the left
    const sgBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.0), mat(0x3a3f4c, 0.5, 0.4));
    sgBox.position.set(-6.4, -0.95, 0.45);
    this.#sg.add(sgBox);
    const sgl = label('signal generator', 0.24); sgl.position.set(-6.4, -0.2, 0.9); this.#sg.add(sgl);
    // string, glow, envelope and travelling parts
    this.#glow.obj.renderOrder = 2;
    this.#sg.add(this.#str, this.#glow.obj, this.#envU, this.#envD, this.#inc, this.#ref, this.#dim);
    const nl = label('N', 0.34, '#9fb4ff'), al = label('A', 0.34, '#ffd37a');
    for (let i = 0; i < 10; i++) { const a = nl.clone(), b = al.clone(); a.visible = b.visible = false; this.#nodes.push(a); this.#antis.push(b); this.#sg.add(a, b); }

    /* ===== sound bench ===== */
    const table = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.25, 3.2), mat(0x4a4f5e, 0.8, 0.1));
    table.position.set(-0.2, -1.55, 0.2);
    this.#snd.add(table);
    const spkBox = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 1.3), mat(0x23262f, 0.6, 0.2));
    spkBox.position.set(SPK - 0.5, -0.67, 0);
    const spkCone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x15171d, roughness: 0.8, side: THREE.DoubleSide }));
    spkCone.rotation.z = Math.PI / 2; spkCone.position.set(SPK - 0.12, -0.45, 0);
    const dust = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), mat(0x2a2d36, 0.5, 0.3));
    dust.position.set(SPK - 0.18, -0.45, 0);
    this.#snd.add(spkBox, spkCone, dust);
    const spl = label('loudspeaker', 0.26); spl.position.set(SPK - 0.5, 0.35, 0); this.#snd.add(spl);
    // metre rule along the bench, 0 at the speaker
    const rule = new THREE.Mesh(new THREE.BoxGeometry(S2 * 1.0, 0.03, 0.32), new THREE.MeshStandardMaterial({ map: this.#ruleTex(), roughness: 0.7 }));
    rule.position.set(SPK + S2 * 0.5, -1.41, 0.85);
    this.#snd.add(rule);
    // microphone on a stand (moves)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.06, 20), mat(0x30343f, 0.5, 0.6));
    base.position.y = -1.39;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 8), mat(0xaab0bc, 0.3, 0.9));
    pole.position.y = -0.92;
    const micBody = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.42, 16), mat(0x2b2e36, 0.4, 0.5));
    micBody.rotation.z = Math.PI / 2; micBody.position.set(0.12, -0.45, 0);
    const micHead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), mat(0x8d94a3, 0.35, 0.8));
    micHead.position.set(-0.12, -0.45, 0);
    const ptr = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 10), new THREE.MeshBasicMaterial({ color: 0xf2c14e }));
    ptr.rotation.x = Math.PI; ptr.position.set(-0.12, -1.3, 0.75);
    const ml = label('microphone', 0.24); ml.position.set(0, 0.25, 0);
    this.#mic.add(base, pole, micBody, micHead, ptr, ml);
    this.#snd.add(this.#mic);
    // signal generator and oscilloscope at the back
    const sg2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), mat(0x3a3f4c, 0.5, 0.4));
    sg2.position.set(-5.4, -1.0, -1.35);
    const sgl2 = label('signal generator', 0.22); sgl2.position.set(-5.6, -0.95, -0.85);
    const scope = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 1.1), mat(0x2f3440, 0.5, 0.3));
    scope.position.set(2.2, -0.52, -1.25);
    this.#scrCanvas = document.createElement('canvas');
    this.#scrCanvas.width = 512; this.#scrCanvas.height = 384;
    this.#scr = new THREE.CanvasTexture(this.#scrCanvas);
    this.#scr.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.42), new THREE.MeshBasicMaterial({ map: this.#scr, toneMapped: false }));
    screen.position.set(1.95, -0.48, -0.69);
    const scl = label('two-beam oscilloscope', 0.24); scl.position.set(2.2, 0.62, -1.25);
    this.#snd.add(sg2, sgl2, scope, screen, scl);
    const cab1 = lineOf(30, 0xf2c14e, 0.8);
    setLine(cab1, (i) => { const t = i / 29; return [-5.2 + (SPK - 0.5 + 5.2) * t, -1.38 + Math.sin(t * Math.PI) * 0.05, -0.9 + 0.9 * t]; }, 30);
    const cab0 = lineOf(30, 0xf2c14e, 0.8);
    setLine(cab0, (i) => { const t = i / 29; return [-4.5 + (1.0 + 4.5) * t, -1.38 + Math.sin(t * Math.PI) * 0.08, -1.3 + 0.15 * Math.sin(t * Math.PI)]; }, 30);
    this.#snd.add(cab1, cab0, this.#cable2);
    // air
    this.#air.obj.renderOrder = 1;
    this.#snd.add(this.#air.obj);
    {
      const n = this.#air.n, b = new Float32Array(n * 3);
      let k = 0;
      for (let i = 0; i < 170; i++) for (let j = 0; j < 5; j++) for (let q = 0; q < 4; q++) {
        b[k * 3] = SPK + 0.05 + ((i + rand() * 0.8) / 170) * 8.6;
        b[k * 3 + 1] = -0.9 + (j + rand()) * 0.18;
        b[k * 3 + 2] = -0.4 + (q + rand()) * 0.2;
        this.#air.size[k] = 0.045; k++;
      }
      this.#airBase = b;
    }

    /* ===== the air column ===== */
    const tbl = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.25, 2.4), mat(0x4a4f5e, 0.8, 0.1));
    tbl.position.set(0.2, -1.55, 0);
    this.#tb.add(tbl);
    this.#tubeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1, 40, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xbfd6ff, transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    this.#tubeMesh.rotation.z = Math.PI / 2;
    this.#cap = new THREE.Mesh(new THREE.CircleGeometry(0.56, 40), new THREE.MeshStandardMaterial({ color: 0x9aa6c0, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }));
    this.#cap.rotation.y = Math.PI / 2;
    const sp3 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 1.4), mat(0x23262f, 0.6, 0.2));
    sp3.position.set(TX - 0.75, -0.65, 0);
    const sl3 = label('loudspeaker', 0.24); sl3.position.set(TX - 0.8, 0.35, 0);
    this.#tb.add(this.#tubeMesh, this.#cap, sp3, sl3, this.#tEnv, this.#tEnv2, this.#tubeAir.obj);
    {
      const n = this.#tubeAir.n, b = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) {
        const r = 0.48 * Math.sqrt(rand()), a = rand() * Math.PI * 2;
        b[k * 3] = rand(); b[k * 3 + 1] = -0.4 + r * Math.cos(a); b[k * 3 + 2] = r * Math.sin(a);
        this.#tubeAir.size[k] = 0.045;
      }
      this.#tubeBase = b;
    }
    for (let i = 0; i < 8; i++) { const a = nl.clone(), b = al.clone(); a.visible = b.visible = false; this.#tNodes.push(a); this.#tAntis.push(b); this.#tb.add(a, b); }

    this.start();
  }

  #ruleTex() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 48;
    const g = c.getContext('2d')!;
    g.fillStyle = '#e8d9a0'; g.fillRect(0, 0, 1024, 48);
    g.strokeStyle = '#3a2f1a'; g.fillStyle = '#3a2f1a'; g.font = '600 14px monospace';
    for (let mm = 0; mm <= 100; mm++) {
      const x = (mm / 100) * 1023;
      const h = mm % 10 === 0 ? 22 : mm % 5 === 0 ? 14 : 8;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
      if (mm % 10 === 0 && mm > 0 && mm < 100) g.fillText(String(mm), x - 8, 40);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  override set(look: StLook) {
    const prev = this.look;
    super.set(look);
    if (look.mode !== this.#mode) {
      this.#mode = look.mode;
      this.#sg.visible = look.mode === 'string';
      this.#snd.visible = look.mode === 'sound';
      this.#tb.visible = look.mode === 'tube';
      // phones: a near-square view, so look along the bench at an angle instead of square-on
      const sm = this.small;
      if (look.mode === 'string') this.setHome(sm ? [-0.4, 5.6, 16.6] : [-0.6, 2.6, 11.2], sm ? [-0.9, -1.6, 0] : [-1.2, -1.0, 0]);
      else if (look.mode === 'sound') this.setHome(sm ? [0.2, 6.0, 15.0] : [-0.2, 3.6, 10.6], sm ? [-0.6, -0.9, 0] : [-0.4, -0.7, 0]);
      else this.setHome(sm ? [4.2, 4.0, 9.6] : [0.4, 2.4, 9.6], [0.4, -0.3, 0]);
    }
    if (look.mode === 'string') this.#setString(look, prev);
    else if (look.mode === 'sound') this.#setSound(look);
    else this.#setTube(look);
  }

  /* ---------- string ---------- */
  #setString(k: StLook, prev: StLook | null) {
    const gx = PX - k.l * S;
    this.#gen.position.set(gx, 0, 0);
    this.#state = stringState(k.f, k.v, k.l);
    // the amplitude at every point, and one display scale for the whole string (shape kept, size capped)
    let peak = 0;
    this.#amps = [];
    for (let i = 0; i < NP; i++) {
      const x = (i / (NP - 1)) * k.l;
      const z = this.#state.at(x);
      this.#amps.push(z);
      peak = Math.max(peak, mag(z));
    }
    const REF = 6e-3, MAXY = 1.05;    // 6 mm → about two thirds of the cap
    this.#scale = peak > 0 ? (MAXY * Math.tanh(peak / REF)) / peak : 1;
    setLine(this.#envU, (i) => [gx + (i / (NP - 1)) * k.l * S, mag(this.#amps[i]) * this.#scale, 0], NP, true);
    setLine(this.#envD, (i) => [gx + (i / (NP - 1)) * k.l * S, -mag(this.#amps[i]) * this.#scale, 0], NP, true);
    this.#inc.visible = this.#ref.visible = k.parts && k.strobe > 0;
    // hanger: one 50 g slotted mass per 50 g beyond the 50 g hanger
    if (!prev || prev.mass !== k.mass || this.#hang.children.length === 0) {
      for (const c of [...this.#hang.children]) { this.#hang.remove(c); (c as THREE.Mesh).geometry?.dispose(); }
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), mat(0xaab0bc, 0.3, 0.9));
      hook.position.set(PX + 0.34, -3.55, 0);
      this.#hang.add(hook);
      const slots = Math.max(1, Math.round(k.mass / 0.05));
      for (let i = 0; i < slots; i++) {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.09, 28), mat(i === 0 ? 0x8a8f99 : 0xc59a3c, 0.35, 0.85));
        d.position.set(PX + 0.34, -3.84 - (slots - 1 - i) * 0.1, 0);
        this.#hang.add(d);
      }
      const t = label(`${Math.round(k.mass * 1000)} g`, 0.24); t.position.set(PX - 0.55, -3.7 - slots * 0.05, 0);
      this.#hang.add(t);
    }
    // labels: frequency on the signal generator, l on the dimension line
    const gt = `${k.f.toFixed(1)} Hz`;
    if (gt !== this.#genText) {
      this.#genText = gt;
      if (this.#genLabel) { this.#sg.remove(this.#genLabel); this.#genLabel.material.map?.dispose(); this.#genLabel.material.dispose(); }
      this.#genLabel = label(gt, 0.34, '#7dffb0');
      this.#genLabel.position.set(-6.4, -0.92, 1.05);
      this.#sg.add(this.#genLabel);
    }
    setLine(this.#dim, (i) => [i ? PX : gx, -1.25, 1.05], 2);
    const dt = `l = ${k.l.toFixed(2)} m`;
    if (dt !== this.#dimText || !prev || prev.l !== k.l) {
      this.#dimText = dt;
      if (this.#dimLabel) { this.#sg.remove(this.#dimLabel); this.#dimLabel.material.map?.dispose(); this.#dimLabel.material.dispose(); }
      this.#dimLabel = label(dt, 0.28, '#f2c14e');
      this.#dimLabel.position.set((gx + PX) / 2, -1.02, 1.05);
      this.#sg.add(this.#dimLabel);
    }
    // nodes and antinodes when it is resonating (and few enough loops to label)
    const show = k.on && k.n <= 10;
    const lam = (2 * k.l) / k.n;
    this.#nodes.forEach((s, j) => {
      s.visible = show && j <= k.n && j < this.#nodes.length;
      if (s.visible) s.position.set(PX - j * (lam / 2) * S, 0.38, 0);
    });
    this.#antis.forEach((s, j) => {
      s.visible = show && j < k.n;
      if (s.visible) {
        const x = k.l - (j + 0.5) * (lam / 2);
        const i = Math.round((x / k.l) * (NP - 1));
        s.position.set(PX - (j + 0.5) * (lam / 2) * S, mag(this.#amps[i] ?? [0, 0]) * this.#scale + 0.32, 0);
      }
    });
    // the end nodes sit exactly on the pulley / generator; keep the generator one clear of its body
    if (show) this.#nodes[Math.min(k.n, this.#nodes.length - 1)].position.y = 0.5;
  }

  #drawString(k: StLook) {
    if (!this.#state) return;
    const gx = PX - k.l * S;
    const ph = this.#ph, sc = this.#scale;
    const g = this.#glow;
    setLine(this.#str, (i) => {
      const y = re(this.#amps[i], ph) * sc;
      const x = gx + (i / (NP - 1)) * k.l * S;
      g.pos[i * 3] = x; g.pos[i * 3 + 1] = y; g.pos[i * 3 + 2] = 0;
      g.col[i * 3] = 0.85; g.col[i * 3 + 1] = 0.85; g.col[i * 3 + 2] = 1.0;
      g.size[i] = 0.09; g.alpha[i] = 0.55;
      return [x, y, 0];
    }, NP);
    g.flush();
    this.#rod.position.y = -0.18 + Math.cos(ph) * Math.min(0.06, 0.06);
    if (this.#inc.visible) {
      const st = this.#state;
      setLine(this.#inc, (i) => { const x = (i / (NP - 1)) * k.l; return [gx + x * S, re(st.parts(x)[0], ph) * sc, 0.02]; }, NP);
      setLine(this.#ref, (i) => { const x = (i / (NP - 1)) * k.l; return [gx + x * S, re(st.parts(x)[1], ph) * sc, -0.02]; }, NP);
    }
  }

  /* ---------- sound ---------- */
  #setSound(k: StLook) {
    this.#mic.position.set(SPK + k.mic * S2, 0, 0);
    setLine(this.#cable2, (i) => {
      const t = i / 39, x0 = SPK + k.mic * S2 + 0.12, x1 = 1.4;
      return [x0 + (x1 - x0) * t, -1.38 + Math.sin(t * Math.PI) * 0.05, 0 - 1.0 * t];
    }, 40);
    const key = `${k.fs}|${k.vs}|${k.mic}|${k.scope.tb}|${k.scope.v1}|${k.scope.v2}`;
    if (key !== this.#scopeKey) {
      this.#scopeKey = key;
      scopeDraw(this.#scrCanvas.getContext('2d')!, 512, 384, k.fs, k.vs, k.mic, k.scope, true);
      this.#scr.needsUpdate = true;
    }
  }
  #drawAir(k: StLook) {
    const a = this.#air, b = this.#airBase, lam = k.vs / k.fs;
    const kw = (2 * Math.PI) / lam;
    const amp = Math.min(0.16, lam * S2 * 0.1);
    for (let i = 0; i < a.n; i++) {
      const x0 = b[i * 3], xm = (x0 - SPK) / S2;               // metres from the speaker
      const fall = 1 / (1 + xm * 1.2);
      const ph = this.#ph - kw * xm;
      a.pos[i * 3] = x0 + amp * fall * Math.sin(ph);
      a.pos[i * 3 + 1] = b[i * 3 + 1]; a.pos[i * 3 + 2] = b[i * 3 + 2];
      const comp = -Math.cos(ph) * fall;                         // −∂ξ/∂x: compression where positive
      const c = 0.5 + 0.5 * comp;
      a.col[i * 3] = 0.35 + 0.9 * c; a.col[i * 3 + 1] = 0.5 + 0.55 * c; a.col[i * 3 + 2] = 1.0;
      a.alpha[i] = 0.08 + 0.5 * c;
    }
    a.flush();
  }

  /* ---------- tube ---------- */
  #setTube(k: StLook) {
    const len = k.L * S3;
    this.#tubeMesh.scale.set(1, len, 1);
    this.#tubeMesh.position.set(TX + len / 2, -0.4, 0);
    this.#cap.visible = k.tube === 'closed';
    this.#cap.position.set(TX + len, -0.4, 0);
    this.#tState = tubeState(k.tube, k.ft, k.vs, k.L);
    const st = this.#tState;
    const sc = 0.62 * Math.tanh(st.peak / 10) / Math.max(st.peak, 1e-9);
    const env = (i: number, sgn: number): [number, number, number] => { const x = (i / 159) * k.L; return [TX + x * S3, 0.55 + sgn * mag(st.at(x)) * sc * 0.55 + 0.25, 0]; };
    setLine(this.#tEnv, (i) => env(i, 1), 160);
    setLine(this.#tEnv2, (i) => env(i, -1), 160);
    const show = k.ton && k.tn <= 8;
    const lam = k.vs / k.ft;
    // displacement nodes: closed end, and every λ/2 from it; antinodes λ/4 from a node (open ends are antinodes)
    const nodeXs: number[] = [], antiXs: number[] = [];
    if (show) {
      if (k.tube === 'closed') {
        for (let x = k.L; x > -1e-6; x -= lam / 2) nodeXs.push(x);
        for (let x = k.L - lam / 4; x > -lam * 0.05; x -= lam / 2) antiXs.push(Math.max(0, x));
      } else {
        for (let x = 0; x <= k.L + 1e-6; x += lam / 2) antiXs.push(x);
        for (let x = lam / 4; x < k.L; x += lam / 2) nodeXs.push(x);
      }
    }
    this.#tNodes.forEach((s, j) => { s.visible = j < nodeXs.length; if (s.visible) s.position.set(TX + nodeXs[j] * S3, 1.2, 0); });
    this.#tAntis.forEach((s, j) => { s.visible = j < antiXs.length; if (s.visible) s.position.set(TX + antiXs[j] * S3, 1.2, 0); });
  }
  #drawTube(k: StLook) {
    const st = this.#tState;
    if (!st) return;
    const a = this.#tubeAir, b = this.#tubeBase, len = k.L * S3;
    const sc = Math.min(0.5, (k.vs / k.ft) * S3 * 0.08) * Math.tanh(st.peak / 10) / Math.max(st.peak, 1e-9);
    for (let i = 0; i < a.n; i++) {
      const xm = b[i * 3] * k.L;
      const z = st.at(xm);
      const d = re(z, this.#ph) * sc;
      a.pos[i * 3] = TX + xm * S3 + d;
      a.pos[i * 3 + 1] = b[i * 3 + 1]; a.pos[i * 3 + 2] = b[i * 3 + 2];
      // compression: −ds/dx, sampled numerically
      const z2 = st.at(Math.min(k.L, xm + 0.004));
      const comp = -(re(z2, this.#ph) - re(z, this.#ph)) * sc / (0.004 * S3) * 2.2;
      const c = Math.max(0, Math.min(1, 0.5 + comp));
      a.col[i * 3] = 0.35 + 0.9 * c; a.col[i * 3 + 1] = 0.5 + 0.55 * c; a.col[i * 3 + 2] = 1.0;
      a.alpha[i] = 0.1 + 0.5 * c;
    }
    a.flush();
    void len;
  }

  protected update(dt: number) {
    const k = this.look!;
    // the stroboscope: shown at the apparent (difference) frequency; off, every frame catches a random moment (a blur)
    this.#ph = k.strobe > 0 ? this.#ph + 2 * Math.PI * k.strobe * dt : rand() * Math.PI * 2;
    if (k.mode === 'string') this.#drawString(k);
    else if (k.mode === 'sound') this.#drawAir(k);
    else this.#drawTube(k);
  }
}
