/* Star Lab: the 3D view of a star's life (three.js).

   One scene holds every object a star can become; set(look) says which stage we are at and how far through it, and
   the frame loop eases sizes, colours and the camera towards it, so scrubbing the timeline glides instead of jumping.
     cloud      thousands of particles in clumps that fall together into a spinning accretion disc
     protostar  the disc feeds a growing, red-hot core; bipolar jets fire along the spin axis
     star       a sphere with a convecting surface (noise granulation), limb darkening and a glow in its black-body colour
     giant      the same star, swollen and red, with big convection cells and a wind blowing off its surface
     nebula     an hourglass shell of gas (teal inside, red outside) expanding round the hot core
     supernova  a flash, then a filamentary shell rushing outwards
     neutron    a tiny, very hot sphere with two lighthouse beams sweeping round (a pulsar) inside the fading remnant
     blackhole  a black sphere, an accretion disc spiralling in (brighter on the side moving towards you), and the
                lensed image of the far side of the disc arching over the top and bottom
   Sizes are on a compressed scale (radius^0.28), or a red supergiant would be 100 000 times bigger than a white dwarf.

   Only what the current stage needs is drawn; the loop stops while the canvas is off screen or the tab is hidden. */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { bbColor } from './data';
import type { Visual, Fate } from './evolve';

export interface Look {
  visual: Visual;
  u: number;        // 0–1 through the stage
  T: number;        // surface temperature / K
  R: number;        // radius / R☉
  M: number;        // starting mass / M☉
  fate: Fate;
  giantR: number;   // the largest radius it reached as a giant (R☉), where an expanding shell starts
}

/* ---------- GLSL ---------- */

// Ashima Arts 3D simplex noise (MIT), used by the star surface and the supernova filaments
export const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

export const STAR_V = /* glsl */ `
varying vec3 vPos; varying vec3 vN; varying vec3 vV;
void main(){
  vPos = position;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
export const STAR_F = /* glsl */ `
uniform vec3 uColor; uniform float uTime; uniform float uCells; uniform float uContrast; uniform float uBright; uniform float uDark; uniform float uBands;
varying vec3 vPos; varying vec3 vN; varying vec3 vV;
${NOISE}
void main(){
  vec3 p = normalize(vPos);
  float t = uTime * 0.06;
  // granulation: bright cell centres, dark lanes between them, slowly churning
  float g1 = snoise(p * uCells + vec3(0.0, t, t * 0.7));
  float g2 = snoise(p * uCells * 2.3 - vec3(t * 1.3, 0.0, t));
  float lanes = 1.0 - abs(snoise(p * uCells * 1.2 + vec3(t * 0.5)));
  float spots = smoothstep(0.55, 0.85, snoise(p * 2.1 + vec3(t * 0.2))) * uDark;
  float n = 0.5 * g1 + 0.25 * g2 + 0.35 * (lanes - 0.5);
  float mu = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  float limb = 0.32 + 0.68 * pow(mu, 0.55);
  vec3 col = uColor * (1.0 + uContrast * n) * limb * (1.0 - 0.65 * spots);
  // the limb reddens a little (cooler, higher layers)
  col = mix(col * vec3(1.0, 0.72, 0.5), col, smoothstep(0.0, 0.45, mu));
  // cloud bands (brown dwarfs): stripes of latitude, wobbled by the noise
  col *= 1.0 + uBands * 0.35 * sin(p.y * 16.0 + 2.5 * g1);
  gl_FragColor = vec4(col * uBright, 1.0);
}`;

/** Point sprites with soft edges; sizes are in world units. */
export const MAXPT = { value: 64 };

export const SOFT_F = /* glsl */ `
varying vec3 vColor; varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d); a *= a;
  if (a * vAlpha < 0.004) discard;
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;

const CLOUD_V = /* glsl */ `
attribute vec3 aCloud; attribute vec3 aDisk; attribute float aSeed; attribute vec3 aColor; attribute float aSize;
uniform float uTime; uniform float uCollapse; uniform float uFall; uniform float uCore; uniform float uAlpha; uniform float uPx;
/* point size in pixels from a size in world units, capped so a particle drifting past the camera can never be drawn
   thousands of pixels wide (tens of thousands of those, added together, can stall the GPU and lose the context) */
uniform float uMaxPt;
float ps(float s, float z){ return -z < 0.05 ? 0.0 : min(s * uPx / -z, uMaxPt); }
varying vec3 vColor; varying float vAlpha;
void main(){
  float c = uCollapse;
  float drift = uTime * 0.07;
  vec3 turb = vec3(sin(drift + aSeed * 40.0), cos(drift * 0.8 + aSeed * 25.0), sin(drift * 0.6 + aSeed * 13.0)) * 0.7;
  vec3 p0 = aCloud * mix(1.0, 0.18, smoothstep(0.0, 0.55, c)) + turb * (1.0 - c);
  // in the disc: Keplerian orbits; half the particles spiral in and are swallowed by the core
  float r = aDisk.x;
  float falls = step(0.5, fract(aSeed * 3.7));
  float flow = fract(aSeed * 7.13 + uTime * 0.035 * (0.6 + aSeed));
  float rr = mix(r, mix(r, uCore, flow), uFall * falls);
  float w = 1.1 * pow(max(rr, 0.35), -1.5);
  float ang = aDisk.y + uTime * w;
  vec3 pd = vec3(cos(ang) * rr, aDisk.z * (0.08 + 0.05 * rr), sin(ang) * rr);
  float k = smoothstep(0.2, 0.8, c + 0.25 * (aSeed - 0.5));
  vec3 p = mix(p0, pd, k);
  vec3 hot = mix(vec3(1.6, 1.15, 0.7), vec3(0.95, 0.42, 0.25), smoothstep(0.8, 7.0, rr));
  vColor = mix(aColor, hot, k);
  vAlpha = uAlpha * mix(0.16, 0.3, k) * (1.0 - smoothstep(0.82, 1.0, flow) * uFall * falls);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = ps(aSize * mix(1.3, 0.22, k), mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const JET_V = /* glsl */ `
