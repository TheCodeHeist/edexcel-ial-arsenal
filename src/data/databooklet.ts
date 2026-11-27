/* Pearson Edexcel IAL Physics & Chemistry Formula and Data Booklet quick-reference data. */

export interface ConstantItem {
  name: string;
  sym: string;
  val: string;
  unit: string;
  sub: 'phys' | 'chem' | 'both';
}

/** LaTeX source, written with String.raw so backslashes stay literal. */
const t = String.raw;

export interface EqnGroup {
  unit: string;
  title: string;
  /** eq: plain text for search and the pre-KaTeX fallback; tex: KaTeX pieces that wrap independently. */
  items: { label: string; eq: string; tex: string[]; note?: string }[];
}

export interface ChemDataRow {
  group: string;
  key: string;
  val: string;
  /** KaTeX pieces for rows that are equations. */
  tex?: string[];
  note?: string;
}

export interface ElementItem {
  z: number;
  sym: string;
  name: string;
  ar: string;
  cat: 'nonmetal' | 'alkali' | 'alkaline' | 'tm' | 'halogen' | 'noble' | 'other';
}

export const CONSTANTS: ConstantItem[] = [
  { name: 'Acceleration of free fall', sym: 'g', val: '9.81', unit: 'm s⁻²', sub: 'phys' },
  { name: 'Speed of light in vacuum', sym: 'c', val: '3.00 × 10⁸', unit: 'm s⁻¹', sub: 'both' },
  { name: 'Planck constant', sym: 'h', val: '6.63 × 10⁻³⁴', unit: 'J s', sub: 'both' },
  { name: 'Elementary charge', sym: 'e', val: '1.60 × 10⁻¹⁹', unit: 'C', sub: 'both' },
  { name: 'Electron mass', sym: 'mₑ', val: '9.11 × 10⁻³¹', unit: 'kg', sub: 'phys' },
  { name: 'Proton mass', sym: 'mₚ', val: '1.673 × 10⁻²⁷', unit: 'kg', sub: 'phys' },
  { name: 'Neutron mass', sym: 'mₙ', val: '1.675 × 10⁻²⁷', unit: 'kg', sub: 'phys' },
  { name: 'Unified atomic mass unit', sym: 'u', val: '1.66 × 10⁻²⁷', unit: 'kg (931.5 MeV/c²)', sub: 'phys' },
  { name: 'Electronvolt', sym: '1 eV', val: '1.60 × 10⁻¹⁹', unit: 'J', sub: 'phys' },
  { name: 'Gravitational constant', sym: 'G', val: '6.67 × 10⁻¹¹', unit: 'N m² kg⁻²', sub: 'phys' },
  { name: 'Permittivity of free space', sym: 'ε₀', val: '8.85 × 10⁻¹²', unit: 'F m⁻¹', sub: 'phys' },
  { name: 'Coulomb constant', sym: '1/(4πε₀)', val: '8.99 × 10⁹', unit: 'N m² C⁻²', sub: 'phys' },
  { name: 'Avogadro constant', sym: 'Nₐ', val: '6.02 × 10²³', unit: 'mol⁻¹', sub: 'both' },
  { name: 'Molar gas constant', sym: 'R', val: '8.31', unit: 'J mol⁻¹ K⁻¹', sub: 'both' },
  { name: 'Boltzmann constant', sym: 'k', val: '1.38 × 10⁻²³', unit: 'J K⁻¹', sub: 'phys' },
  { name: 'Stefan–Boltzmann constant', sym: 'σ', val: '5.67 × 10⁻⁸', unit: 'W m⁻² K⁻⁴', sub: 'phys' },
  { name: 'Wien constant', sym: 'λₘₐₓT', val: '2.898 × 10⁻³', unit: 'm K', sub: 'phys' },
  { name: 'Molar gas volume (r.t.p.)', sym: 'Vₘ', val: '24.0', unit: 'dm³ mol⁻¹', sub: 'chem' },
  { name: 'Faraday constant', sym: 'F', val: '96 500', unit: 'C mol⁻¹', sub: 'chem' },
  { name: 'Ionic product of water (298 K)', sym: 'Kw', val: '1.00 × 10⁻¹⁴', unit: 'mol² dm⁻⁶', sub: 'chem' },
  { name: 'Specific heat capacity of water', sym: 'c', val: '4.18', unit: 'J g⁻¹ K⁻¹', sub: 'chem' },
];

