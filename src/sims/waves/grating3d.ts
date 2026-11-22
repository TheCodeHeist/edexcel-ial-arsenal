/* Waves Lab, Diffraction tab: the 3D views.

   Grating (Core Practical 6): a laser on an optical bench shines through a diffraction grating onto a screen D metres
   away. Each order leaves the grating at θ where nλ = d sin θ and lands at x = D tan θ; the screen is a canvas
   texture with the spots (or, for white light, a spectrum in each order) and a ruler, to scale (4 world units per
   metre). Orders that miss the screen fly on past it. The fans of white light are drawn as coloured sheets.

   Electron diffraction: a fine-beam tube. Electrons boil off a hot cathode, are accelerated through V to the anode,
   pass through a thin layer of graphite and spread onto the fluorescent screen at the far end of the bulb: a bright
   centre and two rings, one for each set of graphite planes. Ring radii are to scale with the bulb (40 world units per
   metre), so they shrink as V rises. */

import { THREE, Stage3D, pointCloud, label, rand, fin } from '../particles/gl';
import { orders, electron } from './grating';
import { lambdaRGB } from './consts';

export interface GLook {
  mode: 'grating' | 'electron';
  nm: number; white: boolean; lpm: number; D: number;
  kV: number;
  playing: boolean;
}

const M = 4;                    // world units per metre on the bench
const GX = -3.2;                // x of the grating
const HALF = 1.25;              // the screen spans ±1.25 m
const TW = 2048, TH = 512;      // screen texture
const WAV = Array.from({ length: 76 }, (_, i) => 400 + i * 4);

