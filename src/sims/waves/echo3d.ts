/* Waves Lab · Pulse–echo in 3D: a cut-away block of the material under the transducer (tissue under an ultrasound
   probe, or the sea under a ship), layers coloured, depth to scale top to bottom. The pulse goes down as a bright band
   (cyan), fading as it is absorbed and as it gives up part of itself at every boundary; each echo comes back up as an
   amber band. All positions come from echo.ts at the same time ts as the A-scan, which draws itself as the echoes
   arrive at the top. The band's thickness is the pulse's true length in space (at least a hairline). */

import { THREE, Stage3D, pointCloud, label, rand } from '../particles/gl';
import { SCENARIOS, echoes, depthAt, downAmp, layerAt, dB, env, type Scenario, type Echo } from './echo';

export interface EchoLook { sc: Scenario['id']; f: number; gap: number; cycles: number; ts: number }

const H = 7.2, Y0 = 3.4, W = 6.4, D = 3.0, BEAM = 0.5;
const PER = 260;                      // points per pulse band
const MAXB = 9;                       // bands at once (down + echoes)

export class EchoScene extends Stage3D<EchoLook> {
  #g = new THREE.Group();
  #id = '';
  #sc: Scenario = SCENARIOS[0];
  #k = 1;                             // world units per metre of depth
  #bands = pointCloud(PER * MAXB, this.px);
  #jit = Float32Array.from({ length: PER * 3 }, () => rand());
  #pair: THREE.Mesh[] = [];
  #list: Echo[] = [];
  #gap = -1;

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: [7.8, 3.4, 10.6], target: [0.3, 0.1, 0], bloom: [0.7, 0.45, 0.6], fov: 42 });
    this.scene.add(new THREE.AmbientLight(0x8a92b0, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(5, 9, 6);
    this.scene.add(sun, this.#g, this.#bands.obj);
    this.#bands.obj.renderOrder = 5;
    this.start();
  }

  #y = (z: number) => Y0 - z * this.#k;

  #build(sc: Scenario) {
    for (const c of [...this.#g.children]) {
      this.#g.remove(c);
      c.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mt = m.material as THREE.Material | undefined; if (mt) { (mt as THREE.SpriteMaterial).map?.dispose(); mt.dispose(); } });
    }
    this.#sc = sc;
    const total = sc.layers[sc.layers.length - 1].bot;
    this.#k = H / total;
    const g = this.#g;
    for (const L of sc.layers) {
      const h = (L.bot - L.top) * this.#k;
      const c = new THREE.Color(...L.col);
      const box = new THREE.Mesh(new THREE.BoxGeometry(W, h, D), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.2, roughness: 0.8, depthWrite: false }));
      box.position.set(0, this.#y(L.top) - h / 2, 0);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.55 }));
      edges.position.copy(box.position);
      // the cut face, a little more solid
      const face = new THREE.Mesh(new THREE.PlaneGeometry(W, h), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.12, depthWrite: false }));
      face.position.set(0, box.position.y, D / 2 + 0.001);
      g.add(box, edges, face);
      const lb = label(L.name, 0.3, '#e9ecf8');
      lb.position.set(-W / 2 - 0.2 - 0.12 * L.name.length, box.position.y, D / 2);
      g.add(lb);
    }
    // depth scale on the right of the cut face
    const step = sc.id === 'body' ? 0.02 : 10;
    for (let z = 0; z <= total + 1e-9; z += step) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: 0xc8cde0 }));
      tick.position.set(W / 2 + 0.12, this.#y(z), D / 2);
      const t = label(`${sc.id === 'body' ? Math.round(z * 100) : Math.round(z)} ${sc.dUnit}`, 0.24, '#aab2cc');
      t.position.set(W / 2 + 0.75, this.#y(z), D / 2);
      g.add(tick, t);
    }
    // the beam
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(BEAM, BEAM, H, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.set(0, Y0 - H / 2, 0);
    g.add(beam);
    // the transducer
    if (sc.id === 'body') {
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.35, 32), new THREE.MeshStandardMaterial({ color: 0x9aa3b6, roughness: 0.4, metalness: 0.5 }));
      head.position.set(0, Y0 + 0.18, 0);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.2, 28), new THREE.MeshStandardMaterial({ color: 0xdde2ec, roughness: 0.35, metalness: 0.1 }));
      handle.position.set(0, Y0 + 0.95, 0);
      const gel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.04, 32), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.5 }));
      gel.position.set(0, Y0 + 0.02, 0);
      const cable = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.05, 8, 40, Math.PI * 0.6), new THREE.MeshStandardMaterial({ color: 0x30343f }));
      cable.position.set(-1.1, Y0 + 1.55, 0); cable.rotation.z = -0.2;
      g.add(head, handle, gel, cable);
      const pl = label('probe (transmits, then listens)', 0.26); pl.position.set(1.8, Y0 + 1.2, 0); g.add(pl);
      const gl = label('coupling gel: no air gap', 0.22, '#9fe8ff'); gl.position.set(-2.2, Y0 + 0.3, 0); g.add(gl);
    } else {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 1.6), new THREE.MeshStandardMaterial({ color: 0x8c2f2f, roughness: 0.6, metalness: 0.2 }));
      hull.position.set(0, Y0 + 0.3, 0);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 1.5), new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.7 }));
      deck.position.set(0, Y0 + 0.71, 0);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.1), new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6 }));
      cab.position.set(-0.6, Y0 + 1.12, 0);
      const tx = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x30343f, metalness: 0.6, roughness: 0.4 }));
      tx.position.set(0, Y0 - 0.08, 0);
      const surf = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, D + 2), new THREE.MeshBasicMaterial({ color: 0x5fa8ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      surf.rotation.x = -Math.PI / 2; surf.position.y = Y0;
      g.add(hull, deck, cab, tx, surf);
      const pl = label('transducer under the hull', 0.26); pl.position.set(2.6, Y0 + 1.3, 0); g.add(pl);
    }
    // the pair of small reflectors
    this.#pair = [0, 1].map(() => {
      const m = sc.id === 'body'
        ? new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 1.8) }))
        : new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshStandardMaterial({ color: 0xc8d4e0, metalness: 0.7, roughness: 0.3 }));
      if (sc.id === 'sea') m.scale.set(0.26, 0.07, 0.08);
      g.add(m);
      return m;
    });
    const pl = label(sc.pair.name, 0.24, '#ffe3a0');
    pl.position.set(1.4, this.#y(sc.pair.depth), D / 2);
    g.add(pl);
    this.#gap = -1;
  }

  override set(look: EchoLook) {
    super.set(look);
    if (look.sc !== this.#id) {
      this.#id = look.sc;
      this.#build(SCENARIOS.find((s) => s.id === look.sc) ?? SCENARIOS[0]);
    }
    if (look.gap !== this.#gap) {
      this.#gap = look.gap;
      this.#pair[0].position.set(0, this.#y(this.#sc.pair.depth), 0);
      this.#pair[1].position.set(0, this.#y(this.#sc.pair.depth + look.gap), 0);
    }
    this.#list = echoes(this.#sc, look.f, look.gap);
  }

  protected update() {
    const k = this.look!, sc = this.#sc, b = this.#bands;
    const total = sc.layers[sc.layers.length - 1].bot;
    const ts = k.ts;
    let n = 0;
    const band = (z: number, amp: number, up: boolean) => {
      if (n >= MAXB) return;
      const L = layerAt(sc, Math.min(z, total - 1e-9));
      const lam = L.v / k.f, len = Math.max(0.035, k.cycles * lam * this.#k);
      const strength = Math.max(0, Math.min(1, (dB(amp) + 70) / 70));
      if (strength <= 0.01) return;
      const y0 = this.#y(z);
      const base = n * PER;
      for (let i = 0; i < PER; i++) {
        const j = this.#jit;
        const r = BEAM * 0.95 * Math.sqrt(j[i * 3]), a = j[i * 3 + 1] * Math.PI * 2, u = j[i * 3 + 2] - 0.5;
        const p = base + i;
        const yy = y0 - u * len;
        b.pos[p * 3] = r * Math.cos(a); b.pos[p * 3 + 1] = Math.min(Y0, Math.max(Y0 - H, yy)); b.pos[p * 3 + 2] = r * Math.sin(a);
        const carrier = 0.55 + 0.45 * Math.sin(2 * Math.PI * k.cycles * u);
        const e = env(u, 1) * carrier;
        if (up) { b.col[p * 3] = 1.6; b.col[p * 3 + 1] = 0.95; b.col[p * 3 + 2] = 0.35; }
        else { b.col[p * 3] = 0.45; b.col[p * 3 + 1] = 1.2; b.col[p * 3 + 2] = 1.7; }
        b.size[p] = 0.07;
        b.alpha[p] = e * (0.12 + 0.88 * strength);
      }
      n++;
    };
    // the transmitted pulse on its way down
    const zd = depthAt(sc, ts);
    if (ts > 0 && zd < total - 1e-9) band(zd, downAmp(sc, k.f, k.gap, zd), false);
    // echoes on their way back up
    for (const e of this.#list) {
      if (ts >= e.t / 2 && ts <= e.t) band(depthAt(sc, e.t - ts), Math.abs(e.A), true);
    }
    b.flush(n * PER);
  }
}
