/* Fields Lab: Magnetic fields, Fleming's Left-Hand Rule & F = BIL sin θ (WPH14). */

export type MagMode = 'motor' | 'wire' | 'solenoid';

export function motorForce(B: number, I: number, L: number, deg: number): number {
  return B * I * L * Math.sin((deg * Math.PI) / 180);
}

export const MAG_FACTS: Record<MagMode, string[]> = {
  motor: [
    'F = BIL sin θ, where θ is the angle between the current direction and the magnetic field lines.',
    'Maximum force (F = BIL) occurs when the wire is perpendicular to the field (θ = 90°); F = 0 when parallel (θ = 0°).',
    'Fleming’s Left-Hand Rule: First finger = Field (N → S), seCond finger = Conventional current (+ → −), thuMb = Motion / Force.',
    '1 Tesla (T) is the flux density that produces a force of 1 N on a 1 m wire carrying 1 A perpendicular to the field.',
  ],
  wire: [
    'Right-hand grip rule: thumb along conventional current I → curled fingers show circular magnetic field lines.',
    'Field lines are concentric circles centred on the wire, becoming more widely spaced (weaker B) further from the wire.',
    'Reversing the current reverses the direction of the circular magnetic field.',
  ],
  solenoid: [
    'Inside a long solenoid, the magnetic field is strong and UNIFORM (parallel, equally spaced lines).',
    'Outside, the field shape is identical to a bar magnet (N pole where field lines emerge).',
    'Increasing current I, number of turns per unit length n, or adding a soft iron core strengthens B.',
  ],
};