export const PHYS_EQNS: EqnGroup[] = [
  {
    unit: 'WPH11',
    title: 'Mechanics & Materials',
    items: [
      { label: 'SUVAT', eq: 'v = u + at  ·  s = ut + ½at²  ·  v² = u² + 2as', tex: [t`v = u + at`, t`s = ut + \tfrac12 at^2`, t`v^2 = u^2 + 2as`] },
      { label: 'Momentum & Force', eq: 'p = mv  ·  F = Δp / Δt', tex: [t`p = mv`, t`F = \frac{\Delta p}{\Delta t}`] },
      { label: 'Work, Power, Efficiency', eq: 'ΔW = FΔs cos θ  ·  P = ΔE / Δt = Fv', tex: [t`\Delta W = F\Delta s\cos\theta`, t`P = \frac{\Delta E}{\Delta t} = Fv`] },
      { label: 'Energy', eq: 'Eₖ = ½mv² = p² / 2m  ·  ΔE_grav = mgΔh', tex: [t`E_k = \tfrac12 mv^2 = \frac{p^2}{2m}`, t`\Delta E_{grav} = mg\Delta h`] },
      { label: 'Hooke & Young modulus', eq: 'F = kΔx  ·  Eₑₗ = ½FΔx  ·  E = σ / ε = FL / (AΔx)', tex: [t`F = k\Delta x`, t`E_{el} = \tfrac12 F\Delta x`, t`E = \frac{\sigma}{\varepsilon} = \frac{FL}{A\Delta x}`] },
      { label: 'Stokes’ law & Upthrust', eq: 'F = 6πηrv  ·  U = ρVg', tex: [t`F = 6\pi\eta rv`, t`U = \rho Vg`] },
    ],
  },
  {
    unit: 'WPH12',
    title: 'Waves & Electricity',
    items: [
      { label: 'Wave speed & string', eq: 'v = fλ  ·  v = √(T / μ)', tex: [t`v = f\lambda`, t`v = \sqrt{\frac{T}{\mu}}`] },
      { label: 'Refraction & TIR', eq: 'n₁ sin θ₁ = n₂ sin θ₂  ·  sin C = 1 / n', tex: [t`n_1\sin\theta_1 = n_2\sin\theta_2`, t`\sin C = \frac1n`] },
      { label: 'Diffraction grating', eq: 'nλ = d sin θ', tex: [t`n\lambda = d\sin\theta`] },
      { label: 'Photon & Photoelectric', eq: 'E = hf = hc/λ  ·  hf = φ + ½mv²ₘₐₓ', tex: [t`E = hf = \frac{hc}{\lambda}`, t`hf = \phi + \tfrac12 mv_{max}^2`] },
      { label: 'de Broglie wavelength', eq: 'λ = h / p = h / mv', tex: [t`\lambda = \frac{h}{p} = \frac{h}{mv}`] },
      { label: 'Current, Drift & Power', eq: 'I = ΔQ/Δt = nqvA  ·  P = VI = I²R = V²/R', tex: [t`I = \frac{\Delta Q}{\Delta t} = nqvA`, t`P = VI = I^2R = \frac{V^2}{R}`] },
      { label: 'Resistivity & EMF', eq: 'R = ρl / A  ·  ε = V + Ir', tex: [t`R = \frac{\rho l}{A}`, t`\varepsilon = V + Ir`] },
    ],
  },
  {
    unit: 'WPH14',
    title: 'Further Mechanics, Fields & Particles',
    items: [
      { label: 'Circular motion', eq: 'v = ωr  ·  a = v²/r = rω²  ·  F = mv²/r', tex: [t`v = \omega r`, t`a = \frac{v^2}{r} = r\omega^2`, t`F = \frac{mv^2}{r}`] },
      { label: 'Electric field & Coulomb', eq: 'E = F/Q = V/d  ·  F = Q₁Q₂ / (4πε₀r²)', tex: [t`E = \frac{F}{Q} = \frac{V}{d}`, t`F = \frac{Q_1Q_2}{4\pi\varepsilon_0 r^2}`] },
      { label: 'Capacitors', eq: 'C = Q/V  ·  W = ½QV = ½CV²  ·  Q = Q₀ e^(−t/RC)', tex: [t`C = \frac{Q}{V}`, t`W = \tfrac12 QV = \tfrac12 CV^2`, t`Q = Q_0\,e^{-t/RC}`] },
      { label: 'Magnetic force & radius', eq: 'F = BIl sin θ  ·  F = BQv sin θ  ·  r = p / BQ', tex: [t`F = BIl\sin\theta`, t`F = BQv\sin\theta`, t`r = \frac{p}{BQ}`] },
      { label: 'Faraday’s law', eq: 'Φ = BA  ·  ε = −d(NΦ) / dt', tex: [t`\Phi = BA`, t`\varepsilon = -\frac{d(N\Phi)}{dt}`] },
      { label: 'Mass–energy', eq: 'ΔE = c² Δm', tex: [t`\Delta E = c^2\,\Delta m`] },
    ],
  },
  {
    unit: 'WPH15',
    title: 'Thermodynamics, Oscillations & Cosmology',
    items: [
      { label: 'Thermal & Ideal gas', eq: 'ΔE = mcΔθ  ·  pV = NkT = nRT  ·  ½m⟨c²⟩ = ³⁄₂ kT', tex: [t`\Delta E = mc\Delta\theta`, t`pV = NkT = nRT`, t`\tfrac12 m\langle c^2\rangle = \tfrac32 kT`] },
      { label: 'SHM', eq: 'a = −ω²x  ·  T = 2π/ω  ·  T = 2π√(m/k) = 2π√(l/g)', tex: [t`a = -\omega^2 x`, t`T = \frac{2\pi}{\omega}`, t`T = 2\pi\sqrt{\frac{m}{k}} = 2\pi\sqrt{\frac{l}{g}}`] },
      { label: 'Gravity & Orbits', eq: 'F = Gm₁m₂/r²  ·  V_grav = −GM/r  ·  T² ∝ r³', tex: [t`F = \frac{Gm_1m_2}{r^2}`, t`V_{grav} = -\frac{GM}{r}`, t`T^2 \propto r^3`] },
      { label: 'Nuclear decay', eq: 'A = λN  ·  N = N₀ e^(−λt)  ·  t₁/₂ = ln 2 / λ', tex: [t`A = \lambda N`, t`N = N_0\,e^{-\lambda t}`, t`t_{1/2} = \frac{\ln 2}{\lambda}`] },
      { label: 'Stars & Stefan–Boltzmann', eq: 'L = σAT⁴ = 4πr²σT⁴  ·  I = L / (4πd²)', tex: [t`L = \sigma AT^4 = 4\pi r^2\sigma T^4`, t`I = \frac{L}{4\pi d^2}`] },
      { label: 'Redshift & Hubble', eq: 'z = Δλ/λ ≈ Δf/f ≈ v/c  ·  v = H₀d', tex: [t`z = \frac{\Delta\lambda}{\lambda} \approx \frac{\Delta f}{f} \approx \frac{v}{c}`, t`v = H_0 d`] },
    ],
  },
];