attribute float aSeed; attribute vec3 aOff;
uniform float uTime; uniform float uAlpha; uniform float uLen; uniform float uPx;
/* point size in pixels from a size in world units, capped so a particle drifting past the camera can never be drawn
   thousands of pixels wide (tens of thousands of those, added together, can stall the GPU and lose the context) */
uniform float uMaxPt;
float ps(float s, float z){ return -z < 0.05 ? 0.0 : min(s * uPx / -z, uMaxPt); }
varying vec3 vColor; varying float vAlpha;
void main(){
  float f = fract(aSeed + uTime * 0.25);
  float side = aOff.z > 0.0 ? 1.0 : -1.0;
  vec3 p = vec3(aOff.x * (0.15 + f * 0.9), side * f * uLen, aOff.y * (0.15 + f * 0.9));
  vColor = mix(vec3(0.8, 0.9, 1.6), vec3(0.6, 0.35, 1.0), f);
  vAlpha = uAlpha * 0.5 * (1.0 - f) * smoothstep(0.0, 0.08, f);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = ps((0.12 + 0.25 * (1.0 - f)), mv.z);
  gl_Position = projectionMatrix * mv;
}`;

export const SHELL_V = /* glsl */ `
attribute vec3 aDir; attribute float aR; attribute float aSeed; attribute float aSize;
uniform float uTime; uniform float uRadius; uniform float uMode; uniform float uAlpha; uniform float uPx;
/* point size in pixels from a size in world units, capped so a particle drifting past the camera can never be drawn
   thousands of pixels wide (tens of thousands of those, added together, can stall the GPU and lose the context) */
