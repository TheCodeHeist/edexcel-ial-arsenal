/* Projectile motion. Without air resistance every flight is worked out exactly (the SUVAT equations); with it,
   a = g − k|v|v is stepped with RK4. A Flight is a list of samples from launch to the moment it lands (or hits
   something), plus the numbers an exam asks for.

   Coordinates: x along the ground from the launch point, y up from the ground. The launch point is (0, h). */

export interface Launch {
  u: number;      // launch speed / m s⁻¹
  deg: number;    // angle above the horizontal / degrees (negative = thrown downwards)
  h: number;      // launch height above the ground / m
  g: number;      // gravitational field strength / N kg⁻¹
  k: number;      // air resistance: a = −k|v|v, k per metre (0 = none)
}

export interface Pt { t: number; x: number; y: number; vx: number; vy: number }

export interface Flight {
  L: Launch;
  pts: Pt[];      // samples, first at t = 0, last exactly at landing
  T: number;      // time of flight / s
  R: number;      // horizontal distance travelled / m
  H: number;      // greatest height above the ground / m
  tTop: number;   // time of the greatest height / s
  end: Pt;        // the landing sample
  stop?: string;  // what stopped it, when not the ground (the Target walls and platforms)
}

export const G = 9.81;
export const rad = (d: number) => (d * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;
export const speed = (p: Pt) => Math.hypot(p.vx, p.vy);
/** Direction of motion below the horizontal, in degrees (negative while still rising). */
export const dip = (p: Pt) => deg(Math.atan2(-p.vy, p.vx));

/** The exact state at time t with no air resistance. */
export function exact(L: Launch, t: number): Pt {
  const c = Math.cos(rad(L.deg)), s = Math.sin(rad(L.deg));
  return { t, x: L.u * c * t, y: L.h + L.u * s * t - 0.5 * L.g * t * t, vx: L.u * c, vy: L.u * s - L.g * t };
}

/** Time to land with no air resistance (the larger root of h + u s t − ½ g t² = 0). */
export function landTime(L: Launch): number {
  const v = L.u * Math.sin(rad(L.deg));
  const d = v * v + 2 * L.g * L.h;
  return d <= 0 ? 0 : Math.max(0, (v + Math.sqrt(d)) / L.g);
}

const N = 240;

export function fly(L: Launch): Flight {
  return L.k > 0 ? withDrag(L) : noDrag(L);
}

function noDrag(L: Launch): Flight {
  const T = landTime(L);
  const pts = Array.from({ length: N + 1 }, (_, i) => exact(L, (T * i) / N));
  pts[N] = { ...pts[N], y: 0 };
  const vy0 = L.u * Math.sin(rad(L.deg));
  const tTop = vy0 > 0 ? vy0 / L.g : 0;
  return { L, pts, T, R: pts[N].x, H: L.h + (vy0 > 0 ? (vy0 * vy0) / (2 * L.g) : 0), tTop, end: pts[N] };
}

function withDrag(L: Launch): Flight {
  const deriv = (s: number[]) => {
    const v = Math.hypot(s[2], s[3]);
    return [s[2], s[3], -L.k * v * s[2], -L.g - L.k * v * s[3]];
  };
  const dt = 1 / 400;
  let s = [0, L.h, L.u * Math.cos(rad(L.deg)), L.u * Math.sin(rad(L.deg))], t = 0;
  const all: Pt[] = [{ t: 0, x: s[0], y: s[1], vx: s[2], vy: s[3] }];
  while (t < 600) {
    const k1 = deriv(s), k2 = deriv(s.map((v, i) => v + (dt / 2) * k1[i])), k3 = deriv(s.map((v, i) => v + (dt / 2) * k2[i])), k4 = deriv(s.map((v, i) => v + dt * k3[i]));
    const n = s.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    if (n[1] <= 0 && (t > 0 || L.h <= 0)) {
      // land between the two steps (linear in y is plenty at this step size)
      const f = s[1] / (s[1] - n[1] || 1);
      all.push({ t: t + f * dt, x: s[0] + f * (n[0] - s[0]), y: 0, vx: s[2] + f * (n[2] - s[2]), vy: s[3] + f * (n[3] - s[3]) });
      break;
    }
    s = n; t += dt;
    all.push({ t, x: s[0], y: s[1], vx: s[2], vy: s[3] });
  }
  const end = all[all.length - 1];
  // keep about N samples for drawing, always including the last
  const step = Math.max(1, Math.floor(all.length / N));
  const pts = all.filter((_, i) => i % step === 0);
  if (pts[pts.length - 1] !== end) pts.push(end);
  let top = all[0];
  for (const p of all) if (p.y > top.y) top = p;
  return { L, pts, T: end.t, R: end.x, H: top.y, tTop: top.t, end };
}

/** The state at time t (clamped to the flight): exact without drag, interpolated with it. */
export function at(f: Flight, t: number): Pt {
  t = Math.max(0, Math.min(f.T, t));
  if (f.L.k === 0) return t >= f.T ? f.end : exact(f.L, t);
  const p = f.pts;
  let lo = 0, hi = p.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m].t <= t) lo = m; else hi = m; }
  const a = p[lo], b = p[hi], w = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  return { t, x: a.x + w * (b.x - a.x), y: a.y + w * (b.y - a.y), vx: a.vx + w * (b.vx - a.vx), vy: a.vy + w * (b.vy - a.vy) };
}

/** The flight cut short at time T (it hit something). */
export function cut(f: Flight, T: number, stop: string): Flight {
  const end = at(f, T);
  const pts = [...f.pts.filter((p) => p.t < T), end];
  let top = pts[0];
  for (const p of pts) if (p.y > top.y) top = p;
  return { ...f, pts, T, R: end.x, H: f.tTop <= T ? f.H : top.y, tTop: f.tTop <= T ? f.tTop : top.t, end, stop };
}

/** The first time the flight is at horizontal position x (null if it never gets there). */
export function timeAtX(f: Flight, x: number): number | null {
  if (f.end.x < x) return null;
  if (f.L.k === 0) { const vx = f.L.u * Math.cos(rad(f.L.deg)); return vx > 0 ? x / vx : null; }
  const p = f.pts;
  for (let i = 1; i < p.length; i++) if (p[i].x >= x) { const a = p[i - 1], b = p[i]; return a.t + ((x - a.x) / (b.x - a.x || 1)) * (b.t - a.t); }
  return null;
}

/** The time it comes down through height y (null if it never does). */
export function timeDownAt(f: Flight, y: number): number | null {
  if (f.L.k === 0) {
    const L = f.L, v = L.u * Math.sin(rad(L.deg)), d = v * v + 2 * L.g * (L.h - y);
    if (d < 0) return null;
    const t = (v + Math.sqrt(d)) / L.g;
    return t >= 0 && t <= f.T + 1e-9 ? t : null;
  }
  const p = f.pts;
  for (let i = 1; i < p.length; i++) if (p[i].vy < 0 && p[i - 1].y >= y && p[i].y <= y) { const a = p[i - 1], b = p[i]; return a.t + ((a.y - y) / (a.y - b.y || 1)) * (b.t - a.t); }
  return null;
}

/** A tidy step for grid lines and strobe intervals: 1, 2 or 5 × 10ⁿ, about span / n. */
export function niceStep(span: number, n: number): number {
  const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
  return ([1, 2, 5, 10].find((k) => k * p >= raw) ?? 10) * p;
}
