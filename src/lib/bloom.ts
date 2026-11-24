/* Lazy loader for Three.js post-processing (EffectComposer + UnrealBloomPass).
   When 3D Bloom is turned off (e.g. Eco mode), this chunk is never even downloaded or instantiated. */

import { Vector2, type Camera, type Scene, type WebGLRenderer } from 'three';
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export interface BloomRig {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
}

type PostMods = {
  EffectComposer: typeof import('three/addons/postprocessing/EffectComposer.js').EffectComposer;
  RenderPass: typeof import('three/addons/postprocessing/RenderPass.js').RenderPass;
  UnrealBloomPass: typeof import('three/addons/postprocessing/UnrealBloomPass.js').UnrealBloomPass;
  OutputPass: typeof import('three/addons/postprocessing/OutputPass.js').OutputPass;
};

let pending: Promise<PostMods> | null = null;

function loadMods(): Promise<PostMods> {
  if (!pending) {
    pending = Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
      import('three/addons/postprocessing/OutputPass.js'),
    ]).then(([ec, rp, ub, op]) => ({
      EffectComposer: ec.EffectComposer,
      RenderPass: rp.RenderPass,
      UnrealBloomPass: ub.UnrealBloomPass,
      OutputPass: op.OutputPass,
    }));
  }
  return pending;
}

export async function createBloomRig(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  opts: [strength: number, radius: number, threshold: number],
  width: number,
  height: number,
): Promise<BloomRig> {
  const { EffectComposer, RenderPass, UnrealBloomPass, OutputPass } = await loadMods();
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(Math.max(128, width / 2), Math.max(128, height / 2)), opts[0], opts[1], opts[2]);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  if (width > 0 && height > 0) composer.setSize(width, height);
  return { composer, bloom };
}