uniform float uMaxPt;
float ps(float s, float z){ return -z < 0.05 ? 0.0 : min(s * uPx / -z, uMaxPt); }
varying vec3 vColor; varying float vAlpha;
${NOISE}
void main(){
  vec3 d = aDir;
  vec3 col; float r; float a = 1.0;
  if (uMode < 0.5) {
    // planetary nebula: an hourglass with a denser waist (a ring) and clumpy knots
    float lobe = 1.0 + 1.25 * pow(abs(d.y), 2.2);
    float knot = 0.9 + 0.2 * snoise(d * 5.0);
    r = uRadius * lobe * knot * (0.8 + 0.2 * aR);
    col = mix(vec3(0.25, 1.0, 0.85), vec3(1.25, 0.25, 0.35), smoothstep(0.35, 1.0, aR));
    col = mix(col, vec3(0.45, 0.6, 1.2), (1.0 - aR) * 0.4);
    a = 0.55 + 0.45 * (1.0 - abs(d.y));
  } else {
    // supernova remnant: filaments where the noise ridges are, faster in some directions than others
    float n = snoise(d * 3.2 + vec3(aSeed * 0.1));
    float ridge = 1.0 - abs(snoise(d * 7.0));
    r = uRadius * (1.0 + 0.2 * n) * (0.88 + 0.12 * aR);
    col = mix(vec3(0.45, 0.6, 1.5), vec3(1.5, 0.5, 0.18), smoothstep(0.3, 0.95, aR));
    col = mix(col, vec3(1.6, 1.2, 0.5), ridge * ridge * 0.6);
    a = pow(clamp(ridge, 0.0, 1.0), 4.0) * 1.3 + 0.08;
  }
  vec3 p = d * r;
  vColor = col;
  vAlpha = uAlpha * a * 0.32;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = ps(aSize * (0.25 + 0.02 * uRadius) * (uMode < 0.5 ? 1.0 : 0.55), mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const WIND_V = /* glsl */ `
attribute vec3 aDir; attribute float aSeed;
uniform float uTime; uniform float uR0; uniform float uAlpha; uniform float uPx; uniform vec3 uWind;
/* point size in pixels from a size in world units, capped so a particle drifting past the camera can never be drawn
   thousands of pixels wide (tens of thousands of those, added together, can stall the GPU and lose the context) */
uniform float uMaxPt;
float ps(float s, float z){ return -z < 0.05 ? 0.0 : min(s * uPx / -z, uMaxPt); }
varying vec3 vColor; varying float vAlpha;
void main(){
  float f = fract(aSeed + uTime * 0.03);
  vec3 p = aDir * uR0 * (1.02 + f * 1.6);
  vColor = mix(uWind * 1.3, uWind * 0.45, f);
  vAlpha = uAlpha * 0.45 * (1.0 - f) * smoothstep(0.0, 0.1, f);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = ps(uR0 * 0.06 * (0.6 + f), mv.z);
  gl_Position = projectionMatrix * mv;
}`;

// black-hole accretion disc: inward spiral, Keplerian speed, Doppler beaming on the approaching side
export const DISC_V = /* glsl */ `
attribute float aR; attribute float aA; attribute float aH; attribute float aSeed;
uniform float uTime; uniform float uIn; uniform float uOut; uniform float uAlpha; uniform float uPx;
/* point size in pixels from a size in world units, capped so a particle drifting past the camera can never be drawn
   thousands of pixels wide (tens of thousands of those, added together, can stall the GPU and lose the context) */
uniform float uMaxPt;
float ps(float s, float z){ return -z < 0.05 ? 0.0 : min(s * uPx / -z, uMaxPt); }
varying vec3 vColor; varying float vAlpha;
void main(){
  float f = fract(aR - uTime * 0.012 * (0.5 + aSeed));
  float rr = mix(uIn, uOut, f * f);
  float ang = aA + uTime * 1.6 * pow(rr / uIn, -1.5);
  vec3 p = vec3(cos(ang) * rr, aH * 0.04 * rr, sin(ang) * rr);
  vec3 vel = normalize(vec3(-sin(ang), 0.0, cos(ang)));
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vec3 toCam = normalize(cameraPosition - wp.xyz);
  float beam = 1.0 + 0.75 * dot(mat3(modelMatrix) * vel, toCam);
  float x = (rr - uIn) / (uOut - uIn);
  vec3 col = mix(vec3(1.7, 1.6, 1.9), vec3(1.6, 0.85, 0.35), smoothstep(0.0, 0.3, x));
  col = mix(col, vec3(0.75, 0.22, 0.12), smoothstep(0.35, 1.0, x));
  vColor = col * beam;
  vAlpha = uAlpha * 0.4 * (1.0 - smoothstep(0.85, 1.0, x)) * smoothstep(0.0, 0.04, x) * (0.45 + 0.55 * beam * 0.5);
  vec4 mv = viewMatrix * wp;
  gl_PointSize = ps((0.07 + 0.02 * rr), mv.z);
  gl_Position = projectionMatrix * mv;
}`;

// the far side of the disc, bent by the black hole's gravity into arcs over and under the hole; drawn in view space
const LENS_V = /* glsl */ `
attribute float aA; attribute float aR; attribute float aSeed;
uniform float uTime; uniform float uIn; uniform float uAlpha; uniform float uPx;
/* point size in pixels from a size in world units, capped so a particle drifting past the camera can never be drawn
   thousands of pixels wide (tens of thousands of those, added together, can stall the GPU and lose the context) */
uniform float uMaxPt;
float ps(float s, float z){ return -z < 0.05 ? 0.0 : min(s * uPx / -z, uMaxPt); }
varying vec3 vColor; varying float vAlpha;
void main(){
  float ang = aA + uTime * 0.25 * (aR < 0.02 ? 3.0 : 1.0);
  float rr = uIn * (aR < 0.02 ? 0.62 : 0.75 + aR * 0.9);
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec4 mv = c + vec4(cos(ang) * rr, sin(ang) * rr * 0.92, 0.0, 0.0);
  float arc = aR < 0.02 ? 1.0 : pow(abs(sin(ang)), 1.6);
  vColor = aR < 0.02 ? vec3(2.0, 1.7, 1.4) : mix(vec3(1.6, 1.0, 0.5), vec3(0.8, 0.3, 0.15), aR);
  vAlpha = uAlpha * arc * (aR < 0.02 ? 0.6 : 0.5 * (1.0 - aR));
  gl_PointSize = ps((aR < 0.02 ? 0.06 : 0.09), mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const BEAM_V = /* glsl */ `
varying float vY; varying float vR;
void main(){ vY = uv.y; vR = position.x * position.x + position.z * position.z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_F = /* glsl */ `
uniform float uAlpha; varying float vY;
void main(){ float a = pow(1.0 - vY, 2.2) * smoothstep(0.0, 0.04, vY); gl_FragColor = vec4(vec3(0.55, 0.75, 1.4), a * uAlpha); }`;

export const FIELD_V = /* glsl */ `
attribute float aSize; attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha;
uniform float uDpr;
void main(){ vColor = aColor; vAlpha = 1.0; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uDpr; gl_Position = projectionMatrix * mv; }`;

/* ---------- helpers ---------- */

export const rand = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
export const gauss = () => { let u = 0, v = 0; while (u === 0) u = rand(); v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
export const sphereDir = () => { const z = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), z, r * Math.sin(a)]; };
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Visual radius on the compressed scale. */
export const vis = (R: number) => 0.9 * Math.max(R, 1e-6) ** 0.28;

/** The colour a star is drawn in. True black-body colours are very pale (the Sun is almost white), and on a screen
    every star then looks white, so the 3D view uses the illustrator's ramp: the same order (red → orange → yellow →
    white → blue as T rises), more saturated. Interpolated on log T. The 2D diagrams keep the true colours. */
const RAMP: [number, [number, number, number]][] = [
  [1500, [1.0, 0.18, 0.04]], [2600, [1.0, 0.3, 0.08]], [3500, [1.0, 0.45, 0.16]], [4500, [1.0, 0.64, 0.3]],
  [5800, [1.0, 0.84, 0.5]], [7200, [1.0, 0.95, 0.82]], [9500, [0.82, 0.88, 1.0]], [15000, [0.64, 0.75, 1.0]], [40000, [0.52, 0.64, 1.0]],
];
export function vivid(T: number): [number, number, number] {
  if (!isFinite(T)) return [1, 1, 1];
  const t = Math.log(Math.max(RAMP[0][0], Math.min(RAMP[RAMP.length - 1][0], T)));
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= Math.log(RAMP[i][0])) {
      const a = Math.log(RAMP[i - 1][0]), f = (t - a) / (Math.log(RAMP[i][0]) - a);
      const [c0, c1] = [RAMP[i - 1][1], RAMP[i][1]];
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.12, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.14)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.03)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function points(n: number, attrs: Record<string, [Float32Array, number]>, vertex: string, uniforms: Record<string, { value: unknown }>) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  for (const [k, [arr, size]] of Object.entries(attrs)) geo.setAttribute(k, new THREE.BufferAttribute(arr, size));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4); // positions come from the shader
  const mat = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: SOFT_F, uniforms: { ...uniforms, uMaxPt: MAXPT },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  return p;
}

