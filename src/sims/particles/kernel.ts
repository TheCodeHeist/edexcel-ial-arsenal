/* Kernel's helpers for Particle Lab: loose name/symbol matching (particles, antiparticles, quarks, beams, presets,
   cloud sources, classic events, collider shots, accelerators, foils, units) and plain-text summaries of results. */

import {
  ALL, BY_ID, get, symOf, thirds, signed, massText, lifeText, qText, hadronFor, QCHARGE,
  FAMILY_NAME, sci, plain, short, eV, E, C, H, MEV, MEVC2, U, type Particle, type Q, type QSlot,
} from './data';
import { PRESETS, PALETTE, check, qValue, photon, reactionText, type Preset } from './rules';
import { BEAMS, sqrtS, channels, type Result } from './collide';
import { CSOURCES, SHOTS, bubbleEvents, CLOUD_B, BUBBLE_B, COLLIDER_B, type Shot } from './detect';
import { NAME as ACCEL_NAME, gun, linac, cyclo, sync, REL, NUCLEON, LHC_R, type Kind as AccelKind } from './accel';
import { BEAMS as ACCEL_BEAMS, reach } from './physics';
import { TARGETS, closest, nucRadius, pMore, thomsonRms } from './scatter';
import { REST, WHO_NAME, WHO_SYM, fOf, lamOf, pMeV, radiusCm, speed, type Who } from './matter';
import type { AccelPrefs } from './Accelerators.svelte';
import type { DetPrefs } from './Detectors.svelte';
import type { ScatPrefs } from './Scatter.svelte';
import type { ZooPrefs } from './Zoo.svelte';
import type { RulePrefs } from './Rules.svelte';
import type { MatterPrefs } from './Matter.svelte';

export type ParticleMode = 'accel' | 'detect' | 'nucleus' | 'table' | 'reactions' | 'matter' | 'practice';

