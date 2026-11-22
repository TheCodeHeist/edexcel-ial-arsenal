/* Kinetics Lab: data-booklet constants and the number formatters, shared by every tab. The formatters come from
   Particle Lab so every lab prints numbers the same way (3 s.f., powers of ten written out). */
export { sci, plain, short, parseNum } from '../particles/data';

export const R = 8.31;            // gas constant / J mol⁻¹ K⁻¹ (data booklet)
export const NA = 6.02e23;        // Avogadro constant / mol⁻¹
export const ATM = 101325;        // 1 atm / Pa
export const K0 = 273;            // 0 °C in K (as the spec's calculations use)

/** °C → K */
export const kelvin = (c: number) => c + K0;