export const CHEM_DATA: ChemDataRow[] = [
  // Core Equations
  { group: 'Equations', key: 'Moles & Gas', val: 'n = m/M = cV  ·  pV = nRT (p in Pa, V in m³)', tex: [t`n = \frac{m}{M} = cV`, t`pV = nRT \ (p \text{ in Pa},\ V \text{ in m}^3)`] },
  { group: 'Equations', key: 'Calorimetry', val: 'q = mcΔT  ·  ΔH = −q / n', tex: [t`q = mc\Delta T`, t`\Delta H = -\frac{q}{n}`] },
  { group: 'Equations', key: 'Entropy & Gibbs', val: 'ΔS_tot = ΔS_sys + ΔS_surr  ·  ΔG = ΔH − TΔS_sys (feasible if ΔG ≤ 0)', tex: [t`\Delta S_{total} = \Delta S_{system} + \Delta S_{surroundings}`, t`\Delta G = \Delta H - T\Delta S_{system}`, t`(\text{feasible if } \Delta G \leq 0)`] },
  { group: 'Equations', key: 'Arrhenius', val: 'k = A e^(−Ea / RT)  ·  ln k = −Ea/(RT) + ln A', tex: [t`k = A\,e^{-E_a/RT}`, t`\ln k = -\frac{E_a}{RT} + \ln A`] },
  { group: 'Equations', key: 'Equilibrium & Entropy', val: 'ΔS_tot = R ln K  ·  p(A) = x(A) × P_total', tex: [t`\Delta S_{total} = R\ln K`, t`p(A) = x(A) \times P_{total}`] },
  { group: 'Equations', key: 'Acids & Buffers', val: 'pH = −log₁₀[H⁺]  ·  Ka = [H⁺][A⁻]/[HA]  ·  pKa = −log₁₀ Ka', tex: [t`\text{pH} = -\log_{10}[\text{H}^+]`, t`K_a = \frac{[\text{H}^+][\text{A}^-]}{[\text{HA}]}`, t`\text{p}K_a = -\log_{10} K_a`] },
  { group: 'Equations', key: 'Cell potential', val: 'E°_cell = E°(reduction / RHS) − E°(oxidation / LHS)', tex: [t`E^\circ_{cell} = E^\circ_{\text{reduction (RHS)}} - E^\circ_{\text{oxidation (LHS)}}`] },

  // IR Spectroscopy
  { group: 'IR Peaks (cm⁻¹)', key: 'O–H (alcohol)', val: '3230 – 3550', note: 'Broad, strong' },
  { group: 'IR Peaks (cm⁻¹)', key: 'O–H (carboxylic acid)', val: '2500 – 3300', note: 'Very broad' },
  { group: 'IR Peaks (cm⁻¹)', key: 'N–H (amine / amide)', val: '3100 – 3500', note: 'Sharp' },
  { group: 'IR Peaks (cm⁻¹)', key: 'C–H (alkane)', val: '2850 – 3000', note: 'Strong' },
  { group: 'IR Peaks (cm⁻¹)', key: 'C≡N (nitrile)', val: '2220 – 2260', note: 'Sharp' },
  { group: 'IR Peaks (cm⁻¹)', key: 'C=O (aldehyde/ketone/acid/ester)', val: '1680 – 1750', note: 'Very strong, sharp' },
  { group: 'IR Peaks (cm⁻¹)', key: 'C=C (alkene)', val: '1620 – 1680', note: 'Variable' },

  // Standard Electrode Potentials
  { group: 'Electrode E° (V)', key: 'Zn²⁺ + 2e⁻ ⇌ Zn', val: '−0.76 V' },
  { group: 'Electrode E° (V)', key: 'Fe²⁺ + 2e⁻ ⇌ Fe', val: '−0.44 V' },
  { group: 'Electrode E° (V)', key: '2H⁺ + 2e⁻ ⇌ H₂', val: '0.00 V', note: 'SHE reference' },
  { group: 'Electrode E° (V)', key: 'Cu²⁺ + 2e⁻ ⇌ Cu', val: '+0.34 V' },
  { group: 'Electrode E° (V)', key: 'I₂ + 2e⁻ ⇌ 2I⁻', val: '+0.54 V' },
  { group: 'Electrode E° (V)', key: 'Fe³⁺ + e⁻ ⇌ Fe²⁺', val: '+0.77 V' },
  { group: 'Electrode E° (V)', key: 'Ag⁺ + e⁻ ⇌ Ag', val: '+0.80 V' },
  { group: 'Electrode E° (V)', key: 'Cr₂O₇²⁻ + 14H⁺ + 6e⁻ ⇌ 2Cr³⁺ + 7H₂O', val: '+1.33 V', note: 'Orange → green' },
  { group: 'Electrode E° (V)', key: 'Cl₂ + 2e⁻ ⇌ 2Cl⁻', val: '+1.36 V' },
  { group: 'Electrode E° (V)', key: 'MnO₄⁻ + 8H⁺ + 5e⁻ ⇌ Mn²⁺ + 4H₂O', val: '+1.51 V', note: 'Purple → colourless' },

  // Flame & Ion Tests
  { group: 'Tests', key: 'Flame colours', val: 'Li⁺ red · Na⁺ yellow · K⁺ lilac · Ca²⁺ brick-red · Sr²⁺ crimson · Ba²⁺ apple-green' },
  { group: 'Tests', key: 'Halides (AgNO₃ + HNO₃)', val: 'Cl⁻ white (dil NH₃) · Br⁻ cream (conc NH₃) · I⁻ yellow (insol NH₃)' },
  { group: 'Tests', key: 'Organic tests', val: 'C=C Br₂(aq) decolourises · CHO Tollens silver mirror / Fehling brick-red · C=O 2,4-DNPH orange ppt' },
];

