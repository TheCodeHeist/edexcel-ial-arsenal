/* Energetics Lab: Hess's Law cycles (formation, combustion, and Core Practical 2 indirect carbonate/hydrate cycles; Spec 6.8–6.9). */

export type HessKind = 'formation' | 'combustion' | 'cp2';

export interface HessCycle {
  id: string;
  kind: HessKind;
  name: string;
  reactants: string;
  products: string;
  bottom: string;
  arrowDir: 'up' | 'down'; // up = formation (from elements); down = combustion or reaction with HCl/water
  arrowReagent?: string;   // e.g. '+ 2HCl(aq)' or '+ O₂(g)' shown beside cycle arrows
  dh1Label: string;
  dh1: number;             // left leg (kJ mol⁻¹)
  dh2Label: string;
  dh2: number;             // right leg (kJ mol⁻¹)
  formulaText: string;
  note: string;
  facts: string[];
}

export const HESS_CYCLES: HessCycle[] = [
  {
    id: 'form_caco3', kind: 'formation', name: 'Decomposition of CaCO₃ (via ΔfH)',
    reactants: 'CaCO3(s)',
    products: 'CaO(s) + CO2(g)',
    bottom: 'Ca(s) + C(s) + 1.5 O2(g)',
    arrowDir: 'up',
    dh1Label: 'ΔfH(CaCO₃)', dh1: -1207,
    dh2Label: 'ΔfH(CaO) + ΔfH(CO₂)', dh2: -635 + -394,
    formulaText: 'ΔrH = −ΔH₁ + ΔH₂ = ΣΔfH(products) − ΣΔfH(reactants)',
    note: 'Formation arrows point UP from elements in their standard states. Going from reactants → elements reverses the left arrow (−ΔH₁).',
    facts: [
      'Hess’s law: the total enthalpy change for a reaction is independent of the route taken.',
      'ΔfH⊖ of any element in its standard state (e.g. O₂(g), C(graphite)) is 0 kJ mol⁻¹.',
      'With formation data, arrows point UP from elements → ΔrH = ΣΔfH(products) − ΣΔfH(reactants).',
    ],
  },
  {
    id: 'comb_etoh', kind: 'combustion', name: 'Formation of ethanol (via ΔcH)',
    reactants: '2C(s) + 3H2(g) + 0.5 O2(g)',
    products: 'C2H5OH(l)',
    bottom: '2CO2(g) + 3H2O(l)',
    arrowDir: 'down',
    arrowReagent: '+ 3O₂(g)',
    dh1Label: '2ΔcH(C) + 3ΔcH(H₂)', dh1: 2 * -394 + 3 * -286,
    dh2Label: 'ΔcH(C₂H₅OH)', dh2: -1367,
    formulaText: 'ΔrH = ΔH₁ − ΔH₂ = ΣΔcH(reactants) − ΣΔcH(products)',
    note: 'Combustion arrows point DOWN to CO₂ and H₂O (adding excess O₂(g)). Going from CO₂ + H₂O back up to products reverses the right arrow (−ΔH₂).',
    facts: [
      'You cannot measure ΔfH(C₂H₅OH) directly because carbon, hydrogen and oxygen do not react cleanly to form ethanol alone.',
      'With combustion data, arrows point DOWN to oxides → ΔrH = ΣΔcH(reactants) − ΣΔcH(products).',
      'Watch the stoichiometric coefficients: multiply ΔcH(C) by 2 and ΔcH(H₂) by 3.',
    ],
  },
  {
    id: 'cp5_khco3', kind: 'cp2', name: 'CP 2: Thermal decomposition of KHCO₃',
    reactants: '2KHCO3(s)',
    products: 'K2CO3(s) + H2O(l) + CO2(g)',
    bottom: '2KCl(aq) + 2H2O(l) + 2CO2(g)',
    arrowDir: 'down',
    arrowReagent: '+ 2HCl(aq)',
    dh1Label: '2 × ΔH(KHCO₃ + HCl)', dh1: 2 * 28.5,
    dh2Label: 'ΔH(K₂CO₃ + 2HCl)', dh2: -34.0,
    formulaText: 'ΔrH = ΔH₁ − ΔH₂ = 2ΔH(KHCO₃) − ΔH(K₂CO₃)',
    note: 'Core Practical 2: you cannot measure the enthalpy of thermal decomposition directly in a cup, so react both solids separately with excess 2HCl(aq).',
    facts: [
      'Both routes reach the exact same final solution: 2KCl(aq) + 2H₂O(l) + 2CO₂(g).',
      'Remember the factor of 2 in 2KHCO₃(s) when calculating ΔH₁.',
      'ΔrH = (+57.0) − (−34.0) = +91.0 kJ mol⁻¹ (endothermic decomposition).',
    ],
  },
  {
    id: 'cp5_cuso4', kind: 'cp2', name: 'Hydration of anhydrous CuSO₄',
    reactants: 'CuSO4(s) + 5H2O(l)',
    products: 'CuSO4·5H2O(s)',
    bottom: 'CuSO4(aq)',
    arrowDir: 'down',
    arrowReagent: '+ aq',
    dh1Label: 'ΔHsol(CuSO₄)', dh1: -66.5,
    dh2Label: 'ΔHsol(CuSO₄·5H₂O)', dh2: 11.7,
    formulaText: 'ΔrH = ΔH₁ − ΔH₂',
    note: 'Dissolve anhydrous CuSO₄(s) (exothermic) and hydrated CuSO₄·5H₂O(s) (endothermic) separately in excess water (+ aq) to form the same CuSO₄(aq).',
    facts: [
      'Direct hydration cannot be measured accurately because solid hydrated salt forms a crust that traps unreacted solid.',
      'ΔrH = (−66.5) − (+11.7) = −78.2 kJ mol⁻¹.',
    ],
  },
];

export function calcHess(arrowDir: 'up' | 'down', dh1: number, dh2: number): number {
  return arrowDir === 'up' ? -dh1 + dh2 : dh1 - dh2;
}
