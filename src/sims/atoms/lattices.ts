/* Atoms & Bonding Lab: Giant ionic, giant covalent, giant metallic & simple molecular lattices (Spec 3.1–3.12, 3.19–3.21). */

export type LatticeId = 'nacl' | 'diamond' | 'graphite' | 'graphene' | 'copper' | 'iodine' | 'ice';

export interface LatticeInfo {
  id: LatticeId;
  name: string;
  formula: string;
  structure: string;
  bonding: string;
  mp: string;
  conductSolid: string;
  conductMolten: string;
  shearTitle: string;
  shearText: string;
  facts: string[];
}

export const LATTICES: LatticeInfo[] = [
  {
    id: 'nacl', name: 'Sodium chloride', formula: 'NaCl',
    structure: 'Giant ionic lattice',
    bonding: 'Strong electrostatic attraction between oppositely charged Na⁺ and Cl⁻ ions',
    mp: '801 °C (high)',
    conductSolid: 'No — ions are fixed in the lattice',
    conductMolten: 'Yes — ions are free to move and carry charge',
    shearTitle: 'Brittle (shatters)',
    shearText: 'Shifting one layer brings like-charged ions (Na⁺ next to Na⁺, Cl⁻ next to Cl⁻) together; strong electrostatic repulsion splits the crystal.',
    facts: [
      'Each Na⁺ is surrounded by 6 Cl⁻ ions, and each Cl⁻ by 6 Na⁺ ions (6:6 coordination).',
      'High melting point because lots of energy is needed to overcome strong electrostatic forces throughout the giant lattice.',
      'Conducts only when molten or in aqueous solution, when ions are mobile.',
    ],
  },
  {
    id: 'diamond', name: 'Diamond', formula: 'C',
    structure: 'Giant covalent lattice',
    bonding: 'Strong covalent bonds; each C forms 4 single bonds (tetrahedral, 109.5°)',
    mp: '3550 °C (very high)',
    conductSolid: 'No — all 4 outer electrons are localised in covalent bonds',
    conductMolten: 'Sublimes (no free ions or electrons)',
    shearTitle: 'Rigid & extremely hard',
    shearText: 'The 3D tetrahedral network of strong covalent bonds locks every atom in place; layers cannot slide.',
    facts: [
      'Every carbon atom is covalently bonded to 4 others in a tetrahedral 3D network (109.5°).',
      'Very high melting point and extreme hardness because many strong covalent bonds must be broken.',
      'Does not conduct electricity because there are no delocalised electrons or mobile ions.',
    ],
  },
  {
    id: 'graphite', name: 'Graphite', formula: 'C',
    structure: 'Giant covalent (layered)',
    bonding: 'Each C forms 3 covalent bonds (120°) in hexagonal sheets; weak London forces between layers',
    mp: '3650 °C (sublimes)',
    conductSolid: 'Yes (along layers) — 1 delocalised electron per carbon',
    conductMolten: 'Sublimes',
    shearTitle: 'Soft & slippery',
    shearText: 'Weak London forces between hexagonal layers allow sheets to slide easily over one another.',
    facts: [
      'Each carbon forms 3 strong covalent bonds in flat hexagonal rings (trigonal planar, 120°).',
      'The 4th outer electron on each carbon is delocalised across the layer and carries current parallel to the sheets.',
      'High melting point (strong covalent bonds within sheets) yet soft and used as a lubricant (weak London forces between sheets).',
    ],
  },
  {
    id: 'graphene', name: 'Graphene', formula: 'C',
    structure: 'Giant covalent (single 2D sheet)',
    bonding: 'Single layer of hexagonal carbon rings (120°) with delocalised π electrons',
    mp: '> 3600 °C',
    conductSolid: 'Yes — very high conductivity via delocalised electrons',
    conductMolten: 'N/A',
    shearTitle: 'Strongest 2D sheet',
    shearText: 'Every atom is held by three short, strong C–C covalent bonds with no weak interlayer gaps.',
    facts: [
      'One-atom-thick sheet of graphite: hexagonal rings of carbon with 120° bond angles.',
      'Delocalised electrons move freely across the sheet → excellent electrical and thermal conductor.',
      'Transparent, flexible and exceptionally strong for its tiny mass.',
    ],
  },
  {
    id: 'copper', name: 'Copper (metal)', formula: 'Cu',
    structure: 'Giant metallic lattice',
    bonding: 'Strong electrostatic attraction between positive Cu²⁺/Cu⁺ ions and a sea of delocalised electrons',
    mp: '1085 °C (high)',
    conductSolid: 'Yes — delocalised electrons move freely through the lattice',
    conductMolten: 'Yes — delocalised electrons remain mobile',
    shearTitle: 'Malleable & ductile',
    shearText: 'Layers of positive metal ions can slide over each other while the sea of delocalised electrons keeps attracting them — metallic bonding is not broken.',
    facts: [
      'Regular array of positive metal cations surrounded by a sea of delocalised outer-shell electrons.',
      'Higher cation charge and smaller ionic radius give stronger metallic bonding and a higher melting point (e.g. Mg > Na).',
      'Malleable and ductile because layers of ions slide without like-charge repulsion shattering the lattice.',
    ],
  },
  {
    id: 'iodine', name: 'Iodine', formula: 'I2',
    structure: 'Simple molecular lattice',
    bonding: 'Strong I–I covalent bond inside molecules; weak London forces between molecules',
    mp: '114 °C (low, sublimes)',
    conductSolid: 'No — neutral molecules, no delocalised electrons',
    conductMolten: 'No — no mobile ions or electrons',
    shearTitle: 'Soft & volatile',
    shearText: 'Only weak intermolecular London forces hold separate I₂ molecules together; very little energy separates them.',
    facts: [
      'Discrete diatomic I₂ molecules arranged in a regular molecular crystal.',
      'Low melting point because melting only overcomes weak London forces between molecules, NOT the strong I–I covalent bonds.',
      'Poor conductor in solid and liquid states because there are no free charged particles.',
    ],
  },
  {
    id: 'ice', name: 'Ice', formula: 'H2O',
    structure: 'Simple molecular (H-bonded)',
    bonding: 'Covalent O–H bonds inside H₂O; tetrahedral network of hydrogen bonds between molecules',
    mp: '0 °C (anomalously high for Mr = 18)',
    conductSolid: 'No — neutral molecules',
    conductMolten: 'Negligible',
    shearTitle: 'Open hexagonal cage',
    shearText: 'Hydrogen bonds hold H₂O molecules in an open lattice with empty space, making solid ice less dense than liquid water.',
    facts: [
      'Each H₂O forms 4 hydrogen bonds (2 via its H atoms, 2 via its 2 lone pairs on O) in a tetrahedral arrangement.',
      'The rigid, open hexagonal lattice holds molecules further apart than in liquid water → ice is less dense and floats.',
      'Melting breaks only some hydrogen bonds, allowing molecules to pack closer together.',
    ],
  },
];
