/* Waves Lab, Waves tab: the medium in 3D. A rope driven by a vibration generator (transverse), a slinky pushed and
   pulled by a paddle, or the air in a long glass tube in front of a loudspeaker (both longitudinal). Every particle
   of the medium moves only about its rest position; the wave is the pattern that travels. Two tagged particles (P
   and Q) carry a guide showing the line they move along, so "transverse" and "longitudinal" can be seen, not just
   read. Under a longitudinal medium a strip shows the excess pressure (warm: compression, cool: rarefaction); above
   it, optionally, the same displacements drawn sideways: the transverse picture every displacement–distance graph
   of a sound wave really is. A bracket rides on the wave, one wavelength long, crest to crest or compression to
   compression.

   The clock belongs to Bench.svelte (it also draws the graphs): it calls setTime() every frame. Lengths: the medium
   always spans 12 world units, so one metre is 12/L units. */

import { THREE, Stage3D, pointCloud, label, rand } from '../particles/gl';
import { disp, grad, type Medium, type WaveSpec } from './bench';

export interface BLook {
  medium: Medium;
  L: number;              // length / m
  w: WaveSpec;
  gain: number;           // world units per metre of displacement (exaggerated for sound)
  P: number; Q: number;   // marker rest positions / m
  pressure: boolean;
  ghost: boolean;
}

const W = 12, X0 = -6;
const PCOL = 0xff5c8a, QCOL = 0x5ce0a0;

/** A tube along a moving centre line; update() rebuilds the rings round the given points. */
function tube(n: number, radial: number, radius: number, mat: THREE.Material, ref: THREE.Vector3) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * radial * 3), nor = new Float32Array(n * radial * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = a + radial, d = b + radial;
    idx.push(a, c, b, b, c, d);
  }
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  return {
    mesh,
    update(c: Float32Array) {
      for (let i = 0; i < n; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
        a.fromArray(c, i0 * 3); b.fromArray(c, i1 * 3);
        T.subVectors(b, a).normalize();
        N.crossVectors(T, ref).normalize();
        B.crossVectors(N, T);
        for (let j = 0; j < radial; j++) {
          const th = (j / radial) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
          const k = (i * radial + j) * 3;
          const nx = cs * N.x + sn * B.x, ny = cs * N.y + sn * B.y, nz = cs * N.z + sn * B.z;
          pos[k] = c[i * 3] + radius * nx; pos[k + 1] = c[i * 3 + 1] + radius * ny; pos[k + 2] = c[i * 3 + 2] + radius * nz;
          nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.normal.needsUpdate = true;
    },
  };
}

function guide(color: number) {
  const g = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]),
    new THREE.LineDashedMaterial({ color, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.9 }));
  g.frustumCulled = false;
  return g;
}
function setLine(l: THREE.Line, a: [number, number, number], b: [number, number, number]) {
  const p = l.geometry.attributes.position as THREE.BufferAttribute;
  p.setXYZ(0, ...a); p.setXYZ(1, ...b); p.needsUpdate = true;
  l.computeLineDistances();
}
function ball(color: number, r: number) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.35 }));
}

export class BenchScene extends Stage3D<BLook> {
  #t = 0;
  #medium: Medium | '' = '';
  // rope
  #rope = new THREE.Group();
  #ropeN = 260;
  #ropeC = new Float32Array(260 * 3);
  #ropeTube = tube(260, 10, 0.055, new THREE.MeshStandardMaterial({ color: 0xe0a060, roughness: 0.55, metalness: 0.05, emissive: 0x2a1406 }), new THREE.Vector3(0, 0, 1));
  #beads: THREE.InstancedMesh;
  #rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 10), new THREE.MeshStandardMaterial({ color: 0xb8c0d0, metalness: 0.8, roughness: 0.3 }));
  // slinky
  #slinky = new THREE.Group();
  #turns = 64;
  #perTurn = 18;
  #coilN = 64 * 18 + 1;
  #coilC = new Float32Array((64 * 18 + 1) * 3);
  #coilTube = tube(64 * 18 + 1, 6, 0.022, new THREE.MeshStandardMaterial({ color: 0xc8d4ea, metalness: 0.85, roughness: 0.28, emissive: 0x101826 }), new THREE.Vector3(1, 0, 0));
  #paddle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x7080a0, metalness: 0.5, roughness: 0.4 }));
  // air
  #air = new THREE.Group();
  #molN: number;
  #mol0: Float32Array;
  #mols: ReturnType<typeof pointCloud>;
  #cone = new THREE.Group();
  // shared
  #strip: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  #stripN = 240;
  #ghost: THREE.Line;
  #ghostZero: THREE.Line;
  #bracket: THREE.Line;
  #lam = label('λ', 0.42, '#ffe08a');
  #pBall = ball(PCOL, 0.11);
  #qBall = ball(QCOL, 0.11);
  #pGuide = guide(PCOL);
  #qGuide = guide(QCOL);
  #pTag = label('P', 0.34, '#ff9ab5');
  #qTag = label('Q', 0.34, '#9df0c4');
  #ruler = new THREE.Group();
  #rulerKey = '';