/* ---------- the scene ---------- */

export class Cosmos {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  #composer: EffectComposer;
  #bloom: UnrealBloomPass;
  #raf = 0;
  #last = 0;
  #time = 0;
  #visible = true;
  #io: IntersectionObserver;
  #ro: ResizeObserver;
  #look: Look | null = null;
  #px = { value: 600 };
  #zoom = 1;
  #dist = 8;
  autoRotate = true;
  quality: 'high' | 'low' = 'high';

  // eased state
  #bright = 1;
  #r = 1;
  #color = new THREE.Color(1, 1, 1);

  #star: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  #glow: THREE.Sprite;
  #halo: THREE.Sprite;
  #flash: THREE.Sprite;
  #cloud: THREE.Points;
  #jets: THREE.Points;
  #shell: THREE.Points;
  #wind: THREE.Points;
  #disc: THREE.Points;
  #lens: THREE.Points;
  #hole: THREE.Mesh;
  #pulsar = new THREE.Group();
  #beams = new THREE.Group();
  #field: THREE.Points;
  #discGroup = new THREE.Group();

  constructor(readonly canvas: HTMLCanvasElement, small = false) {
    this.quality = small ? 'low' : 'high';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene.background = new THREE.Color(0x03040a);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 4000);
    this.camera.position.set(0, 2.2, 8);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.enableZoom = false; // our own zoom (wheel after a click, pinch, buttons) keeps the page scrollable
    this.controls.rotateSpeed = 0.6;

    const tex = glowTexture();
    const uPx = this.#px;
    const time = { value: 0 };
    this.#timeU = time;

    /* background stars and a faint band of the Milky Way */
    {
      const n = small ? 1800 : 3200;
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let [x, y, z] = sphereDir();
        if (i % 3 === 0) { y *= 0.12; const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l; } // the band
        const R = 900 + rand() * 300;
        pos.set([x * R, y * R, z * R], i * 3);
        const [r, g, b] = bbColor(3000 + rand() ** 2 * 20000);
        const br = 0.35 + rand() ** 3 * 0.9;
        col.set([r * br, g * br, b * br], i * 3);
        size[i] = 0.8 + rand() ** 4 * 2.6;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      this.#field = new THREE.Points(geo, new THREE.ShaderMaterial({
        vertexShader: FIELD_V, fragmentShader: SOFT_F, uniforms: { uDpr: { value: this.renderer.getPixelRatio() * 1.6 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      this.scene.add(this.#field);
    }

    /* the star */
    this.#star = new THREE.Mesh(new THREE.SphereGeometry(1, small ? 64 : 112, small ? 48 : 80), new THREE.ShaderMaterial({
      vertexShader: STAR_V, fragmentShader: STAR_F,
      uniforms: { uColor: { value: new THREE.Color() }, uTime: time, uCells: { value: 9 }, uContrast: { value: 0.35 }, uBright: { value: 1.6 }, uDark: { value: 0 }, uBands: { value: 0 } },
    }));
    this.scene.add(this.#star);
    const sprite = (opacity: number) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.scene.add(s);
      return s;
    };
    this.#glow = sprite(0.9);
    this.#halo = sprite(0.35);
    this.#flash = sprite(0);

