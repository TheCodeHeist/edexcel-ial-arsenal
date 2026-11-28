/* Acid–Base Lab: 3D Burette & Conical Flask Titration Bench on a White Tile (WCH13 / WCH14). */

import { Stage3D, THREE, label } from '../particles/gl';

export interface BuretteLook {
  volAdded: number;    // 0..40 cm³
  flaskHex: number;    // indicator colour of flask liquid
  dropSeq: number;     // increments whenever a drop/portion is added
  swirlSeq: number;    // increments on swirl
}

export class BuretteScene extends Stage3D<BuretteLook> {
  #buretteLiq: THREE.Mesh;
  #flaskLiq: THREE.Mesh;
  #flaskMat: THREE.MeshStandardMaterial;
  #flaskGrp = new THREE.Group();
  #drop: THREE.Mesh;
  #dropY = 0.4;
  #dropActive = false;
  #swirlT = 0;
  #lastDropSeq = 0;
  #lastSwirlSeq = 0;

  constructor(canvas: HTMLCanvasElement, small: boolean) {
    super(canvas, small, { cam: [0, 1.4, 7.6], target: [0, 0.2, 0], bloom: [0.35, 0.35, 0.8] });
    this.scene.add(new THREE.AmbientLight(0xdbe4ff, 0.82));
    const k = new THREE.DirectionalLight(0xffffff, 1.35);
    k.position.set(5, 9, 6);
    this.scene.add(k);

    // White tile underneath conical flask (matches DESIGN.md chemistry rule!)
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.14, 3.2),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 }),
    );
    tile.position.y = -2.1;
    this.scene.add(tile);

    // Retort stand pole & clamp arm
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 5.6, 12),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.3 }),
    );
    pole.position.set(-1.35, 0.65, 0);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.1, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6 }),
    );
    arm.position.set(-0.68, 2.0, 0);
    this.scene.add(pole, arm);

    // Glass burette tube
    const bur = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 2.9, 20, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
    );
    bur.position.y = 1.9;
    this.scene.add(bur);

    // Burette liquid column
    this.#buretteLiq = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 2.5, 18),
      new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.68 }),
    );
    this.#buretteLiq.position.y = 1.75;
    this.scene.add(this.#buretteLiq);

    // Burette tap
    const tap = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.1, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xf87171, roughness: 0.4 }),
    );
    tap.position.y = 0.45;
    this.scene.add(tap);

    // Falling droplet
    this.#drop = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xbae6fd }),
    );
    this.#drop.visible = false;
    this.scene.add(this.#drop);

    // Conical flask group
    const flaskGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 1.05, 1.85, 28, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
    );
    flaskGlass.position.y = -1.1;
    this.#flaskMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.78, roughness: 0.2 });
    this.#flaskLiq = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.98, 0.78, 26), this.#flaskMat);
    this.#flaskLiq.position.y = -1.62;
    this.#flaskGrp.add(flaskGlass, this.#flaskLiq);
    this.scene.add(this.#flaskGrp);

    const lTile = label('White tile (spot the faint colour change)', 0.24, '#e2e8f0');
    lTile.position.set(0, -2.42, 0.6);
    this.scene.add(lTile);

    this.start();
  }

  protected update(dt: number): void {
    const L = this.look;
    if (!L) return;

    // Burette liquid height drops as volAdded goes 0..40 cm³
    const frac = Math.max(0.06, 1 - L.volAdded / 42);
    this.#buretteLiq.scale.y = frac;
    this.#buretteLiq.position.y = 0.55 + frac * 1.25;

    // Flask colour & slight volume rise
    this.#flaskMat.color.setHex(L.flaskHex);
    const fillScale = 1 + Math.min(0.45, L.volAdded / 60);
    this.#flaskLiq.scale.y = fillScale;
    this.#flaskLiq.position.y = -2.0 + 0.39 * fillScale;

    if (L.dropSeq !== this.#lastDropSeq) {
      this.#lastDropSeq = L.dropSeq;
      this.#dropActive = true;
      this.#dropY = 0.38;
    }
    if (this.#dropActive) {
      this.#drop.visible = true;
      this.#dropY -= dt * 4.5;
      this.#drop.position.set(0, this.#dropY, 0);
      if (this.#dropY < -1.35) {
        this.#dropActive = false;
        this.#drop.visible = false;
      }
    }

    if (L.swirlSeq !== this.#lastSwirlSeq) {
      this.#lastSwirlSeq = L.swirlSeq;
      this.#swirlT = 1.0;
    }
    if (this.#swirlT > 0) {
      this.#swirlT = Math.max(0, this.#swirlT - dt * 1.8);
      this.#flaskGrp.rotation.z = Math.sin(this.#swirlT * Math.PI * 6) * 0.08 * this.#swirlT;
    } else {
      this.#flaskGrp.rotation.z = 0;
    }
  }
}
