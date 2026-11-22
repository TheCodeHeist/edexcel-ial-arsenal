/* Waves Lab: data-sheet constants and the number formatters, shared by every tab. Formatters come from Particle Lab
   so the two labs print numbers the same way (3 s.f., powers of ten written out). */
export { sci, plain, short, parseNum } from '../particles/data';

export const C = 3.0e8;          // speed of light / m s⁻¹
export const H = 6.63e-34;       // Planck constant / J s
export const E = 1.6e-19;        // elementary charge / C
export const ME = 9.11e-31;      // electron mass / kg
export const EV = 1.6e-19;       // 1 eV / J
export const G = 9.81;           // g / N kg⁻¹ (masses on strings)

/** Wavelength (m) → a CSS colour for visible light; outside 380–750 nm a dim grey-violet or grey-red. */
export function lambdaRGB(nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 750) { r = 1; }
  let f = 1;
  if (nm < 380) return [0.35, 0.2, 0.55];
  if (nm > 750) return [0.5, 0.12, 0.12];
  if (nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40; else if (nm > 700) f = 0.3 + (0.7 * (750 - nm)) / 50;
  return [r * f, g * f, b * f];
}
export const lambdaCss = (nm: number) => { const [r, g, b] = lambdaRGB(nm); return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`; };
