/* Energetics Lab: 3D Calorimetry apparatus (polystyrene cup + stirrer, or copper can + spirit burner). */

import { Stage3D, THREE, label } from '../particles/gl';
import type { CalMode } from './calorimetry';

export interface CalLook {
  mode: CalMode;
  liquidHex: number;
  endHex: number;
  tempFrac: number;   // -1 (cold) .. 0 (room) .. +1 (hot)
  lid: boolean;
  playing: boolean;
  progress: number;   // 0..1 reaction progress
}

export class CalorimetryScene extends Stage3D<CalLook> {
  #root = new THREE.Group();
  #lastMode: CalMode | null = null;
  #liquidMat: THREE.MeshStandardMaterial | null = null;
  #mercury: THREE.Mesh | null = null;
  #lidMesh: THREE.Mesh | null = null;
  #flame: THREE.Mesh | null = null;
  #stirrer: THREE.Mesh | null = null;
  #t = 0;

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [0, 2.5, 7.6], target: [0, 0.2, 0], bloom: [0.45, 0.4, 0.72] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.78));
    const k = new THREE.DirectionalLight(0xffffff, 1.35);
    k.position.set(5, 9, 6);
    this.scene.add(k);
    this.scene.add(this.#root);
    this.start();
  }

  #clear() {
    while (this.#root.children.length) {
      const c = this.#root.children[0];
      this.#root.remove(c);
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => { (x as THREE.SpriteMaterial).map?.dispose(); x.dispose(); });
        else if (mat) { (mat as THREE.SpriteMaterial).map?.dispose(); mat.dispose(); }
      });
    }
    this.#liquidMat = null;
    this.#mercury = null;
    this.#lidMesh = null;
    this.#flame = null;
    this.#stirrer = null;
  }

  #buildThermometer(baseY: number) {
    const g = new THREE.Group();
    g.position.set(0.32, baseY, 0);
    // Glass stem
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 3.6, 14),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.35, roughness: 0.15 }),
    );
    stem.position.y = 1.6;
    g.add(stem);
    // Bulb
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.35 }),
    );
    g.add(bulb);
    // Mercury/alcohol column
    const merc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.042, 2.8, 10),
      new THREE.MeshBasicMaterial({ color: 0xf87171 }),
    );
    merc.position.y = 1.4;
    g.add(merc);
    this.#mercury = merc;
    this.#root.add(g);
  }

  #build(mode: CalMode) {
    this.#clear();

    // Bench surface
    const bench = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.6, 0.18, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 }),
    );
    bench.position.y = -2.0;
    this.#root.add(bench);

    if (mode === 'cup') {
      // Beaker support around polystyrene cup
      const beaker = new THREE.Mesh(
        new THREE.CylinderGeometry(1.38, 1.25, 2.3, 28, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
      );
      beaker.position.y = -0.75;
      this.#root.add(beaker);

      // Polystyrene cup (cutaway translucent so liquid is visible)
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(1.18, 0.92, 2.2, 28, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.42, roughness: 0.8, side: THREE.DoubleSide }),
      );
      cup.position.y = -0.78;
      this.#root.add(cup);

      // Liquid inside
      this.#liquidMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75, roughness: 0.2 });
      const liq = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 0.88, 1.35, 26), this.#liquidMat);
      liq.position.y = -1.16;
      this.#root.add(liq);

      // Lid (toggleable)
      const lid = new THREE.Mesh(
        new THREE.CylinderGeometry(1.24, 1.24, 0.14, 28),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65 }),
      );
      lid.position.y = 0.34;
      this.#root.add(lid);
      this.#lidMesh = lid;

      // Glass stirring rod
      const stir = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 2.9, 10),
        new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.2 }),
      );
      stir.position.set(-0.35, 0.1, 0);
      stir.rotation.z = 0.12;
      this.#root.add(stir);
      this.#stirrer = stir;

      this.#buildThermometer(-1.4);

      const lCup = label('Polystyrene cup (insulator)', 0.28, '#e2e8f0');
      lCup.position.set(-2.1, -0.8, 0);
      this.#root.add(lCup);
    } else {
      // Spirit burner underneath
      const burner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.78, 0.95, 22),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55, roughness: 0.2 }),
      );
      burner.position.y = -1.42;
      this.#root.add(burner);

      const fuel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.7, 0.55, 20),
        new THREE.MeshStandardMaterial({ color: 0xfde68a, transparent: true, opacity: 0.65 }),
      );
      fuel.position.y = -1.58;
      this.#root.add(fuel);

      // Flame
      const flameGeo = new THREE.ConeGeometry(0.24, 0.75, 16);
      const flame = new THREE.Mesh(
        flameGeo,
        new THREE.MeshBasicMaterial({ color: 0xfb923c }),
      );
      flame.position.y = -0.52;
      this.#root.add(flame);
      this.#flame = flame;

      // Copper calorimeter can
      const can = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.15, 1.65, 28, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xe88b5a, metalness: 0.65, roughness: 0.28, transparent: true, opacity: 0.58, side: THREE.DoubleSide }),
      );
      can.position.y = 0.75;
      this.#root.add(can);

      // Water inside copper can
      this.#liquidMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.72, roughness: 0.18 });
      const water = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 1.15, 24), this.#liquidMat);
      water.position.y = 0.52;
      this.#root.add(water);

      this.#buildThermometer(0.2);

      const lCan = label('Copper calorimeter + water', 0.28, '#fed7aa');
      lCan.position.set(-2.2, 0.9, 0);
      const lBurn = label('Spirit burner', 0.28, '#fde68a');
      lBurn.position.set(1.8, -1.4, 0);
      this.#root.add(lCan, lBurn);
    }
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;
    if (L.mode !== this.#lastMode) {
      this.#lastMode = L.mode;
      this.#build(L.mode);
    }
    if (L.playing) this.#t += dt;

    if (this.#lidMesh) this.#lidMesh.visible = L.lid;
    if (this.#liquidMat) {
      const c1 = new THREE.Color(L.liquidHex);
      const c2 = new THREE.Color(L.endHex);
      this.#liquidMat.color.copy(c1).lerp(c2, L.progress);
    }
    if (this.#mercury) {
      const h = THREE.MathUtils.clamp(0.42 + L.tempFrac * 0.48, 0.12, 1.0);
      this.#mercury.scale.y = h;
      this.#mercury.position.y = h * 1.4;
    }
    if (this.#stirrer && L.playing) {
      this.#stirrer.position.x = -0.35 + Math.sin(this.#t * 4.5) * 0.18;
    }
    if (this.#flame) {
      const flick = 1 + Math.sin(this.#t * 16) * 0.12 + Math.cos(this.#t * 23) * 0.08;
      this.#flame.scale.set(1, flick, 1);
    }
  }
}