    /* the collapsing cloud and its disc */
    {
      const n = small ? 6000 : 11000;
      const aCloud = new Float32Array(n * 3), aDisk = new Float32Array(n * 3), aSeed = new Float32Array(n), aColor = new Float32Array(n * 3), aSize = new Float32Array(n);
      const clumps = Array.from({ length: 7 }, (_, k) => k === 0 ? [0, 0, 0, 5] : [gauss() * 9, gauss() * 4, gauss() * 9, 3 + rand() * 4]);
      const palette = [[1.1, 0.28, 0.4], [0.9, 0.35, 0.3], [0.45, 0.32, 0.28], [0.35, 0.5, 1.0], [0.8, 0.45, 0.7]];
      for (let i = 0; i < n; i++) {
        const c = clumps[i % 4 === 0 ? 0 : 1 + Math.floor(rand() * 6)];
        const fil = rand() < 0.3; // filaments: stretched along a direction
        const s = c[3];
        aCloud.set([c[0] + gauss() * s * (fil ? 2.2 : 1), c[1] + gauss() * s * 0.6, c[2] + gauss() * s * (fil ? 0.5 : 1)], i * 3);
        const r = 0.7 + 8.5 * rand() ** 1.6;
        aDisk.set([r, rand() * Math.PI * 2, gauss()], i * 3);
        aSeed[i] = rand();
        const p = palette[Math.floor(rand() * palette.length)], b = 0.5 + rand() * 0.6;
        aColor.set([p[0] * b, p[1] * b, p[2] * b], i * 3);
        aSize[i] = 0.35 + rand() ** 2 * 1.4;
      }
      this.#cloud = points(n, {
        aCloud: [aCloud, 3], aDisk: [aDisk, 3], aSeed: [aSeed, 1], aColor: [aColor, 3], aSize: [aSize, 1],
      }, CLOUD_V, { uTime: time, uCollapse: { value: 0 }, uFall: { value: 0 }, uCore: { value: 0.5 }, uAlpha: { value: 1 }, uPx });
      this.scene.add(this.#cloud);
    }
    /* jets */
    {
      const n = small ? 900 : 1800;
      const aSeed = new Float32Array(n), aOff = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { aSeed[i] = rand(); aOff.set([gauss() * 0.25, gauss() * 0.25, i % 2 ? 1 : -1], i * 3); }
      this.#jets = points(n, { aSeed: [aSeed, 1], aOff: [aOff, 3] }, JET_V, { uTime: time, uAlpha: { value: 0 }, uLen: { value: 9 }, uPx });
      this.scene.add(this.#jets);
    }
    /* expanding shells: planetary nebula and supernova remnant */
    {
      const n = small ? 9000 : 18000;
      const aDir = new Float32Array(n * 3), aR = new Float32Array(n), aSeed = new Float32Array(n), aSize = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let [x, y, z] = sphereDir();
        if (i % 4 === 0) { y *= 0.15; const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l; } // the waist ring
        aDir.set([x, y, z], i * 3);
        aR[i] = 1 - rand() ** 2.2;
        aSeed[i] = rand();
        aSize[i] = 0.25 + rand() ** 3 * 0.9;
      }
      this.#shell = points(n, { aDir: [aDir, 3], aR: [aR, 1], aSeed: [aSeed, 1], aSize: [aSize, 1] }, SHELL_V,
        { uTime: time, uRadius: { value: 1 }, uMode: { value: 0 }, uAlpha: { value: 0 }, uPx });
      this.scene.add(this.#shell);
    }
    /* stellar wind off a giant */
    {
      const n = small ? 1500 : 3000;
      const aDir = new Float32Array(n * 3), aSeed = new Float32Array(n);
      for (let i = 0; i < n; i++) { aDir.set(sphereDir(), i * 3); aSeed[i] = rand(); }
      this.#wind = points(n, { aDir: [aDir, 3], aSeed: [aSeed, 1] }, WIND_V, { uTime: time, uR0: { value: 1 }, uAlpha: { value: 0 }, uPx, uWind: { value: new THREE.Color(1, 0.42, 0.2) } });
      this.scene.add(this.#wind);
    }
    /* black hole: horizon, disc and lensed arcs */
    {
      const n = small ? 9000 : 18000;
      const aR = new Float32Array(n), aA = new Float32Array(n), aH = new Float32Array(n), aSeed = new Float32Array(n);
      for (let i = 0; i < n; i++) { aR[i] = rand(); aA[i] = rand() * Math.PI * 2; aH[i] = gauss(); aSeed[i] = rand(); }
      this.#disc = points(n, { aR: [aR, 1], aA: [aA, 1], aH: [aH, 1], aSeed: [aSeed, 1] }, DISC_V,
        { uTime: time, uIn: { value: 1.2 }, uOut: { value: 7 }, uAlpha: { value: 0 }, uPx });
      const m = small ? 2500 : 5000;
      const bR = new Float32Array(m), bA = new Float32Array(m), bS = new Float32Array(m);
      for (let i = 0; i < m; i++) { bR[i] = i % 5 === 0 ? 0 : 0.02 + rand() ** 1.5 * 0.98; bA[i] = rand() * Math.PI * 2; bS[i] = rand(); }
      this.#lens = points(m, { aR: [bR, 1], aA: [bA, 1], aSeed: [bS, 1] }, LENS_V, { uTime: time, uIn: { value: 1.2 }, uAlpha: { value: 0 }, uPx });
      this.#hole = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      this.#discGroup.add(this.#disc, this.#hole);
      this.#discGroup.rotation.set(0.12, 0, 0.05);
      this.scene.add(this.#discGroup, this.#lens);
    }
    /* pulsar beams: tilted from the spin axis, sweeping round */
    {
      const geo = new THREE.CylinderGeometry(0.5, 0.02, 7, 32, 1, true);
      geo.translate(0, 3.5, 0);
      const mat = new THREE.ShaderMaterial({ vertexShader: BEAM_V, fragmentShader: BEAM_F, uniforms: { uAlpha: { value: 0.22 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      // narrow end at the star, widening outwards; one up, one down
      const up = new THREE.Mesh(geo, mat), down = new THREE.Mesh(geo, mat);
      down.rotation.x = Math.PI;
      this.#beams.add(up, down);
      this.#beams.rotation.z = 0.6; // magnetic axis 35° from the spin axis
      this.#pulsar.add(this.#beams);
      this.scene.add(this.#pulsar);
    }

    /* post-processing: bloom makes hot things glow */
    this.#composer = new EffectComposer(this.renderer);
    this.#composer.addPass(new RenderPass(this.scene, this.camera));
    this.#bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 0.7);
    this.#composer.addPass(this.#bloom);
    this.#composer.addPass(new OutputPass());

    this.#ro = new ResizeObserver(() => this.resize());
    this.#ro.observe(canvas);
    this.#io = new IntersectionObserver(([e]) => { this.#visible = e.isIntersecting; this.#kick(); });
    this.#io.observe(canvas);
    document.addEventListener('visibilitychange', this.#kick);
    canvas.addEventListener('wheel', this.#wheel, { passive: false });
    canvas.addEventListener('pointerdown', this.#arm);
    canvas.addEventListener('pointerleave', this.#disarm);
    canvas.addEventListener('touchstart', this.#pinchStart, { passive: true });
    canvas.addEventListener('touchmove', this.#pinchMove, { passive: true });
    this.controls.addEventListener('start', () => { this.#userAt = performance.now(); });
    this.resize();
    this.#kick();
  }

  #timeU: { value: number };
  #userAt = -1e9;
  #armed = false;
  #pinch = 0;
  #arm = () => { this.#armed = true; };
  #disarm = () => { this.#armed = false; };
  #wheel = (e: WheelEvent) => {
    // the page keeps scrolling until you click the view; after that the wheel zooms
    if (!this.#armed && !e.ctrlKey) return;
    e.preventDefault();
    this.zoomBy(Math.exp(e.deltaY * 0.0012));
  };
  #pinchStart = (e: TouchEvent) => { if (e.touches.length === 2) this.#pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); };
  #pinchMove = (e: TouchEvent) => {
    if (e.touches.length !== 2 || !this.#pinch) return;
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    this.zoomBy(this.#pinch / d);
    this.#pinch = d;
  };
  zoomBy(f: number) { this.#zoom = Math.max(0.35, Math.min(3.5, this.#zoom * f)); this.#kick(); }
  resetView() {
    this.#zoom = 1;
    const d = this.camera.position.length();
    this.camera.position.set(0, 0.28, 1).normalize().multiplyScalar(d);
    this.controls.update();
  }

  #snap = true;
  /** Show a look; snap = jump straight there instead of easing (first load, a new mass). */
  set(look: Look, snap = false) { if (snap) this.#snap = true; this.#look = look; this.#kick(); }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.#composer.setSize(w, h);
    this.#bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // point sizes in world units: pixels per unit at distance 1
    MAXPT.value = 72 * this.renderer.getPixelRatio();
    this.#px.value = (h * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.#kick();
  }

  #kick = () => {
    if (this.#dead) return;
    if (this.#raf || !this.#visible || document.hidden) return;
    this.#last = performance.now();
    this.#raf = requestAnimationFrame(this.#frame);
  };

  #dead = false;
  #frame = (now: number) => {
    this.#raf = 0;
    // never draw into a lost context (the loss event can arrive a frame late) or after dispose
    if (this.#dead || this.renderer.getContext().isContextLost()) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.#last) / 1000));
    this.#last = now;
    this.#time += dt;
    this.#timeU.value = this.#time;
    this.#update(dt);
    this.controls.autoRotate = this.autoRotate && performance.now() - this.#userAt > 4000;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.update(dt);
    this.#composer.render(dt);
    if (this.#visible && !document.hidden) this.#raf = requestAnimationFrame(this.#frame);
  };

  /** Ease everything towards the current look. */
  #update(dt: number) {
    const L = this.#look;
    if (!L) return;
    const snap = this.#snap;
    this.#snap = false;
    const k = snap ? 1 : 1 - Math.exp(-dt * 6);
    const { visual: v, u } = L;
    const cU = this.#cloud.material as THREE.ShaderMaterial, jU = this.#jets.material as THREE.ShaderMaterial;
    const sU = this.#shell.material as THREE.ShaderMaterial, wU = this.#wind.material as THREE.ShaderMaterial;
    const dU = this.#disc.material as THREE.ShaderMaterial, lU = this.#lens.material as THREE.ShaderMaterial;
    const st = this.#star.material.uniforms;

    // targets
    let r = vis(L.R), T = L.T, bright = 1.4, cells = 9, contrast = 0.35, dark = 0;
    let starOn = true, glow = 1, halo = 1;
    let collapse = 0, fall = 0, cloudA = 0, jetA = 0;
    let shellR = 1, shellA = 0, shellMode = 0, pulse = 1, flare = 1, bands = 0;
    let windA = 0, discA = 0, flash = 0, pulsar = false, frame = r * 8;
    const gR = vis(L.giantR || L.R);

    switch (v) {
      case 'cloud':
        starOn = u > 0.85; r = 0.25 * smooth(0.85, 1, u); T = 1800; bright = 0.8 * smooth(0.85, 1, u);
        collapse = 0.35 * u; cloudA = 1; frame = mix(48, 34, u); glow = 0.6 * smooth(0.8, 1, u); halo = 0;
        break;
      case 'protostar': {
        collapse = 0.35 + 0.65 * smooth(0, 0.7, u); fall = smooth(0.15, 0.5, u); cloudA = 1 - 0.35 * smooth(0.6, 1, u);
        jetA = smooth(0.25, 0.45, u) * (1 - smooth(0.85, 1, u)) * 0.9;
        r = Math.max(0.3, vis(L.R) * mix(0.6, 1, u)); T = Math.min(L.T, mix(2200, L.T, smooth(0.3, 1, u)));
        bright = mix(1.0, 1.6, u); cells = 6; contrast = 0.5; frame = mix(32, Math.max(11, r * 8), smooth(0, 0.9, u));
        cU.uniforms.uCore.value = r * 1.05;
        break;
      }
      case 'star':
        cloudA = 0.65 * (1 - smooth(0, 0.08, u)); collapse = 1; fall = 1 - smooth(0, 0.06, u);
        cU.uniforms.uCore.value = r * 1.05;
        frame = Math.max(2.4, r * 8) + 12 * (1 - smooth(0, 0.08, u));
        cells = L.T > 10000 ? 13 : L.T < 4000 ? 7 : 10; contrast = L.T > 10000 ? 0.18 : 0.38; dark = L.T < 6500 ? 0.35 : 0;
        break;
      case 'bluegiant':
        cells = 12; contrast = 0.22; bright = 1.5; windA = 0.55; glow = 1.2; halo = 1.2; frame = Math.max(2.4, r * 8);
        break;
      case 'cepheid': {
        // pulsing: the visual period is a couple of seconds, the real one days
        const ph = this.#time * ((2 * Math.PI) / 2.4);
        pulse = 1 + 0.1 * Math.sin(ph);
        flare = 1 + 0.3 * Math.sin(ph + 1.1);
        cells = 6; contrast = 0.45; bright = 0.95; glow = 0.6; halo = 0.6; frame = Math.max(2.4, r * 7.5);
        break;
      }
      case 'browndwarf':
        cells = 4; contrast = 0.3; bands = 1; bright = mix(0.9, 0.35, u); glow = 0.35; halo = 0.2; frame = Math.max(2.2, r * 8);
        break;
      case 'giant': {
        const cool = smooth(5500, 3500, L.T); // 0 hot → 1 red
        cells = mix(8, 3.2, cool); contrast = mix(0.35, 0.75, cool); bright = mix(1.6, 1.35, cool); dark = 0.25 * cool;
        windA = 0.6 * cool; frame = Math.max(2.4, r * 6.5);
        break;
      }
      case 'nebula': {
        // the envelope lifts off and becomes the shell; the bare core shrinks and heats
        starOn = true; r = mix(gR, vis(0.02), smooth(0, 0.5, u)); T = L.T;
        shellR = mix(gR * 1.05, gR + 9, smooth(0, 1, u)); shellA = smooth(0, 0.25, u) * 0.9; shellMode = 0;
        windA = 0.3 * (1 - smooth(0, 0.3, u)); frame = Math.max(shellR * 2.3, r * 4); cells = 12; contrast = 0.2;
        glow = 1.3; halo = 1.4;
        break;
      }
      case 'whitedwarf': {
        const pnLeft = L.fate === 'sunlike' ? 1 - smooth(0, 0.18, u) : 0;
        shellR = gR + 9 + 6 * smooth(0, 0.18, u); shellA = 0.9 * pnLeft; shellMode = 0;
        frame = mix(Math.max(2.2, r * 8), shellR * 2.3, pnLeft);
        cells = 16; contrast = 0.12; bright = 1.9; glow = 1.5; halo = 1.6;
        break;
      }
      case 'blackdwarf':
        T = 2200; bright = mix(0.45, 0.06, u); cells = 16; contrast = 0.1; glow = 0.4 * (1 - u); halo = 0; frame = Math.max(2.2, r * 8);
        break;
      case 'supernova': {
        const bang = smooth(0.02, 0.1, u);
        starOn = u < 0.07; r = gR * (1 - 0.35 * smooth(0, 0.07, u)); T = mix(3500, 30000, smooth(0.03, 0.07, u));
        flash = Math.exp(-((u - 0.09) ** 2) / 0.004) + bang * 0.25 * (1 - smooth(0.1, 0.4, u));
        shellR = mix(gR, gR + 26, smooth(0.06, 1, u) ** 0.7); shellA = bang * mix(1, 0.75, u); shellMode = 1;
        frame = Math.max(gR * 3.3, shellR * 2.3); glow = 1 - bang; halo = 1 - bang;
        break;
      }
      case 'neutron': {
        r = 0.16; T = 40000; bright = 2.6; cells = 20; contrast = 0.15; pulsar = true; glow = 1.2; halo = 0.6;
        const left = 1 - smooth(0, 0.35, u);
        shellR = gR + 26 + 10 * smooth(0, 0.35, u); shellA = 0.55 * left; shellMode = 1;
        frame = mix(5.5, shellR * 2.3, left);
        break;
      }
      case 'blackhole': {
        starOn = false; glow = 0; halo = 0; discA = 1; r = 1.0;
        const left = 1 - smooth(0, 0.3, u);
        shellR = gR + 26 + 10 * smooth(0, 0.3, u); shellA = 0.5 * left; shellMode = 1;
        frame = mix(17, shellR * 2.3, left);
        break;
      }
    }

    // ease
    const glide = (v: number, to: number) => (!isFinite(to) ? v : isFinite(v) ? v + (to - v) * k : to);
    this.#r = glide(this.#r, r);
    const [cr, cg, cb] = vivid(isFinite(T) ? T : 6000);
    this.#color.lerp(new THREE.Color(cr, cg, cb), k);
    if (!isFinite(this.#color.r + this.#color.g + this.#color.b)) this.#color.setRGB(cr, cg, cb);
    this.#star.visible = starOn && this.#r > 0.01;
    this.#star.scale.setScalar(this.#r * pulse);
    st.uColor.value.copy(this.#color);
    this.#bright = glide(this.#bright, bright * 0.62);
    st.uBright.value = this.#bright * flare;
    st.uBands.value = glide(st.uBands.value, bands);
    st.uCells.value = glide(st.uCells.value, cells);
    st.uContrast.value = glide(st.uContrast.value, contrast);
    st.uDark.value = glide(st.uDark.value, dark);
    this.#star.rotation.y += dt * 0.05;

    const gm = this.#glow.material as THREE.SpriteMaterial, hm = this.#halo.material as THREE.SpriteMaterial, fm = this.#flash.material as THREE.SpriteMaterial;
    gm.color.copy(this.#color); hm.color.copy(this.#color);
    gm.opacity += ((starOn ? glow * 0.4 : 0) - gm.opacity) * k;
    gm.opacity = Math.min(1, gm.opacity);
    hm.opacity += ((starOn ? halo * 0.12 : 0) - hm.opacity) * k;
    this.#glow.scale.setScalar(this.#r * pulse * 2.6 + 0.08);
    this.#halo.scale.setScalar(this.#r * 4.5 + 0.3);
    fm.color.setRGB(0.85, 0.9, 1);
    fm.opacity = flash;
    this.#flash.scale.setScalar(gR * 10 + 30 * flash);
    this.#flash.visible = flash > 0.002;

    // ease towards a target; a value that has gone non-finite (it never should) jumps straight back to the target
    const ease = (m: THREE.ShaderMaterial, key: string, to: number) => {
      if (!isFinite(to)) return;
      const v = m.uniforms[key].value as number;
      m.uniforms[key].value = isFinite(v) ? v + (to - v) * k : to;
    };
    ease(cU, 'uCollapse', collapse); ease(cU, 'uFall', fall); ease(cU, 'uAlpha', cloudA);
    this.#cloud.visible = (cU.uniforms.uAlpha.value as number) > 0.01;
    ease(jU, 'uAlpha', jetA); jU.uniforms.uLen.value = 6 + 6 * collapse;
    this.#jets.visible = (jU.uniforms.uAlpha.value as number) > 0.01;
    // shells jump when the stage changes direction (a new explosion is a new shell), otherwise ease
    if (sU.uniforms.uMode.value !== shellMode) { sU.uniforms.uMode.value = shellMode; sU.uniforms.uRadius.value = shellR; }
    ease(sU, 'uRadius', shellR); ease(sU, 'uAlpha', shellA);
    this.#shell.visible = (sU.uniforms.uAlpha.value as number) > 0.01;
    ease(wU, 'uAlpha', windA); wU.uniforms.uR0.value = this.#r * pulse;
    (wU.uniforms.uWind.value as THREE.Color).copy(this.#color);
    this.#wind.visible = (wU.uniforms.uAlpha.value as number) > 0.01;
    ease(dU, 'uAlpha', discA); lU.uniforms.uAlpha.value = dU.uniforms.uAlpha.value;
    this.#discGroup.visible = this.#lens.visible = (dU.uniforms.uAlpha.value as number) > 0.01;
    this.#hole.scale.setScalar(0.95);
    dU.uniforms.uIn.value = 1.25; dU.uniforms.uOut.value = 7.5; lU.uniforms.uIn.value = 1.25;

    this.#pulsar.visible = pulsar;
    if (pulsar) this.#pulsar.rotation.y += dt * 3.2;

    // camera: keep the user's direction, glide the distance to frame the scene
    if (!isFinite(frame)) frame = 8;
    const want = frame * this.#zoom * (this.camera.aspect < 1 ? 1.35 / Math.max(0.55, this.camera.aspect) : 1);
    this.#dist += (want - this.#dist) * (snap ? 1 : 1 - Math.exp(-dt * 2.5));
    const dir = this.camera.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 1e-9) dir.set(0, 0.28, 1);
    if (!isFinite(this.#dist)) this.#dist = want;
    if (!isFinite(dir.x + dir.y + dir.z)) { dir.set(0, 0.28, 1); this.controls.target.set(0, 0, 0); }
    this.camera.position.copy(this.controls.target).add(dir.normalize().multiplyScalar(this.#dist));
    this.#bloom.strength = this.quality === "low" ? 0.55 : 0.7;
  }

  dispose() {
    this.#dead = true;
    cancelAnimationFrame(this.#raf);
    this.#io.disconnect();
    this.#ro.disconnect();
    document.removeEventListener('visibilitychange', this.#kick);
    this.canvas.removeEventListener('wheel', this.#wheel);
    this.canvas.removeEventListener('pointerdown', this.#arm);
    this.canvas.removeEventListener('pointerleave', this.#disarm);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
    });
    this.#composer.dispose();
    this.renderer.dispose();
  }
}