export const ELEMENTS: ElementItem[] = [
  { z: 1, sym: 'H', name: 'Hydrogen', ar: '1.0', cat: 'nonmetal' },
  { z: 2, sym: 'He', name: 'Helium', ar: '4.0', cat: 'noble' },
  { z: 3, sym: 'Li', name: 'Lithium', ar: '6.9', cat: 'alkali' },
  { z: 4, sym: 'Be', name: 'Beryllium', ar: '9.0', cat: 'alkaline' },
  { z: 5, sym: 'B', name: 'Boron', ar: '10.8', cat: 'nonmetal' },
  { z: 6, sym: 'C', name: 'Carbon', ar: '12.0', cat: 'nonmetal' },
  { z: 7, sym: 'N', name: 'Nitrogen', ar: '14.0', cat: 'nonmetal' },
  { z: 8, sym: 'O', name: 'Oxygen', ar: '16.0', cat: 'nonmetal' },
  { z: 9, sym: 'F', name: 'Fluorine', ar: '19.0', cat: 'halogen' },
  { z: 10, sym: 'Ne', name: 'Neon', ar: '20.2', cat: 'noble' },
  { z: 11, sym: 'Na', name: 'Sodium', ar: '23.0', cat: 'alkali' },
  { z: 12, sym: 'Mg', name: 'Magnesium', ar: '24.3', cat: 'alkaline' },
  { z: 13, sym: 'Al', name: 'Aluminium', ar: '27.0', cat: 'other' },
  { z: 14, sym: 'Si', name: 'Silicon', ar: '28.1', cat: 'nonmetal' },
  { z: 15, sym: 'P', name: 'Phosphorus', ar: '31.0', cat: 'nonmetal' },
  { z: 16, sym: 'S', name: 'Sulfur', ar: '32.1', cat: 'nonmetal' },
  { z: 17, sym: 'Cl', name: 'Chlorine', ar: '35.5', cat: 'halogen' },
  { z: 18, sym: 'Ar', name: 'Argon', ar: '39.9', cat: 'noble' },
  { z: 19, sym: 'K', name: 'Potassium', ar: '39.1', cat: 'alkali' },
  { z: 20, sym: 'Ca', name: 'Calcium', ar: '40.1', cat: 'alkaline' },
  { z: 21, sym: 'Sc', name: 'Scandium', ar: '45.0', cat: 'tm' },
  { z: 22, sym: 'Ti', name: 'Titanium', ar: '47.9', cat: 'tm' },
  { z: 23, sym: 'V', name: 'Vanadium', ar: '50.9', cat: 'tm' },
  { z: 24, sym: 'Cr', name: 'Chromium', ar: '52.0', cat: 'tm' },
  { z: 25, sym: 'Mn', name: 'Manganese', ar: '54.9', cat: 'tm' },
  { z: 26, sym: 'Fe', name: 'Iron', ar: '55.8', cat: 'tm' },
  { z: 27, sym: 'Co', name: 'Cobalt', ar: '58.9', cat: 'tm' },
  { z: 28, sym: 'Ni', name: 'Nickel', ar: '58.7', cat: 'tm' },
  { z: 29, sym: 'Cu', name: 'Copper', ar: '63.5', cat: 'tm' },
  { z: 30, sym: 'Zn', name: 'Zinc', ar: '65.4', cat: 'tm' },
  { z: 35, sym: 'Br', name: 'Bromine', ar: '79.9', cat: 'halogen' },
  { z: 36, sym: 'Kr', name: 'Krypton', ar: '83.8', cat: 'noble' },
  { z: 37, sym: 'Rb', name: 'Rubidium', ar: '85.5', cat: 'alkali' },
  { z: 38, sym: 'Sr', name: 'Strontium', ar: '87.6', cat: 'alkaline' },
  { z: 47, sym: 'Ag', name: 'Silver', ar: '107.9', cat: 'tm' },
  { z: 53, sym: 'I', name: 'Iodine', ar: '126.9', cat: 'halogen' },
  { z: 56, sym: 'Ba', name: 'Barium', ar: '137.3', cat: 'alkaline' },
  { z: 78, sym: 'Pt', name: 'Platinum', ar: '195.1', cat: 'tm' },
  { z: 79, sym: 'Au', name: 'Gold', ar: '197.0', cat: 'tm' },
  { z: 82, sym: 'Pb', name: 'Lead', ar: '207.2', cat: 'other' },
  { z: 92, sym: 'U', name: 'Uranium', ar: '238.0', cat: 'other' },
];