export class GratingScene extends Stage3D<GLook> {
  #grate = new THREE.Group();
  #elec = new THREE.Group();
  #mode = '';
  #key = '';
  #screen: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  #canvas = document.createElement('canvas');
  #texture: THREE.CanvasTexture;
  #fans = new THREE.Group();
  #slide: THREE.Group = new THREE.Group();
  #slideLabel: THREE.Sprite | null = null;
  #screenLabel: THREE.Sprite | null = null;
  #laserGlow: THREE.Sprite;
  #inBeam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  #cyl = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  // electrons
  #rings = new THREE.Group();
  #flow = pointCloud(1400, this.px);
  #parts: { s: number; ring: number; phi: number }[] = [];
  #ringR: number[] = [0.8, 1.4];
  #elKey = '';
  #t = 0;

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [-6.5, 4.2, 7.5], target: [0.8, 0, 0], bloom: [0.9, 0.5, 0.45] });
    this.scene.add(new THREE.AmbientLight(0x9aa2c0, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-4, 9, 6);
    this.scene.add(sun);
    this.scene.add(this.#grate, this.#elec);
    this.#canvas.width = TW; this.#canvas.height = TH;
    this.#texture = new THREE.CanvasTexture(this.#canvas);
    this.#texture.colorSpace = THREE.SRGBColorSpace;
    this.#screen = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF * M, 2 * HALF * M * (TH / TW)), new THREE.MeshBasicMaterial({ map: this.#texture, side: THREE.DoubleSide }));
    this.#laserGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.#inBeam = new THREE.Mesh(this.#cyl, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.#buildBench();
    this.#buildTube();
    this.start();
  }

  #buildBench() {
    const g = this.#grate;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(15, 0.18, 0.6), new THREE.MeshStandardMaterial({ color: 0x2a3040, metalness: 0.6, roughness: 0.4 }));
    rail.position.set(1.5, -0.95, 0);
    g.add(rail);
    const floor = new THREE.GridHelper(24, 24, 0x2e3850, 0x1c2232);
    floor.position.y = -1.05; g.add(floor);
    // the laser
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 24), new THREE.MeshStandardMaterial({ color: 0x353b4b, metalness: 0.7, roughness: 0.35 }));
    body.rotation.z = Math.PI / 2; body.position.set(-6.4, 0, 0);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x252a36 }));
    stand.position.set(-6.4, -0.55, 0);
    g.add(body, stand);
    this.#laserGlow.position.set(-5.58, 0, 0); this.#laserGlow.scale.setScalar(0.6);
    g.add(this.#laserGlow, this.#inBeam);
    const ll = label('laser', 0.3); ll.position.set(-6.4, 0.65, 0); g.add(ll);
    const warn = label('never look into the beam', 0.22, '#ffd58a'); warn.position.set(-6.4, -1.45, 0.6); g.add(warn);
    // the grating: a slide in a holder, with lines drawn on it
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 1.3), new THREE.MeshStandardMaterial({ color: 0x4a5164, metalness: 0.4, roughness: 0.5 }));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    glass.rotation.y = Math.PI / 2; glass.position.x = 0.05;
    this.#slide.add(frame, glass);
    const lp: number[] = [];
    for (let i = -20; i <= 20; i++) lp.push(0.06, -0.45, i * 0.022, 0.06, 0.45, i * 0.022);
    this.#slide.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)), new THREE.LineBasicMaterial({ color: 0xc8d8ff, transparent: true, opacity: 0.4 })));
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x5a6070, metalness: 0.7 }));
    post.position.y = -0.85;
    this.#slide.add(post);
    this.#slide.position.x = GX;
    g.add(this.#slide, this.#fans);
    // the screen
    this.#screen.rotation.y = -Math.PI / 2;
    g.add(this.#screen);
  }

  #drawScreen(L: GLook) {
    const c = this.#canvas.getContext('2d')!;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#1a1d26'; c.fillRect(0, 0, TW, TH);
    const pxm = TW / (2 * HALF);                 // px per metre across
    const X = (z: number) => TW / 2 + z * pxm;
    c.globalCompositeOperation = 'lighter';
    const spot = (x: number, rgb: [number, number, number], I: number, rad: number) => {
      const gr = c.createRadialGradient(x, TH * 0.56, 0, x, TH * 0.56, rad);
      const col = (a: number) => `rgba(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)},${a})`;
      gr.addColorStop(0, col(Math.min(1, I))); gr.addColorStop(0.35, col(0.6 * I)); gr.addColorStop(1, col(0));
      c.fillStyle = gr; c.beginPath(); c.arc(x, TH * 0.56, rad, 0, Math.PI * 2); c.fill();
    };
    if (L.white) {
      for (const nm of WAV) for (const o of orders(nm, L.lpm)) {
        const z = L.D * Math.tan(o.theta);
        if (Math.abs(z) > HALF) continue;
        spot(X(z), lambdaRGB(nm), o.n === 0 ? 0.3 : 0.6 * o.I, o.n === 0 ? 30 : 20);
      }
    } else {
      const rgb = lambdaRGB(L.nm);
      for (const o of orders(L.nm, L.lpm)) {
        const z = L.D * Math.tan(o.theta);
        if (Math.abs(z) > HALF) continue;
        spot(X(z), rgb, 0.35 + 0.65 * o.I, 44);
        spot(X(z), rgb, 0.6 + 0.4 * o.I, 16);
        spot(X(z), [1, 1, 1], 0.45 * o.I, 5);
      }
    }
    // a metre rule along the bottom: centimetre ticks, labels every 10 cm
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#4a4230'; c.fillRect(0, TH - 46, TW, 46);
    c.strokeStyle = '#a89c74'; c.fillStyle = '#b8ac84'; c.lineWidth = 2;
    c.font = '600 24px ui-monospace, monospace'; c.textAlign = 'center';
    for (let cm = -125; cm <= 125; cm++) {
      const x = X(cm / 100);
      const big = cm % 10 === 0, mid = cm % 5 === 0;
      c.beginPath(); c.moveTo(x, TH - 46); c.lineTo(x, TH - 46 + (big ? 22 : mid ? 14 : 8)); c.stroke();
      if (big && Math.abs(cm) <= 120) c.fillText(String(Math.abs(cm)), x, TH - 6);
    }
    this.#texture.needsUpdate = true;
  }

  #rebuildGrating(L: GLook) {
    const sx = GX + fin(L.D, 1) * M;
    this.#screen.position.set(sx, 0.15, 0);
    this.#drawScreen(L);
    if (this.#screenLabel) { this.#grate.remove(this.#screenLabel); this.#screenLabel.material.map?.dispose(); this.#screenLabel.material.dispose(); }
    this.#screenLabel = label(`screen, D = ${L.D.toFixed(2)} m`, 0.3); this.#screenLabel.position.set(sx, 1.7, 0); this.#grate.add(this.#screenLabel);
    if (this.#slideLabel) { this.#grate.remove(this.#slideLabel); this.#slideLabel.material.map?.dispose(); this.#slideLabel.material.dispose(); }
    this.#slideLabel = label(`grating, ${L.lpm} lines per mm`, 0.28); this.#slideLabel.position.set(GX, 1.05, 0); this.#grate.add(this.#slideLabel);
    // the incoming beam
    const rgb = L.white ? [1, 1, 1] : lambdaRGB(L.nm);
    const len = GX - -5.58;
    this.#inBeam.position.set((GX + -5.58) / 2, 0, 0); this.#inBeam.rotation.set(0, 0, Math.PI / 2); this.#inBeam.scale.set(0.03, len, 0.03);
    this.#inBeam.material.color.setRGB(rgb[0] * 1.4, rgb[1] * 1.4, rgb[2] * 1.4);
    this.#laserGlow.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
    // the diffracted beams (or fans of colour for white light)
    for (const o of [...this.#fans.children]) { this.#fans.remove(o); const m = o as THREE.Mesh; if (m.geometry !== this.#cyl) m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    const reach = (th: number) => { const dz = Math.tan(th) * L.D; return Math.abs(dz) <= HALF ? L.D / Math.cos(th) : Math.min(5.5, (HALF + 0.6) / Math.abs(Math.sin(th))); };
    if (L.white) {
      const nmax = Math.floor((1e-3 / L.lpm) / 400e-9);
      for (let n = -nmax; n <= nmax; n++) {
        if (n === 0) continue;
        const pos: number[] = [], col: number[] = [];
        for (let i = 0; i < WAV.length - 1; i++) {
          const ln = [WAV[i], WAV[i + 1]].map((nm) => { const s = (n * nm * 1e-9 * L.lpm) / 1e-3; return Math.abs(s) < 1 ? Math.asin(s) : null; });
          if (ln[0] === null || ln[1] === null) continue;
          const [a, b] = [ln[0], ln[1]];
          const ra = reach(a) * M, rb = reach(b) * M;
          const ca = lambdaRGB(WAV[i]), cb = lambdaRGB(WAV[i + 1]);
          pos.push(GX, 0, 0, GX + Math.cos(a) * ra, 0, Math.sin(a) * ra, GX + Math.cos(b) * rb, 0, Math.sin(b) * rb);
          col.push(ca[0], ca[1], ca[2], ca[0], ca[1], ca[2], cb[0], cb[1], cb[2]);
        }
        if (!pos.length) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        this.#fans.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.13 / Math.abs(n), side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })));
      }
      // glowing spectra where each order meets the screen
      for (const o0 of orders(400, L.lpm)) {
        const n = o0.n;
        for (let nm = 400; nm <= 700; nm += 12) {
          const sn = (n * nm * 1e-9 * L.lpm) / 1e-3;
          if (Math.abs(sn) >= 1) continue;
          const z = L.D * Math.tan(Math.asin(sn));
          if (Math.abs(z) > HALF) continue;
          const c3 = n === 0 ? [1, 1, 1] : lambdaRGB(nm);
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: new THREE.Color(c3[0], c3[1], c3[2]), transparent: true, opacity: n === 0 ? 0.06 : 0.3 / Math.sqrt(Math.abs(n)), depthWrite: false, blending: THREE.AdditiveBlending }));
          sp.position.set(GX + L.D * M - 0.05, 0, z * M); sp.scale.setScalar(0.42);
          this.#fans.add(sp);
        }
      }
      const zero = new THREE.Mesh(this.#cyl, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.2, 1.2), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
      zero.position.set(GX + (L.D * M) / 2, 0, 0); zero.rotation.z = Math.PI / 2; zero.scale.set(0.03, L.D * M, 0.03);
      this.#fans.add(zero);
    } else {
      for (const o of orders(L.nm, L.lpm)) {
        const r = reach(o.theta) * M;
        const m = new THREE.Mesh(this.#cyl, new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0] * 2, rgb[1] * 2, rgb[2] * 2), transparent: true, opacity: 0.18 + 0.6 * o.I, blending: THREE.AdditiveBlending, depthWrite: false }));
        const dir = new THREE.Vector3(Math.cos(o.theta), 0, Math.sin(o.theta));
        m.position.set(GX, 0, 0).addScaledVector(dir, r / 2);
        m.scale.set(0.022, r, 0.022);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        this.#fans.add(m);
        const z = L.D * Math.tan(o.theta);
        if (Math.abs(z) <= HALF) {
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: new THREE.Color(rgb[0], rgb[1], rgb[2]), transparent: true, opacity: 0.4 + 0.5 * o.I, depthWrite: false, blending: THREE.AdditiveBlending }));
          sp.position.set(GX + L.D * M - 0.05, 0, z * M); sp.scale.setScalar(0.5);
          this.#fans.add(sp);
          const nl = label(`n = ${o.n}`, 0.22, '#dfe6ff'); nl.position.set(GX + L.D * M - 0.1, 0.62, z * M);
          this.#fans.add(nl);
        }
      }
    }
  }

  /* ---------- the electron diffraction tube ---------- */
  #buildTube() {
    const g = this.#elec;
    const glassM = new THREE.MeshStandardMaterial({ color: 0xa8c8ff, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(2.6, 48, 32), glassM);
    bulb.position.x = 2.4;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 6.2, 32, 1, true), glassM);
    neck.rotation.z = Math.PI / 2; neck.position.x = -3.4;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 32), new THREE.MeshStandardMaterial({ color: 0x2a2f3c, metalness: 0.5, roughness: 0.5 }));
    cap.rotation.z = Math.PI / 2; cap.position.x = -6.6;
    g.add(bulb, neck, cap);
    // fluorescent screen on the far side of the bulb
    const scr = new THREE.Mesh(new THREE.SphereGeometry(2.58, 48, 12, 0, Math.PI * 2, 0, 0.78), new THREE.MeshBasicMaterial({ color: 0x1d3a2a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    scr.position.x = 2.4; scr.rotation.z = -Math.PI / 2;
    g.add(scr);
    // cathode, anode, graphite
    const fil = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xff9a40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    fil.position.set(-5.9, 0, 0); fil.scale.setScalar(0.7);
    const anode = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x9aa3b8, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide }));
    anode.rotation.z = Math.PI / 2; anode.position.x = -4.6;
    const target = new THREE.Mesh(new THREE.CircleGeometry(0.22, 6), new THREE.MeshStandardMaterial({ color: 0x3a3e48, metalness: 0.3, roughness: 0.8, side: THREE.DoubleSide }));
    target.rotation.y = Math.PI / 2; target.position.x = -0.2;
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x8a90a0, metalness: 0.7, side: THREE.DoubleSide }));
    mesh.rotation.y = Math.PI / 2; mesh.position.x = -0.2;
    g.add(fil, anode, target, mesh, this.#rings, this.#flow.obj);
    const l1 = label('hot cathode', 0.26, '#ffcf9a'); l1.position.set(-6.0, 0.85, 0);
    const l2 = label('anode (+V)', 0.26); l2.position.set(-4.6, -0.85, 0);
    const l3 = label('thin graphite', 0.26); l3.position.set(-0.2, 0.8, 0);
    const l4 = label('fluorescent screen', 0.28, '#9feccf'); l4.position.set(5.1, 2.4, 0);
    g.add(l1, l2, l3, l4);
    for (let i = 0; i < 260; i++) this.#parts.push({ s: rand() * 12, ring: 0, phi: rand() * Math.PI * 2 });
  }
  #rebuildElec(L: GLook) {
    const el = electron(L.kV);
    const W = 5.2 / 0.13;          // world units per metre in the tube: graphite (x = −0.2) to screen (x = 5.0) is 13 cm
    this.#ringR = el.rings.map((r) => r.r * W);
    for (const o of [...this.#rings.children]) { this.#rings.remove(o); const m = o as THREE.Mesh; m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    const cx = 4.98;
    this.#ringR.forEach((r, i) => {
      // the ring sits on the curved screen: x where the sphere (centre 2.4, radius 2.6) has this radius
      const x = 2.4 + Math.sqrt(Math.max(0, 2.58 * 2.58 - r * r)) - 0.01;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035 + i * 0.01, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 1.0), transparent: true, opacity: i ? 0.7 : 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.y = Math.PI / 2; ring.position.x = x;
      this.#rings.add(ring);
    });
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0x9dffc8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    dot.position.set(cx, 0, 0); dot.scale.setScalar(0.9);
    this.#rings.add(dot);
  }
  #elecUpdate(dt: number, L: GLook) {
    if (L.playing) this.#t += dt;
    const f = this.#flow;
    let k = 0;
    const speed = 3 + L.kV * 1.2;
    const lenA = 5.7, lenB = 5.2;        // cathode → graphite, graphite → screen
    for (const p of this.#parts) {
      if (L.playing) p.s += dt * speed;
      if (p.s > lenA + lenB) { p.s -= lenA + lenB; const u = rand(); p.ring = u < 0.4 ? 0 : u < 0.75 ? 1 : 2; p.phi = rand() * Math.PI * 2; }
      let x: number, y = 0, z = 0;
      if (p.s < lenA) { x = -5.9 + p.s; }
      else {
        const u = (p.s - lenA) / lenB;
        const R = p.ring === 0 ? 0 : this.#ringR[p.ring - 1];
        x = -0.2 + u * lenB; y = Math.cos(p.phi) * R * u; z = Math.sin(p.phi) * R * u;
      }
      for (let j = 0; j < 4 && k < f.n; j++) {
        f.pos.set([x - j * 0.06, y * (1 - j * 0.01), z * (1 - j * 0.01)], k * 3);
        f.col.set([0.6, 1.0, 2.2], k * 3);
        f.size[k] = j ? 0.05 : 0.08; f.alpha[k] = j ? 0.35 : 0.9;
        k++;
      }
    }
    f.flush(k);
  }

  set(look: GLook) {
    super.set(look);
    const k = JSON.stringify([look.mode, look.nm, look.white, look.lpm, look.D]);
    if (look.mode === 'grating' && k !== this.#key) { this.#key = k; this.#rebuildGrating(look); }
    const e = String(look.kV);
    if (look.mode === 'electron' && e !== this.#elKey) { this.#elKey = e; this.#rebuildElec(look); }
  }

  /** Go to a camera home, standing further back on a phone's narrow view. */
  #home(cam: [number, number, number], tgt: [number, number, number]) {
    const k = this.small ? 1.35 : 1;
    this.setHome([tgt[0] + (cam[0] - tgt[0]) * k, tgt[1] + (cam[1] - tgt[1]) * k, tgt[2] + (cam[2] - tgt[2]) * k], tgt);
  }

  protected update(dt: number) {
    const L = this.look!;
    if (L.mode !== this.#mode) {
      this.#mode = L.mode;
      if (L.mode === 'grating') { this.#home([-6.5, 4.2, 7.5], [0.8, 0, 0]); this.#key = ''; }
      else { this.#home([-2.5, 3.6, 10.5], [0.4, 0, 0]); this.#elKey = ''; }
      this.set(L);
    }
    this.#grate.visible = L.mode === 'grating';
    this.#elec.visible = L.mode === 'electron';
    if (L.mode === 'electron') this.#elecUpdate(dt, L);
  }
}
