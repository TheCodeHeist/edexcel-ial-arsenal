/* Waves Lab · the two-beam oscilloscope of Core Practical 4, as SVG path strings (the panel draws them as SVG, the
   3D scope's screen draws the same strings onto a canvas with Path2D, so the two always match).
   Beam 1 is the signal generator's output, which also drives the loudspeaker; beam 2 is the microphone. The scope is
   triggered on beam 1, so beam 1 always starts at zero going up; beam 2 lags by the time the sound takes to reach the
   microphone, a phase of 360° × d/λ. Both beams share the centre line so the phase is easy to compare. */

export interface ScopeSet { tb: number; v1: number; v2: number }   // s/div, V/div for each beam
export const DIV_X = 10, DIV_Y = 8;
export const V_SIG = 2.0;                                           // signal generator amplitude / V
/** Microphone amplitude / V: weaker further away. */
export const micAmp = (d: number) => 0.9 / (1 + 3.5 * d);

export function scopePaths(w: number, h: number, f: number, v: number, d: number, s: ScopeSet) {
  const lam = v / f, lag = (2 * Math.PI * d) / lam;
  const n = 360, T = s.tb * DIV_X, a2 = micAmp(d);
  const ys = (V: number, vd: number) => Math.max(1, Math.min(h - 1, h / 2 - (V / vd) * (h / DIV_Y)));
  let p1 = '', p2 = '';
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * T, x = ((i / n) * w).toFixed(1);
    const w0 = 2 * Math.PI * f * t;
    p1 += `${i ? 'L' : 'M'}${x} ${ys(V_SIG * Math.sin(w0), s.v1).toFixed(1)}`;
    p2 += `${i ? 'L' : 'M'}${x} ${ys(a2 * Math.sin(w0 - lag), s.v2).toFixed(1)}`;
  }
  return { p1, p2, a2, lagDeg: ((lag * 180) / Math.PI) % 360 };
}

/** Draw a scope screen (graticule and both beams) onto a 2D canvas: used by the 3D view. */
export function scopeDraw(g: CanvasRenderingContext2D, w: number, h: number, f: number, v: number, d: number, s: ScopeSet, glow = false) {
  g.fillStyle = '#06140f'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120,255,190,0.18)'; g.lineWidth = 1;
  for (let i = 0; i <= DIV_X; i++) { const x = (i / DIV_X) * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let j = 0; j <= DIV_Y; j++) { const y = (j / DIV_Y) * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.strokeStyle = 'rgba(120,255,190,0.35)';
  g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  const { p1, p2 } = scopePaths(w, h, f, v, d, s);
  g.lineWidth = 3.5;
  if (glow) { g.shadowBlur = 10; }
  g.strokeStyle = '#ffd24a'; g.shadowColor = '#ffd24a'; g.stroke(new Path2D(p1));
  g.strokeStyle = '#56c7ff'; g.shadowColor = '#56c7ff'; g.stroke(new Path2D(p2));
  g.shadowBlur = 0;
}