  constructor(canvas: HTMLCanvasElement, small = false) {
    super(canvas, small, { cam: small ? [-1, 2.6, 13.4] : [-1.6, 2.8, 12.2], target: [0, -0.25, 0], bloom: [0.55, 0.4, 0.78] });
    this.scene.add(new THREE.AmbientLight(0x8890b0, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-3, 7, 8);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x6688ff, 0.8);
    rim.position.set(4, -2, -6);
    this.scene.add(rim);

    // ---- rope ----
    this.#rope.add(this.#ropeTube.mesh);
    this.#beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshStandardMaterial({ color: 0xfff0d8, emissive: 0x4a3010, roughness: 0.4 }), 33);
    this.#beads.frustumCulled = false;
    this.#rope.add(this.#beads);
    const gen = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), new THREE.MeshStandardMaterial({ color: 0x39404f, metalness: 0.5, roughness: 0.45 }));
    gen.position.set(X0 - 0.55, -1.25, 0);
    this.#rope.add(gen);
    this.#rod.position.set(X0, -0.6, 0);
    this.#rope.add(this.#rod);
    const g1 = label('vibration generator', 0.26); g1.position.set(X0 - 0.4, -1.95, 0); this.#rope.add(g1);
    const abs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.8), new THREE.MeshStandardMaterial({ color: 0x2b3140, roughness: 0.95 }));
    abs.position.set(-X0 + 0.3, 0, 0);
    this.#rope.add(abs);
    const a1 = label('absorber', 0.26); a1.position.set(-X0 + 0.3, 1.4, 0); this.#rope.add(a1);

    // ---- slinky ----
    this.#slinky.add(this.#coilTube.mesh);
    this.#paddle.position.set(X0 - 0.1, 0, 0);
    this.#slinky.add(this.#paddle);
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.3, 1.3), new THREE.MeshStandardMaterial({ color: 0x2b3140, roughness: 0.9 }));
    clamp.position.set(-X0 + 0.2, 0, 0);
    this.#slinky.add(clamp);
    const h1 = label('push–pull', 0.26); h1.position.set(X0 - 0.1, 0.95, 0); this.#slinky.add(h1);

    // ---- air ----
    this.#molN = small ? 1700 : 3200;
    this.#mol0 = new Float32Array(this.#molN * 3);
    this.#mols = pointCloud(this.#molN + 4, this.px);
    for (let i = 0; i < this.#molN; i++) {
      const r = 0.62 * Math.sqrt(rand()), a = rand() * Math.PI * 2;
      this.#mol0[i * 3] = X0 + 0.15 + rand() * (W - 0.3);
      this.#mol0[i * 3 + 1] = r * Math.cos(a);
      this.#mol0[i * 3 + 2] = r * Math.sin(a);
      const k = 0.75 + rand() * 0.25;
      this.#mols.col.set([0.55 * k, 0.72 * k, 1.0 * k], i * 3);
      this.#mols.size[i] = 0.085; this.#mols.alpha[i] = 0.85;
    }
    this.#air.add(this.#mols.obj);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, W, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x9fc0ff, transparent: true, opacity: 0.09, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false }));
    glass.rotation.z = Math.PI / 2;
    this.#air.add(glass);
    const coneMesh = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.45, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x404858, roughness: 0.7, side: THREE.DoubleSide }));
    coneMesh.rotation.z = Math.PI / 2;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), new THREE.MeshStandardMaterial({ color: 0x8890a0, metalness: 0.6, roughness: 0.3 }));
    cap.position.x = 0.12;
    const magnet = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.35, 24), new THREE.MeshStandardMaterial({ color: 0x5a6070, metalness: 0.8, roughness: 0.3 }));
    magnet.rotation.z = Math.PI / 2; magnet.position.x = -0.42;
    this.#cone.add(coneMesh, cap, magnet);
    this.#cone.position.x = X0 - 0.25;
    this.#air.add(this.#cone);
    const s1 = label('loudspeaker', 0.26); s1.position.set(X0 - 0.3, 1.05, 0); this.#air.add(s1);
    const wad = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.4, 32), new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 1 }));
    wad.rotation.z = Math.PI / 2; wad.position.x = -X0 + 0.2;
    this.#air.add(wad);
    const w1 = label('absorbing wadding', 0.26); w1.position.set(-X0 - 0.3, 1.05, 0); this.#air.add(w1);

    // ---- pressure strip ----
    const sg = new THREE.PlaneGeometry(W, 0.34, this.#stripN - 1, 1);
    sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.#stripN * 2 * 3), 3));
    this.#strip = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.#strip.rotation.x = -Math.PI / 2.6;
    this.#strip.position.set(0, -1.15, 0.2);
    const ps = label('excess pressure', 0.24, '#c8cfe6'); ps.position.set(X0 + 1.05, -1.5, 0.45);
    this.#strip.add(ps); ps.position.set(X0 + 1.05, -0.38, 0);

    // ---- ghost (displacement drawn sideways) ----
    this.#ghost = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 240 }, () => new THREE.Vector3())),
      new THREE.LineBasicMaterial({ color: 0x9fb4ff, transparent: true, opacity: 0.95 }));
    this.#ghost.frustumCulled = false;
    this.#ghostZero = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(X0, 1.55, 0), new THREE.Vector3(-X0, 1.55, 0)]),
      new THREE.LineDashedMaterial({ color: 0x5c6680, dashSize: 0.1, gapSize: 0.08 }));
    this.#ghostZero.computeLineDistances();

    // ---- bracket ----
    this.#bracket = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 6 }, () => new THREE.Vector3())),
      new THREE.LineBasicMaterial({ color: 0xffe08a }));
    this.#bracket.frustumCulled = false;

    this.scene.add(this.#rope, this.#slinky, this.#air, this.#strip, this.#ghost, this.#ghostZero, this.#bracket, this.#lam,
      this.#pBall, this.#qBall, this.#pGuide, this.#qGuide, this.#pTag, this.#qTag, this.#ruler);
    this.start();
  }

  setTime(t: number) { this.#t = t; }

  #buildRuler(L: number, y: number) {
    const key = `${L}|${y}`;
    if (key === this.#rulerKey) return;
    this.#rulerKey = key;
    for (const c of [...this.#ruler.children]) { this.#ruler.remove(c); (c as THREE.Mesh).geometry?.dispose(); }
    const sx = W / L, step = L <= 2 ? 0.25 : 0.5;
    const pts: THREE.Vector3[] = [new THREE.Vector3(X0, y, 0.9), new THREE.Vector3(-X0, y, 0.9)];
    for (let m = 0; m <= L + 1e-9; m += step / 2) {
      const x = X0 + m * sx, big = Math.abs(m / step - Math.round(m / step)) < 1e-6;
      pts.push(new THREE.Vector3(x, y, 0.9), new THREE.Vector3(x, y + (big ? 0.16 : 0.08), 0.9));
      if (big && Math.abs(m - Math.round(m)) < 1e-6) {
        const l = label(`${Math.round(m)} m`, 0.22, '#9aa3bd'); l.position.set(x, y - 0.2, 0.9); this.#ruler.add(l);
      }
    }
    this.#ruler.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x5c6680 })));
  }

  protected update() {
    const o = this.look!;
    const { w, L } = o;
    const sx = W / L, t = this.#t, g = o.gain;
    const X = (m: number) => X0 + m * sx;
    const long = o.medium !== 'rope';
    if (o.medium !== this.#medium) {
      this.#medium = o.medium;
      this.#rope.visible = o.medium === 'rope';
      this.#slinky.visible = o.medium === 'slinky';
      this.#air.visible = o.medium === 'air';
    }
    this.#buildRuler(L, long ? -1.72 : -1.15);

    if (o.medium === 'rope') {
      const n = this.#ropeN, c = this.#ropeC;
      for (let i = 0; i < n; i++) {
        const m = (i / (n - 1)) * L;
        c[i * 3] = X(m); c[i * 3 + 1] = disp(m, t, w) * g; c[i * 3 + 2] = 0;
      }
      this.#ropeTube.update(c);
      const M = new THREE.Matrix4();
      for (let b = 0; b < 33; b++) {
        const m = ((b + 0.5) / 33) * L;
        M.makeTranslation(X(m), disp(m, t, w) * g, 0);
        this.#beads.setMatrixAt(b, M);
      }
      this.#beads.instanceMatrix.needsUpdate = true;
      const y0 = disp(0, t, w) * g;
      this.#rod.position.y = (y0 - 0.85) / 2; this.#rod.scale.y = Math.max(0.05, y0 + 0.85);
    } else if (o.medium === 'slinky') {
      const c = this.#coilC, R = 0.48, n = this.#coilN;
      for (let i = 0; i < n; i++) {
        const u = i / this.#perTurn, m = (u / this.#turns) * L, a = u * Math.PI * 2;
        c[i * 3] = X(m) + disp(m, t, w) * g; c[i * 3 + 1] = R * Math.cos(a); c[i * 3 + 2] = R * Math.sin(a);
      }
      this.#coilTube.update(c);
      this.#paddle.position.x = X0 - 0.08 + disp(0, t, w) * g;
    } else {
      const P = this.#mols;
      for (let i = 0; i < this.#molN; i++) {
        const x0 = this.#mol0[i * 3], m = (x0 - X0) / sx;
        P.pos[i * 3] = x0 + disp(m, t, w) * g; P.pos[i * 3 + 1] = this.#mol0[i * 3 + 1]; P.pos[i * 3 + 2] = this.#mol0[i * 3 + 2];
      }
      P.flush(this.#molN);
      this.#cone.position.x = X0 - 0.25 + disp(0, t, w) * g;
    }

    // pressure strip
    this.#strip.visible = long && o.pressure;
    if (this.#strip.visible) {
      const col = this.#strip.geometry.attributes.color as THREE.BufferAttribute;
      const kmax = Math.max(1e-12, (w.A * 2 * Math.PI * w.f) / w.v);
      for (let i = 0; i < this.#stripN; i++) {
        const m = (i / (this.#stripN - 1)) * L;
        const p = Math.max(-1, Math.min(1, -grad(m, t, w) / kmax));
        const r = 0.12 + (p > 0 ? 0.62 * p : 0.04 * -p), gg = 0.13 + (p > 0 ? 0.36 * p : 0.24 * -p), b = 0.18 + (p > 0 ? 0.02 * p : 0.6 * -p);
        col.setXYZ(i, r, gg, b); col.setXYZ(i + this.#stripN, r, gg, b);
      }
      col.needsUpdate = true;
    }

    // ghost: longitudinal displacement drawn as if sideways
    this.#ghost.visible = this.#ghostZero.visible = long && o.ghost;
    if (this.#ghost.visible) {
      const p = this.#ghost.geometry.attributes.position as THREE.BufferAttribute;
      const Ad = w.A * g;
      const s = Ad > 0 ? Math.min(1, 0.55 / Ad) : 1;
      for (let i = 0; i < 240; i++) { const m = (i / 239) * L; p.setXYZ(i, X(m), 1.55 + disp(m, t, w) * g * s, 0); }
      p.needsUpdate = true;
    }

    // markers
    const lam = w.v / w.f;
    const mark = (ball: THREE.Mesh, gd: THREE.Line, tag: THREE.Sprite, m: number) => {
      const s = disp(m, t, w) * g, Ad = w.A * g;
      if (!long) {
        ball.position.set(X(m), s, 0.0);
        setLine(gd, [X(m), -Ad - 0.12, 0], [X(m), Ad + 0.12, 0]);
        tag.position.set(X(m), Ad + 0.42, 0);
      } else {
        const y = o.medium === 'slinky' ? 0.58 : 0;
        const z = o.medium === 'slinky' ? 0 : 0.05;
        ball.position.set(X(m) + s, y, z);
        setLine(gd, [X(m) - Ad - 0.05, y + (o.medium === 'air' ? 0.82 : 0.2), z], [X(m) + Ad + 0.05, y + (o.medium === 'air' ? 0.82 : 0.2), z]);
        tag.position.set(X(m) + s, y + (o.medium === 'air' ? 1.12 : 0.48), z);
      }
      ball.scale.setScalar(o.medium === 'air' ? 0.8 : 1);
    };
    mark(this.#pBall, this.#pGuide, this.#pTag, o.P);
    mark(this.#qBall, this.#qGuide, this.#qTag, o.Q);

    // λ bracket: crest to crest (transverse) or compression to compression (longitudinal), riding with the wave
    let show = !w.pulse && lam < 0.8 * L;
    if (show) {
      // crest: f(t − t₀ − x/v) = n + ¼ ; compression centre: = n
      const off = long ? 0 : 0.25;
      const base = t - w.t0;
      const want = 0.12 * L;
      const n = Math.ceil(w.f * (base - want / w.v) - off - 1e-9);
      let x1 = w.v * (base - (n + off) / w.f);
      while (x1 < want) x1 += lam;
      while (x1 - lam >= want) x1 -= lam;
      const x2 = x1 + lam;
      if (x2 > L * 0.98 || x2 > w.v * base) show = false;
      else {
        const y = long ? (o.ghost ? 2.45 : 1.25) : w.A * g + 0.72;
        const p = this.#bracket.geometry.attributes.position as THREE.BufferAttribute;
        const a = X(x1), b = X(x2);
        p.setXYZ(0, a, y - 0.16, 0); p.setXYZ(1, a, y, 0); p.setXYZ(2, b, y, 0); p.setXYZ(3, b, y - 0.16, 0);
        p.setXYZ(4, b, y - 0.16, 0); p.setXYZ(5, b, y - 0.16, 0);
        p.needsUpdate = true;
        this.#lam.position.set((a + b) / 2, y + 0.24, 0);
      }
    }
    this.#bracket.visible = this.#lam.visible = show;
  }
}