const norm = (s: string) =>
  String(s ?? '').toLowerCase()
    .replace(/[⁺]/g, '+').replace(/[⁻−–—]/g, '-').replace(/[⁰]/g, '0')
    .replace(/π/g, 'pi').replace(/μ/g, 'mu').replace(/τ/g, 'tau').replace(/γ/g, 'gamma')
    .replace(/ν/g, 'nu').replace(/λ/g, 'lambda').replace(/σ/g, 'sigma').replace(/ξ/g, 'xi')
    .replace(/ω/g, 'omega').replace(/δ/g, 'delta').replace(/ψ/g, 'psi').replace(/υ/g, 'upsilon')
    .replace(/α/g, 'alpha').replace(/β/g, 'beta')
    .replace(/([a-z0-9])\u0304/g, 'anti-$1')
    .replace(/\b(the|a|an|particle|meson|baryon|boson|lepton)\b/g, '')
    .replace(/[\s_'"`,.]+/g, '');

/* Explicit aliases for particles & antiparticles (common student/exam spellings). */
const P_ALIAS: Record<string, string> = {
  p: 'p', 'p+': 'p', proton: 'p',
  'anti-p': 'anti-p', antip: 'anti-p', antiproton: 'anti-p', 'p-': 'anti-p', pbar: 'anti-p',
  n: 'n', n0: 'n', neutron: 'n',
  'anti-n': 'anti-n', antin: 'anti-n', antineutron: 'anti-n', nbar: 'anti-n',
  e: 'e', 'e-': 'e', electron: 'e', 'beta-': 'e', beta: 'e',
  'anti-e': 'anti-e', antie: 'anti-e', antielectron: 'anti-e', 'e+': 'anti-e', positron: 'anti-e', 'beta+': 'anti-e',
  mu: 'mu', 'mu-': 'mu', muon: 'mu',
  'anti-mu': 'anti-mu', antimu: 'anti-mu', 'mu+': 'anti-mu', antimuon: 'anti-mu',
  tau: 'tau', 'tau-': 'tau',
  'anti-tau': 'anti-tau', antitau: 'anti-tau', 'tau+': 'anti-tau',
  nue: 'nue', ve: 'nue', electronneutrino: 'nue', neutrino: 'nue',
  'anti-nue': 'anti-nue', antinue: 'anti-nue', nuebar: 'anti-nue', vebar: 'anti-nue', electronantineutrino: 'anti-nue', antineutrino: 'anti-nue',
  numu: 'numu', vmu: 'numu', muonneutrino: 'numu',
  'anti-numu': 'anti-numu', antinumu: 'anti-numu', numubar: 'anti-numu', vmubar: 'anti-numu', muonantineutrino: 'anti-numu',
  nutau: 'nutau', vtau: 'nutau', tauneutrino: 'nutau',
  'anti-nutau': 'anti-nutau', antinutau: 'anti-nutau', nutaubar: 'anti-nutau', vtaubar: 'anti-nutau', tauantineutrino: 'anti-nutau',
  gamma: 'gamma', photon: 'gamma', gammaray: 'gamma', 'gamma-ray': 'gamma',
  g: 'g', gluon: 'g',
  w: 'W', 'w+': 'W', wplus: 'W', wboson: 'W',
  'anti-w': 'anti-W', 'w-': 'anti-W', wminus: 'anti-W',
  z: 'Z', z0: 'Z', zboson: 'Z',
  h: 'H', h0: 'H', higgs: 'H', higgsboson: 'H',
  'pi+': 'pi+', piplus: 'pi+', positivepion: 'pi+', pion: 'pi+',
  'anti-pi+': 'anti-pi+', 'pi-': 'anti-pi+', piminus: 'anti-pi+', negativepion: 'anti-pi+',
  pi0: 'pi0', neutralpion: 'pi0',
  'k+': 'K+', kplus: 'K+', positivekaon: 'K+', kaon: 'K+',
  'anti-k+': 'anti-K+', 'k-': 'anti-K+', kminus: 'anti-K+', negativekaon: 'anti-K+',
  k0: 'K0', neutralkaon: 'K0',
  'anti-k0': 'anti-K0', antik0: 'anti-K0', k0bar: 'anti-K0',
  lambda: 'Lambda', lambda0: 'Lambda', 'anti-lambda': 'anti-Lambda', antilambda: 'anti-Lambda',
  'sigma+': 'Sigma+', sigmaplus: 'Sigma+', sigma: 'Sigma+',
  sigma0: 'Sigma0', sigmazero: 'Sigma0',
  'sigma-': 'Sigma-', sigmaminus: 'Sigma-',
  'anti-sigma+': 'anti-Sigma+', 'anti-sigma0': 'anti-Sigma0', 'anti-sigma-': 'anti-Sigma-',
  xi0: 'Xi0', xizero: 'Xi0', 'xi-': 'Xi-', ximinus: 'Xi-', xi: 'Xi-',
  'anti-xi0': 'anti-Xi0', 'anti-xi-': 'anti-Xi-',
  'omega-': 'Omega-', omegaminus: 'Omega-', omega: 'Omega-', 'anti-omega-': 'anti-Omega-',
  'delta++': 'Delta++', delta: 'Delta++', 'anti-delta++': 'anti-Delta++',
  lambdac: 'Lambdac', 'lambdac+': 'Lambdac', charmedlambda: 'Lambdac',
  d0: 'D0', dmeson: 'D0', 'anti-d0': 'anti-D0',
  jpsi: 'Jpsi', 'j/psi': 'Jpsi',
  'b+': 'B+', bplus: 'B+', bmeson: 'B+', 'b-': 'anti-B+', 'anti-b+': 'anti-B+',
  upsilon: 'Upsilon',
  u: 'u', up: 'u', upquark: 'u', 'anti-u': 'anti-u', ubar: 'anti-u', antiup: 'anti-u', antiupquark: 'anti-u',
  d: 'd', down: 'd', downquark: 'd', 'anti-d': 'anti-d', dbar: 'anti-d', antidown: 'anti-d', antidownquark: 'anti-d',
  s: 's', strange: 's', strangequark: 's', 'anti-s': 'anti-s', sbar: 'anti-s', antistrange: 'anti-s', antistrangequark: 'anti-s',
  c: 'c', charm: 'c', charmquark: 'c', 'anti-c': 'anti-c', cbar: 'anti-c', anticharm: 'anti-c', anticharmquark: 'anti-c',
  b: 'b', bottom: 'b', bottomquark: 'b', 'anti-b': 'anti-b', bbar: 'anti-b', antibottom: 'anti-b', antibottomquark: 'anti-b',
  t: 't', top: 't', topquark: 't', 'anti-t': 'anti-t', tbar: 'anti-t', antitop: 'anti-t', antitopquark: 'anti-t',
};

const FAMILY_NOTE: Record<string, string> = {
  kaon: 'Other kaons in the table: K⁰ (neutral), K⁻ (negative), K̄⁰ (anti-neutral).',
  pion: 'Other pions in the table: π⁰ (neutral), π⁻ (negative).',
  sigma: 'Other sigma baryons in the table: Σ⁰, Σ⁻ (and their antiparticles).',
  xi: 'Other xi baryons in the table: Ξ⁰ (and antiparticles).',
  neutrino: 'Other neutrinos in the table: ν_μ, ν_τ and their antineutrinos.',
};

/** Match any particle or antiparticle in BY_ID. Returns { id, note? } (note mentions siblings for bare names like "kaon"). */
export function matchParticle(q: string, allowed?: string[]): { id: string; note?: string } {
  const raw = String(q ?? '').trim();
  const k = norm(raw);
  const validMsg = () => allowed
    ? 'Valid particles here: ' + allowed.map((id) => `${symOf(id)} (${get(id).name}, id "${id}")`).join(', ') + '.'
    : 'Valid ids include: ' + ALL.map((p) => `${p.id} (${p.name})`).join(', ') + ' (prefix anti- for antiparticles).';
  if (!k) throw new Error('Specify a particle. ' + validMsg());
  let id: string | undefined = BY_ID[raw]?.id ?? P_ALIAS[k];
  if (!id) {
    const all = Object.values(BY_ID);
    const exact = all.filter((p) => norm(p.id) === k || norm(p.name) === k || norm(symOf(p.id)) === k);
    if (exact.length === 1) id = exact[0].id;
    else if (k.length >= 3) {
      const sub = all.filter((p) => norm(p.name).includes(k));
      if (sub.length === 1) id = sub[0].id;
    }
  }
  if (!id || !BY_ID[id]) throw new Error(`No particle matches "${q}". ${validMsg()}`);
  if (allowed && !allowed.includes(id)) {
    throw new Error(`${get(id).name} (${symOf(id)}) is not available in this control. ${validMsg()}`);
  }
  return { id, note: FAMILY_NOTE[k] };
}

/** Match a single quark or antiquark slot for the quark builder. */
export function matchQuark(q: string): QSlot {
  const raw = String(q ?? '').trim();
  const k = norm(raw);
  const MAP: Record<string, QSlot> = {
    u: 'u', up: 'u', upquark: 'u', '-u': '-u', ubar: '-u', 'anti-u': '-u', antiu: '-u', antiup: '-u', antiupquark: '-u',
    d: 'd', down: 'd', downquark: 'd', '-d': '-d', dbar: '-d', 'anti-d': '-d', antid: '-d', antidown: '-d', antidownquark: '-d',
    s: 's', strange: 's', strangequark: 's', '-s': '-s', sbar: '-s', 'anti-s': '-s', antis: '-s', antistrange: '-s', antistrangequark: '-s',
    c: 'c', charm: 'c', charmquark: 'c', '-c': '-c', cbar: '-c', 'anti-c': '-c', antic: '-c', anticharm: '-c', anticharmquark: '-c',
    b: 'b', bottom: 'b', bottomquark: 'b', '-b': '-b', bbar: '-b', 'anti-b': '-b', antib: '-b', antibottom: '-b', antibottomquark: '-b',
    t: 't', top: 't', topquark: 't', '-t': '-t', tbar: '-t', 'anti-t': '-t', antit: '-t', antitop: '-t', antitopquark: '-t',
  };
  if (MAP[k]) return MAP[k];
  throw new Error(`Quark "${q}" not understood. Use u, d, s, c, b, t or antiquarks -u, -d, -s, -c, -b, -t (or ubar, sbar, anti-d, etc.).`);
}

/** Match a classic reaction preset by id or loose description ("neutron decay", "beta-", "pair production", etc.). */
const RX_ALIAS: Record<string, string[]> = {
  'beta-': ['beta-', 'betaminus', 'betadecay', 'neutrondecay', 'decayofneutron', 'freeneutron', 'n->pe-nu'],
  'beta+': ['beta+', 'betaplus', 'positrondecay', 'protonin'],
  'pi+': ['pi+', 'piondecay', 'positivepiondecay'],
  mu: ['mu', 'muondecay'],
  pi0: ['pi0', 'neutralpiondecay'],
  lambda: ['lambda', 'lambdadecay'],
  'k+': ['k+', 'kaondecay'],
  annih: ['annih', 'annihilation', 'electronpositronannihilation', 'e+e-'],
  pair: ['pair', 'pairproduction'],
  'pp-pi0': ['pp-pi0', 'makingpion', 'pionproduction'],
  pbar: ['pbar', 'makingantiproton', 'antiprotonproduction', 'bevatron'],
  assoc: ['assoc', 'associatedproduction', 'strangepairs'],
  omega: ['omega', 'discoveryofomega', 'omega-'],
  nu: ['nu', 'detectingantineutrino', 'inversebeta', 'inversebetadecay'],
  'x-n': ['x-n', 'withoutantineutrino', 'missingantineutrino'],
  'x-p': ['x-p', 'freeproton', 'freeprotonbeta+'],
  'x-pdecay': ['x-pdecay', 'protondecay'],
  'x-mueg': ['x-mueg', 'muontoelectron'],
  'x-pp': ['x-pp', 'twoprotonsmakethree'],
  'x-pi': ['x-pi', 'wrongneutrino'],
  'x-lam': ['x-lam', 'lambdatoprotonkaon'],
  'x-1g': ['x-1g', 'onephoton', 'singlephoton'],
};
export function matchReactionPreset(q: string): Preset {
  const k = norm(q);
  const valid = () => 'Presets: ' + PRESETS.map((p) => `${p.id} (${p.name})`).join('; ') + '.';
  if (!k) throw new Error('Specify a reaction preset. ' + valid());
  const exact = PRESETS.filter((p) => norm(p.id) === k || norm(p.name) === k || (RX_ALIAS[p.id] ?? []).includes(k));
  if (exact.length === 1) return exact[0];
  const sub = k.length >= 3 ? PRESETS.filter((p) => norm(p.name).includes(k) || (RX_ALIAS[p.id] ?? []).some((a) => a.includes(k) || k.includes(a))) : [];
  if (sub.length === 1) return sub[0];
  if (sub.length > 1) throw new Error(`"${q}" matches multiple presets: ${sub.map((p) => `${p.id} (${p.name})`).join(', ')}. Be more specific.`);
  throw new Error(`No reaction preset matches "${q}". ${valid()}`);
}

/** Match a Particle Lab mode/tab loosely. */
const MODE_ALIAS: Record<ParticleMode, string[]> = {
  accel: ['accel', 'accelerator', 'accelerators', 'gun', 'linac', 'cyclotron', 'synchrotron', 'lhc'],
  detect: ['detect', 'detector', 'detectors', 'cloud', 'cloudchamber', 'bubble', 'bubblechamber', 'collider', 'collision'],
  nucleus: ['nucleus', 'atom', 'scatter', 'scattering', 'rutherford', 'geiger', 'goldfoil'],
  table: ['table', 'zoo', 'particlezoo', 'particletable', 'standardmodel', 'quarks', 'hadrons'],
  reactions: ['reactions', 'reaction', 'rules', 'conservation', 'decay', 'decays'],
  matter: ['matter', 'annihilation', 'pairs', 'pairproduction', 'antimatter'],
  practice: ['practice', 'quiz', 'questions'],
};
export function matchMode(q: string): ParticleMode {
  const k = norm(q);
  for (const [m, als] of Object.entries(MODE_ALIAS) as [ParticleMode, string[]][]) {
    if (als.includes(k)) return m;
  }
  const sub = (Object.keys(MODE_ALIAS) as ParticleMode[]).filter((m) => k.length >= 3 && MODE_ALIAS[m].some((a) => a.includes(k) || k.includes(a)));
  if (sub.length === 1) return sub[0];
  throw new Error(`No tab matches "${q}". Valid tabs: accel, detect, nucleus, table, reactions, matter, practice.`);
}

export function matchAccelKind(q: string): AccelKind {
  const k = norm(q);
  if (['gun', 'electrongun', 'finebeam', 'finebeamtube'].includes(k)) return 'gun';
  if (['linac', 'linear', 'linearaccelerator', 'drifttube'].includes(k)) return 'linac';
  if (['cyclo', 'cyclotron', 'dees'].includes(k)) return 'cyclo';
  if (['sync', 'synchrotron', 'lhc', 'largehadroncollider'].includes(k)) return 'sync';
  throw new Error(`Unknown accelerator "${q}". Valid: gun (electron gun), linac (linear accelerator), cyclo (cyclotron), sync (synchrotron / LHC).`);
}

export function matchCloudSource(q: string): string {
  const k = norm(q);
  const hit = CSOURCES.find((s) => norm(s.id) === k || norm(s.label) === k || norm(s.name).includes(k));
  if (hit) return hit.id;
  throw new Error(`Unknown cloud chamber source "${q}". Valid: ${CSOURCES.map((s) => `${s.id} (${s.label})`).join(', ')}.`);
}

export function matchClassicEvent(q: string | number): number {
  const evs = bubbleEvents();
  const n = Number(q);
  if (Number.isInteger(n) && n >= 1 && n <= evs.length) return n - 1;
  const k = norm(String(q ?? ''));
  const idx = evs.findIndex((e) => norm(e.id) === k || norm(e.name) === k || norm(e.name).includes(k) || norm(e.title).includes(k));
  if (idx >= 0) return idx;
  throw new Error(`Unknown classic bubble-chamber event "${q}". Valid (1–${evs.length}): ${evs.map((e, i) => `${i + 1}. ${e.id} (${e.name})`).join('; ')}.`);
}

export function matchShot(q: string): Shot | 'all' {
  const k = norm(q);
  if (k === 'all' || k === 'oneofeach' || k === 'each') return 'all';
  const map: Record<string, Shot> = {
    e: 'e', 'e-': 'e', electron: 'e',
    gamma: 'gamma', photon: 'gamma',
    'pi+': 'pi+', pion: 'pi+', hadron: 'pi+',
    n: 'n', neutron: 'n',
    mu: 'mu', 'mu-': 'mu', muon: 'mu',
    nu: 'nue', nue: 'nue', neutrino: 'nue',
  };
  if (map[k]) return map[k];
  throw new Error(`Unknown collider shot "${q}". Valid: ${SHOTS.map((s) => `${s.id} (${s.label})`).join(', ')}, or "all".`);
}

export function matchFoil(q: string): string {
  const k = norm(q);
  const hit = TARGETS.find((t) => t.id === k || norm(t.sym) === k || norm(t.name) === k);
  if (hit) return hit.id;
  throw new Error(`Unknown foil "${q}". Valid: au (gold), ag (silver), al (aluminium).`);
}

export function matchMatterWho(q: string, allowNeutron: boolean): Who {
  const k = norm(q);
  const map: Record<string, Who> = {
    e: 'e', 'e-': 'e', 'e+': 'e', electron: 'e', positron: 'e', 'electron-positron': 'e',
    mu: 'mu', 'mu-': 'mu', 'mu+': 'mu', muon: 'mu', antimuon: 'mu',
    p: 'p', 'p+': 'p', proton: 'p', antiproton: 'p', 'proton-antiproton': 'p',
    n: 'n', neutron: 'n', antineutron: 'n', 'neutron-antineutron': 'n',
  };
  const w = map[k];
  if (w && (allowNeutron || w !== 'n')) return w;
  throw new Error(`Unknown particle pair "${q}". Valid: ${allowNeutron ? 'e (electron–positron), mu (muon–antimuon), p (proton–antiproton), n (neutron–antineutron)' : 'e (electron–positron), mu (muon–antimuon), p (proton–antiproton)'}.`);
}

/* ---------- plain-text summaries ---------- */

const gev = (m: number) => (m >= 1000 ? `${(m / 1000).toPrecision(3)} GeV` : `${m.toPrecision(3)} MeV`);
const pText = (p: number, id: string) => (id === 'gamma' ? gev(p) : p >= 1000 ? `${(p / 1000).toPrecision(3)} GeV/c` : `${p.toPrecision(3)} MeV/c`);

export function summarizeAccel(p: AccelPrefs): string {
  if (p.kind === 'gun') {
    const G = gun(p.gunV, p.gunB);
    return [
      `Accelerator: ${ACCEL_NAME.gun} (V = ${p.gunV} V, B = ${plain(p.gunB)} mT).`,
      `Eₖ = ${p.gunV} eV = ${sci(G.KE)} J; v = ${sci(G.v)} m s⁻¹ (${plain(G.v / C)} c); p = ${sci(G.p)} kg m s⁻¹; r = ${plain(G.r * 100)} cm (${G.fits ? 'fits in 16 cm bulb' : 'hits the glass!'}); T = ${sci(G.T)} s; λ = h/p = ${sci(H / G.p)} m.`,
    ].join('\n');
  }
  if (p.kind === 'linac') {
    const b = ACCEL_BEAMS[p.linBeam], f = p.linBeam === 'e' ? p.linFe : p.linFp;
    const Lc = linac(b, p.linV, f, p.linN);
    return [
      `Accelerator: ${ACCEL_NAME.linac} (${b.name}s, V = ${short(p.linV)} kV/gap, f = ${f} MHz, ${p.linN} gaps).`,
      `Energy out = ${eV(Lc.last.KE / E)} (${sci(Lc.last.KE)} J); true exit speed = ${plain(Lc.last.vT / C)} c; half-period = ${sci(Lc.half)} s; tube 1 = ${plain(Lc.tubes[0].LT)} m, tube ${p.linN} = ${plain(Lc.last.LT)} m; λ = ${sci(H / Lc.p)} m.`,
      Lc.firstOff ? `Relativity note: from gap ${Lc.firstOff}, ½mv² disagrees with the true relativistic speed by >1%.` : 'Non-relativistic throughout (½mv² accurate).',
    ].join('\n');
  }
  if (p.kind === 'cyclo') {
    const b = ACCEL_BEAMS[p.cycBeam], Cy = cyclo(b, p.cycB, p.cycV, p.cycR);
    return [
      `Accelerator: ${ACCEL_NAME.cyclo} (${b.name}s, B = ${plain(p.cycB)} T, V = ${p.cycV} kV, R = ${plain(p.cycR)} m).`,
      `f = BQ/2πm = ${plain(Cy.f / 1e6)} MHz (T = ${sci(Cy.T)} s); exit Eₖ = ${eV(Cy.KE / E)} (${sci(Cy.KE)} J); v_max = ${sci(Cy.vmax)} m s⁻¹ (${plain(Cy.vmax / C)} c); turns ≈ ${Math.round(Cy.turns)}; p = ${sci(Cy.pmax)} kg m s⁻¹; λ = ${sci(H / Cy.pmax)} m.`,
      Cy.slip > REL ? `Relativistic mass increase ${plain(Cy.slip * 100, 2)}%: drifting out of step with fixed f.` : 'Non-relativistic: fixed frequency stays in step.',
    ].join('\n');
  }
  const Sy = sync(p.syncE);
  return [
    `Accelerator: ${ACCEL_NAME.sync} (beam energy ${eV(p.syncE * 1e9)} per proton, collision energy ${eV(Sy.coll * 1e9)}, R = ${plain(LHC_R / 1000)} km).`,
    `p = ${sci(Sy.p)} kg m s⁻¹; dipole field B = p/QR = ${plain(Sy.B)} T; v = c(1 − ${sci(Sy.lag, 2)}); ${Math.round(Sy.frev)} laps/s; λ = h/p = ${sci(H / Sy.p)} m (${H / Sy.p < NUCLEON ? 'smaller than a nucleon' : 'larger than a nucleon'}).`,
  ].join('\n');
}

export function summarizeCollision(p: DetPrefs, r: Result | null): string {
  const headOn = p.target === 'beam';
  const struck = headOn ? p.beam2 : 'p';
  const W = sqrtS(p.beam, p.pb, struck, p.pb2, headOn);
  const chs = channels(p.beam, struck, W, !headOn);
  const setupLine = headOn
    ? `Collision lab (bubble chamber, B = ${BUBBLE_B} T, ${p.heavy ? 'freon' : 'liquid H₂'}): head-on ${symOf(p.beam)} (${pText(p.pb, p.beam)}) + ${symOf(p.beam2)} (${pText(p.pb2, p.beam2)}), √s = ${gev(W)}.`
    : `Collision lab (bubble chamber, B = ${BUBBLE_B} T, ${p.heavy ? 'freon' : 'liquid H₂'}): ${symOf(p.beam)} (${pText(p.pb, p.beam)}) on fixed ${p.target === 'd' ? 'deuteron (D₂)' : 'proton (H₂)'}, √s = ${gev(W)}.`;
  const lines = [setupLine];
  if (r) {
    lines.push(`Outcome: ${r.ev.equation}`);
    if (r.ev.what.length) lines.push('What happened:\n' + r.ev.what.map((w) => '- ' + w).join('\n'));
    if (r.channel && r.channel.kind !== 'through') {
      const checks = r.rows.filter((x) => !['Le', 'Lmu', 'Ltau'].includes(x.key) || x.left !== 0 || x.right !== 0)
        .map((x) => `${x.name}: ${x.unit === 'thirds' ? thirds(x.left) : signed(x.left)} → ${x.unit === 'thirds' ? thirds(x.right) : signed(x.right)} (${x.ok ? '✓' : '✗'})`).join('; ');
      lines.push(`Conservation: ${checks}.`);
      lines.push(`Energy: ${r.Ein.toFixed(1)} MeV → ${r.Eout.toFixed(1)} MeV; threshold rest mass ${gev(r.thr)} ≤ √s = ${gev(r.W)}.`);
    }
  } else {
    lines.push('No collision fired yet.');
  }
  if (chs.open.length) {
    lines.push('Top open channels: ' + chs.open.slice(0, 6).map((c) => `${c.label} (${c.w >= 0.001 ? (c.w * 100).toPrecision(2) : '<0.1'}%)`).join('; ') + '.');
  }
  if (chs.closed.length) {
    lines.push('Closed (needs higher √s): ' + chs.closed.slice(0, 3).map((c) => `${c.label.split(' → ')[1]} (≥ ${gev(c.m)})`).join('; ') + '.');
  }
  return lines.join('\n');
}

export function summarizeDetector(p: DetPrefs, colResult: Result | null, colliderFired: number): string {
  if (p.det === 'bubble' && p.bmode === 'collide') return summarizeCollision(p, colResult);
  if (p.det === 'bubble') {
    const evs = bubbleEvents();
    const ev = evs[Math.max(0, Math.min(evs.length - 1, p.ev))];
    return [
      `Bubble chamber (classic event ${p.ev + 1}/${evs.length}, B = ${BUBBLE_B} T, neutral tracks ${p.neutral ? 'shown dashed' : 'invisible'}): ${ev.name} — ${ev.title}.`,
      `Equation: ${ev.equation}`,
      ...ev.what.map((w) => '- ' + w),
      ev.checks.length ? 'Checks: ' + ev.checks.map((c) => `${c.label} (${c.before} → ${c.after})`).join('; ') : '',
      `Momentum: ${ev.momentum}`,
    ].filter(Boolean).join('\n');
  }
  if (p.det === 'cloud') {
    const names = p.srcs.length ? p.srcs.map((id) => CSOURCES.find((s) => s.id === id)?.label ?? id).join(', ') : 'background only';
    return [
      `Cloud chamber: sources = ${names}; holders ${p.together ? 'all on one holder' : 'spread apart'}; magnetic field ${p.field ? `${CLOUD_B} T on` : 'off'}; cosmic rays ${p.cosmic ? 'on' : 'off'}; radon ${p.radon ? 'on' : 'off'}.`,
      'Available sources: ' + CSOURCES.map((s) => `${s.id} (${s.label})`).join(', ') + '.',
    ].join('\n');
  }
  return [
    `Collider detector (B = ${COLLIDER_B} T, beyond the spec): ${colliderFired} particle(s) fired so far.`,
    'Stopping layers: e⁻ & γ stop in EM calorimeter (only e⁻ leaves tracker curve); π⁺ & n stop in hadron calorimeter (only π⁺ leaves tracker curve); μ⁻ reaches muon chambers; ν escapes.',
  ].join('\n');
}

export function summarizeScatter(p: ScatPrefs, st: { fired: number; over90: number; back: number; atObs: number; atPred: number }): string {
  const tg = TARGETS.find((x) => x.id === p.target) ?? TARGETS[0];
  const d = closest(tg, p.mev), nt = tg.n * p.t * 1e-6, rnuc = nucRadius(tg.A);
  const p90 = p.model === 'nuclear' ? pMore(Math.PI / 2, d, nt) : 0;
  const rms = thomsonRms(tg, p.mev, p.t * 1e-6);
  const binLo = Math.min(35, Math.floor(p.det / 5)) * 5;
  return [
    `Nucleus α-scattering (${p.view === 'exp' ? 'Geiger–Marsden experiment' : 'close-up on one atom'}, ${p.model === 'nuclear' ? 'Rutherford nuclear model' : 'Thomson plum-pudding model'}).`,
    `Set-up: ${tg.name} foil (${tg.sym}, Z = ${tg.Z}, A = ${tg.A}), thickness ${plain(p.t, 2)} μm, α energy ${plain(p.mev, 2)} MeV, microscope at θ = ${p.det}°, rate ×${p.rate}.`,
    `Closest approach d = kQq/Eₖ = ${sci(d)} m; nuclear radius r = r₀A^(1/3) = ${sci(rnuc, 2)} m; atom radius ${sci(tg.R, 2)} m.`,
    `Counts: ${st.fired} α fired, ${st.over90} over 90° (${st.back} over 150°), ${st.atObs} in ${binLo}–${binLo + 5}° bin${p.model === 'nuclear' && isFinite(st.atPred) ? ` (Rutherford predicts ${plain(st.atPred, 2)})` : ''}.`,
    p.model === 'nuclear'
      ? `Predicted > 90°: ${p90 > 0 ? `1 in ${short(1 / p90, 2)}` : '0'}.`
      : `Thomson plum-pudding RMS deflection: ${plain((rms * 180) / Math.PI, 2)}° (essentially zero beyond a few degrees).`,
  ].join('\n');
}

export function summarizeZoo(p: ZooPrefs, note?: string): string {
  const sel: Particle = BY_ID[p.sel] ?? get('p');
  const Lsum = sel.L[0] + sel.L[1] + sel.L[2];
  const lines = [
    `Particle table (${p.anti ? 'antiparticles view' : 'particles view'}, ${p.spec ? 'spec-only highlighted' : 'all shown'}): open at ${sel.name} (${symOf(sel.id)}, id "${sel.id}").`,
    `Family: ${FAMILY_NAME[sel.family]}${sel.gen ? `, generation ${sel.gen}` : ''}${sel.anti ? ', antiparticle' : ''}${sel.spec ? '' : ' (beyond the spec)'}.`,
    `Properties: Q = ${sel.q3 === 0 ? '0' : thirds(sel.q3) + 'e'}, mass = ${massText(sel.mass)}${sel.mass >= 1e-3 ? ` (${sci(sel.mass * MEVC2)} kg)` : ''}, B = ${thirds(sel.b3)}, L = ${signed(Lsum)} (Lₑ=${sel.L[0]}, L_μ=${sel.L[1]}, L_τ=${sel.L[2]}), S = ${signed(sel.S)}, lifetime = ${lifeText(sel.life)}, spin = ${sel.spin}.`,
  ];
  if (sel.quarks) lines.push(`Quark content: ${sel.quarks.map(qText).join('')}${sel.mix ? ` (${sel.mix})` : ''}.`);
  if (sel.decays?.length) lines.push(`Decays: ${sel.decays.join('; ')}.`);
  if (isFinite(sel.life) && sel.mass > 0 && sel.life > 1e-21) {
    const tr = reach(sel.life, p.beta * C);
    lines.push(`Time dilation at ${p.beta.toFixed(4)}c (γ = ${short(tr.g, 3)}): classic reach ${sci(tr.classic)} m vs relativistic ${sci(tr.dilated)} m (lab lifetime ${lifeText(tr.life)}).`);
  }
  lines.push(`Discovered: ${sel.found}.`);
  if (note) lines.push(note);
  // Quark builder state
  if (p.slots.length) {
    const qOf = (q: QSlot) => (q.startsWith('-') ? -QCHARGE[q.slice(1) as Q] : QCHARGE[q as Q]);
    const q3 = p.slots.reduce((a, q) => a + qOf(q), 0);
    const b3 = p.slots.reduce((a, q) => a + (q.startsWith('-') ? -1 : 1), 0);
    const S = p.slots.reduce((a, q) => a + (q === 's' ? -1 : q === '-s' ? 1 : 0), 0);
    const nq = p.slots.filter((q) => !q.startsWith('-')).length, na = p.slots.length - nq;
    const valid = (p.slots.length === 2 && nq === 1) || (p.slots.length === 3 && (nq === 3 || na === 3));
    const match = valid && !p.slots.some((q) => q === 't' || q === '-t') ? hadronFor(p.slots) : null;
    lines.push(`Quark builder [${p.slots.map(qText).join(' ')}]: Q = ${thirds(q3)}e, B = ${thirds(b3)}, S = ${signed(S)} → ${match ? `${match.name} (${symOf(match.id)})` : valid ? 'valid hadron combination (not in this table)' : 'not a valid hadron'}.`);
  }
  return lines.join('\n');
}

export function summarizeRules(p: RulePrefs): string {
  const preset = PRESETS.find((x) => x.id === p.preset && x.lhs.join() === p.lhs.join() && x.rhs.join() === p.rhs.join());
  const c = check(p.lhs, p.rhs, !!preset?.nucleus);
  const Q = qValue(c);
  const rx = p.lhs.length || p.rhs.length ? reactionText(p.lhs, p.rhs) : '(empty)';
  const lines = [
    `Reactions: ${preset ? preset.name : 'Custom'} — ${rx}.`,
    `Verdict: ${c.possible ? 'Possible' : 'Not possible'}${c.possible && c.force ? ` (${c.force} interaction)` : ''}.`,
    'Conservation checks: ' + c.rows.filter((r) => !['Le', 'Lmu', 'Ltau'].includes(r.key) || r.left !== 0 || r.right !== 0 || !r.ok)
      .map((r) => `${r.name}: ${r.unit === 'thirds' ? thirds(r.left) : signed(r.left)} → ${r.unit === 'thirds' ? thirds(r.right) : signed(r.right)} (${r.ok ? '✓' : r.soft && Math.abs(r.left - r.right) === 1 ? 'weak only' : '✗'})`).join('; ') + '.',
    `Rest mass: ${short(c.mL, 5)} MeV/c² → ${short(c.mR, 5)} MeV/c² (energy: ${c.energy}, momentum: ${c.momentum}).`,
  ];
  if (p.lhs.length && p.rhs.length) {
    if (p.rhs.length === 2 && p.rhs.every((x) => x === 'gamma') && p.lhs.length === 2) {
      const ph = photon(c.mL / 2);
      lines.push(`Annihilation at rest: two photons of ${short(c.mL / 2, 4)} MeV (${sci((c.mL / 2) * MEV)} J) each; f = ${sci(ph.f)} Hz, λ = ${sci(ph.lam)} m.`);
    } else if (p.lhs.length === 1 && p.lhs[0] === 'gamma') {
      const ph = photon(c.mR);
      lines.push(`Pair production threshold: E ≥ ${short(c.mR, 4)} MeV (${sci(c.mR * MEV)} J); f_min = ${sci(ph.f)} Hz, λ_max = ${sci(ph.lam)} m.`);
    } else if (Q >= 0) {
      lines.push(`Energy released: Δm = ${short(Q, 4)} MeV/c² (${sci(Q * MEVC2)} kg) → ΔE = ${short(Q, 4)} MeV = ${sci(Q * MEV)} J.`);
    } else {
      lines.push(`Energy needed: Δm = ${short(-Q, 4)} MeV/c² (${sci(-Q * MEVC2)} kg) → ΔE = ${short(-Q, 4)} MeV = ${sci(-Q * MEV)} J.`);
    }
  }
  if (c.why.length) lines.push('Reasons: ' + c.why.join(' '));
  if (preset?.note) lines.push(`Note: ${preset.note}`);
  if (preset?.quark) lines.push(`Quarks: ${preset.quark}`);
  // Unit converter readout
  const UNITS: Record<string, [number, boolean]> = {
    eV: [E, false], keV: [E * 1e3, false], MeV: [MEV, false], GeV: [MEV * 1e3, false], TeV: [MEV * 1e6, false], J: [1, false],
    MeVc2: [MEVC2, true], GeVc2: [MEVC2 * 1e3, true], u: [U, true], kg: [1, true],
  };
  const u = UNITS[p.unit] ?? UNITS.MeV;
  const asJ = u[1] ? p.conv * u[0] * C * C : p.conv * u[0];
  const asKg = u[1] ? p.conv * u[0] : asJ / (C * C);
  lines.push(`Unit converter (${p.conv} ${p.unit}): ${sci(asJ)} J = ${eV(asJ / E)} = ${sci(asKg)} kg = ${short(asJ / MEV, 4)} MeV/c² = ${sci(asKg / U)} u (photon λ = ${sci((H * C) / asJ)} m).`);
  return lines.join('\n');
}

export function summarizeMatter(p: MatterPrefs, ev: { kp?: number; km?: number; note?: string } | null): string {
  const annih = p.mode === 'annih';
  const who: Who = annih ? p.who : p.pwho;
  const m = REST[who], [nA, nB] = WHO_NAME[who], [sA, sB] = WHO_SYM[who];
  if (annih) {
    const K = p.K * m, Ephot = m + K;
    return [
      `Annihilation: ${nA} (${sA}) + ${nB} (${sB}) → γ + γ.`,
      `Rest mass each: ${short(m, 4)} MeV/c² (${sci(m * MEVC2, 3)} kg); KE each: ${K === 0 ? '0 (at rest)' : `${short(K, 3)} MeV (v = ${plain(speed(K, m) / C, 3)}c)`}.`,
      `Two back-to-back photons, each E = ${short(Ephot, 4)} MeV = ${sci(Ephot * MEV, 3)} J; f = E/h = ${sci(fOf(Ephot), 3)} Hz; λ = c/f = ${sci(lamOf(Ephot), 3)} m.`,
      ev?.note ? `Note: ${ev.note}` : '',
    ].filter(Boolean).join('\n');
  }
  const Eg = p.Eg?.[p.pwho] ?? 6, thr = 2 * m, below = Eg < thr, Kt = Math.max(0, Eg - thr);
  const kp = ev?.kp ?? Kt / 2, km = ev?.km ?? Kt / 2;
  const rTxt = (k: number) => { const r = radiusCm(pMeV(k, m), p.B); return !isFinite(r) ? 'straight (B = 0)' : r >= 100 ? `${plain(r / 100, 3)} m` : `${plain(r, 3)} cm`; };
  return [
    `Pair production: γ → ${sA} + ${sB} (near a nucleus), B = ${plain(p.B, 2)} T.`,
    `Photon energy E = ${short(Eg, 4)} MeV (f = ${sci(fOf(Eg), 3)} Hz, λ = ${sci(lamOf(Eg), 3)} m); threshold 2mc² = ${short(thr, 4)} MeV (λ_max = ${sci(lamOf(thr), 3)} m).`,
    below
      ? `Below threshold (${short(Eg, 4)} MeV < ${short(thr, 4)} MeV): no pair can be made; photon passes through.`
      : `Left over as kinetic energy: ${short(Kt, 4)} MeV (${sA}: ${short(km, 3)} MeV, first radius ${rTxt(km)}; ${sB}: ${short(kp, 3)} MeV, first radius ${rTxt(kp)}).`,
  ].join('\n');
}

export { BEAMS as COLLIDE_BEAMS, PALETTE as REACTION_PALETTE };
