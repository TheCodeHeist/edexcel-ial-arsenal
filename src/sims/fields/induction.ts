/* Fields Lab: Electromagnetic induction — Faraday's law, Lenz's law & AC generator (WPH14). */

export type IndMode = 'magnet' | 'generator';

/** For a rotating AC generator coil: flux linkage NΦ(θ) = BAN cos(θ) and emf ε(θ) = BANω sin(θ). */
export function genState(B: number, A: number, N: number, freq: number, phase: number) {
  const omega = 2 * Math.PI * freq;
  const theta = phase;
  const fluxLink = B * A * N * Math.cos(theta);
  const emf = B * A * N * omega * Math.sin(theta);
  const peakEmf = B * A * N * omega;
  return { theta, fluxLink, emf, peakEmf };
}

/** For a bar magnet oscillating sinusoidally through a coil: x(θ) = x0 cos(θ). */
export function magnetState(N: number, freq: number, phase: number) {
  const omega = 2 * Math.PI * freq;
  const x = Math.cos(phase); // -1 .. +1 (0 = magnet centred inside coil)
  // Gaussian flux peak when magnet is inside coil (x = 0)
  const flux = Math.exp(-3.2 * x * x);
  const dxdt = -omega * Math.sin(phase);
  const dFluxDt = flux * (-6.4 * x) * dxdt;
  const emf = -N * 0.0025 * dFluxDt; // scaled to readable V
  return { x, fluxLink: N * 0.0025 * flux, emf };
}

export const IND_FACTS: Record<IndMode, string[]> = {
  magnet: [
    'Faraday’s law: the magnitude of the induced e.m.f. is directly proportional to the rate of change of magnetic flux linkage (ε = −d(NΦ)/dt).',
    'Lenz’s law: the direction of the induced e.m.f. (and current) opposes the change in magnetic flux that produces it — required by conservation of energy.',
    'Pushing a North pole into a coil induces a North pole at the near end to repel it; pulling it out induces a South pole to attract it back.',
    'If the magnet stops moving inside the coil, flux is maximum but dΦ/dt = 0 → induced e.m.f. is ZERO!',
  ],
  generator: [
    'Magnetic flux linkage NΦ = BAN cos θ, where θ is the angle between the magnetic field and the normal to the coil.',
    'Induced e.m.f. ε = BANω sin(ωt) is 90° out of phase with flux linkage!',
    'Peak e.m.f. ε₀ = BANω occurs when the coil plane is PARALLEL to B (θ = 90°): flux is zero, but the sides cut field lines fastest.',
    'Doubling frequency f doubles BOTH the frequency AND the peak e.m.f. (since ω = 2πf).',
  ],
};
