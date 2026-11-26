/* Kernel's helpers for Star Lab: loose name matching (stars, binary systems, stages, months, tabs) and plain-text
   summaries of the on-screen state and worked physics. Pure: no DOM, no component state. */

import { STARS, lumOf, peak, spectral, GROUP_NAME, sci, plain, short, years, LSUN, RSUN, MSUN, AU, PC, LY, cepheidL, SN_IA_L, type Star } from './data';
import { track, at, bounds, FATE_NAME, FATE_END, MMIN, MMAX, type Track } from './evolve';
import { SYSTEMS, periodYears, periodSeconds, speeds, radial, brightness, massFromOrbit, shifted, HALPHA, radii, type Sys } from './binary';

export type StarTab = 'life' | 'hr' | 'binary' | 'parallax' | 'candles' | 'hubble' | 'fate' | 'practice';

export const norm = (s: string) =>
  String(s ?? '').toLowerCase()
    .replace(/[’'`]/g, '').replace(/[–—−]/g, '-')
    .replace(/\b(the|a|an|star|system|stage|phase|tab|mode)\b/g, '')
    .replace(/[^a-z0-9+.-]+/g, '');

function uniqueOr<T>(hits: T[], what: string, q: string, valid: string): T {
  const u = [...new Set(hits)];
  if (u.length === 1) return u[0];
  if (u.length > 1) throw new Error(`"${q}" matches more than one ${what}. Be more specific. ${valid}`);
  throw new Error(`No ${what} matches "${q}". ${valid}`);
}

export const starList = () => 'Named stars: ' + STARS.map((s) => `${s.name} (${s.id})`).join(', ') + '.';
export const sysList = () => 'Binary systems: ' + SYSTEMS.map((s) => `${s.name} (${s.id}, ${s.label})`).join('; ') + '.';

/** Match a named star loosely by id, name, or unique prefix/substring. */
export function matchStar(q: string, pool: Star[] = STARS): Star {
  const k = norm(q);
  if (!k) throw new Error('Specify a star. ' + starList());
  const exact = pool.filter((s) => norm(s.id) === k || norm(s.name) === k);
  if (exact.length) return uniqueOr(exact, 'star', q, starList());
  const pref = pool.filter((s) => norm(s.name).startsWith(k) || norm(s.id).startsWith(k));
  if (pref.length) return uniqueOr(pref, 'star', q, starList());
  const sub = k.length >= 3 ? pool.filter((s) => norm(s.name).includes(k) || norm(s.where).includes(k)) : [];
  return uniqueOr(sub, 'star', q, starList());
}

/** Match a binary system by id, name, or type (visual, eclipsing, spectroscopic, type Ia, X-ray / black hole). */
const SYS_ALIAS: Record<string, string[]> = {
  sirius: ['sirius', 'siriusab', 'siriusaandb', 'visual', 'visualbinary'],
  algol: ['algol', 'eclipsing', 'eclipsingbinary', 'demon'],
  spica: ['spica', 'spectroscopic', 'spectroscopicbinary', 'doppler'],
  ia: ['ia', 'typeia', 'type1a', 'supernova', 'snia', 'whitedwarf', 'chandrasekhar'],
  cygx1: ['cygx1', 'cygnusx1', 'cygnusx-1', 'xray', 'x-ray', 'xraybinary', 'blackhole', 'hde226868'],
};
export function matchSystem(q: string): Sys {
  const k = norm(q);
  if (!k) throw new Error('Specify a binary system. ' + sysList());
  const hits = SYSTEMS.filter((s) => norm(s.id) === k || norm(s.name) === k || norm(s.label) === k || (SYS_ALIAS[s.id] ?? []).includes(k));
  if (hits.length) return uniqueOr(hits, 'binary system', q, sysList());
  const sub = k.length >= 3 ? SYSTEMS.filter((s) => norm(s.name).includes(k) || norm(s.label).includes(k) || (SYS_ALIAS[s.id] ?? []).some((a) => a.includes(k))) : [];
  return uniqueOr(sub, 'binary system', q, sysList());
}

/** Match a Star Lab tab / sub-tab name loosely. */
const TAB_ALIAS: Record<StarTab, string[]> = {
  life: ['life', 'lifecycle', 'evolution', 'evolve'],
  hr: ['hr', 'hrdiagram', 'hertzsprung', 'hertzsprungrussell', 'diagram'],
  binary: ['binary', 'binaries', 'pairs', 'orbit'],
  parallax: ['parallax', 'distance', 'distances', 'parsec'],
  candles: ['candles', 'standardcandles', 'candle', 'cepheid', 'supernova', 'ladder'],
  hubble: ['hubble', 'redshift', 'hubbleslaw', 'galaxies', 'spectrum'],
  fate: ['fate', 'darkmatter', 'cosmology', 'universe', 'rotation', 'darkenergy'],
  practice: ['practice', 'quiz', 'questions'],
};
export function matchTab(q: string): StarTab {
  const k = norm(q);
  for (const [tab, aliases] of Object.entries(TAB_ALIAS) as [StarTab, string[]][]) {
    if (aliases.includes(k)) return tab;
  }
  const sub = (Object.keys(TAB_ALIAS) as StarTab[]).filter((t) => TAB_ALIAS[t].some((a) => k.length >= 3 && (a.includes(k) || k.includes(a))));
  return uniqueOr(sub, 'tab', q, 'Valid tabs: life, hr, binary, parallax, candles, hubble, fate, practice.');
}

/** Match a stage on a given star's track by id or loose name. */
export function matchStage(tr: Track, q: string): number {
  const k = norm(q);
  const valid = () => `Stages for ${short(tr.M, 2)} M☉: ${tr.stages.map((s) => `${s.name} (${s.id})`).join(', ')}.`;
  if (!k) throw new Error('Specify a stage. ' + valid());
  const ALIAS: Record<string, string[]> = {
    cloud: ['cloud', 'nebula', 'gascloud'],
    protostar: ['protostar', 'proto'],
    ms: ['ms', 'mainsequence', 'bluesupergiant', 'reddwarf'],
    bdw: ['bdw', 'browndwarf'],
    giant: ['giant', 'redgiant', 'rg'],
    cep: ['cep', 'cepheid', 'cepheidvariable'],
    giant2: ['giant2', 'redgiantagain', 'secondgiant', 'agb'],
    pn: ['pn', 'planetarynebula', 'planetary'],
    wd: ['wd', 'whitedwarf'],
    bd: ['bd', 'blackdwarf'],
    rg: ['rg', 'redgiant'],
    rsg: ['rsg', 'redsupergiant', 'supergiant'],
    sn: ['sn', 'supernova', 'typeii'],
    ns: ['ns', 'neutronstar', 'neutron', 'pulsar'],
    bh: ['bh', 'blackhole'],
  };
  const exact = tr.stages.map((s, i) => ({ s, i })).filter(({ s }) => norm(s.id) === k || norm(s.name) === k || (ALIAS[s.id] ?? []).includes(k));
  if (exact.length === 1) return exact[0].i;
  if (exact.length > 1) return exact[0].i;
  const sub = k.length >= 3 ? tr.stages.map((s, i) => ({ s, i })).filter(({ s }) => norm(s.name).includes(k) || (ALIAS[s.id] ?? []).some((a) => a.includes(k))) : [];
  if (sub.length) return sub[0].i;
  throw new Error(`No stage "${q}" on the ${short(tr.M, 2)} M☉ track. ${valid()}`);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function parseMonth(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return ((v % 12) + 12) % 12;
  const s = String(v ?? '').trim().toLowerCase();
  const n = Number(s);
  if (s && Number.isFinite(n)) return ((n % 12) + 12) % 12;
  const idx = MONTHS.findIndex((m) => s.startsWith(m));
  if (idx >= 0) return idx;
  throw new Error(`Month "${v}" not understood. Use 0–11.99 or a month name (Jan–Dec).`);
}

export function clampMass(v: unknown): number {
  const m = Number(v);
  if (!Number.isFinite(m) || m <= 0) throw new Error(`mass must be a positive number in solar masses (${MMIN}–${MMAX} M☉).`);
  if (m < MMIN || m > MMAX) throw new Error(`mass must be between ${MMIN} and ${MMAX} M☉ (got ${m}).`);
  return m;
}

/* ---------- plain-text summaries of each tab ---------- */

export function summarizeLife(M: number, x: number, speed: number, playing: boolean): string {
  const tr = track(M), now = at(tr, x), bnds = bounds(tr);
  const seq = tr.stages.map((s) => `${s.name} (${s.visual === 'blackhole' || s.visual === 'blackdwarf' ? 'indefinite' : years(s.dur)})`).join(' → ');
  const hasT = isFinite(now.T) && now.stage.visual !== 'cloud';
  const lines = [
    `Life cycle: ${short(M, 2)} M☉ (${FATE_NAME[tr.fate]}), ends as a ${FATE_END[tr.fate]}.`,
    `Stages: ${seq}.`,
    `Lifetime to remnant: ${years(tr.life)}${tr.msLife ? ` (main sequence ${years(tr.msLife)}, ${Math.round((tr.msLife / tr.life) * 100)}%)` : ' (never reaches the main sequence)'}.`,
    `Now at: ${now.stage.name} (${Math.round(x * 100)}% along timeline, age ${years(now.age)}${now.stage.future ? ', in the far future' : ''})${playing ? `, playing at ×${speed}` : ', paused'}.`,
  ];
  if (hasT) {
    lines.push(`Readings: T = ${sci(now.T)} K (class ${spectral(now.T)}), L = ${sci(now.L)} L☉ (${sci(now.L * LSUN)} W), R = ${sci(now.R)} R☉ (${sci(now.R * RSUN)} m), λ_max = ${now.T > 1e5 ? sci(peak(now.T) * 1e9) : plain(peak(now.T) * 1e9)} nm.`);
  } else if (now.stage.visual === 'cloud') {
    lines.push(`Readings: T ≈ ${Math.round(now.T)} K, λ_max = ${plain(peak(now.T) * 1e6)} µm.`);
  } else {
    lines.push(`Remnant: ${tr.remnant.name}, mass ${short(tr.remnant.M, 2)} M☉, ${now.stage.visual === 'blackhole' ? 'event horizon radius' : 'radius'} ${Math.round(tr.remnant.Rkm ?? 0)} km.`);
  }
  if (now.stage.period) lines.push(`Cepheid pulsation period: ${plain(now.stage.period, 2)} days.`);
  lines.push(`What is happening: ${now.stage.what}`);
  lines.push(`Physics: ${now.stage.why}`);
  void bnds;
  return lines.join('\n');
}

export function summarizeHR(selId: string, vsId: string, opts: { regions: boolean; radii: boolean; tracks: boolean; labels: boolean; norm: boolean }): string {
  const s = STARS.find((x) => x.id === selId) ?? STARS[0];
  const v = STARS.find((x) => x.id === vsId) ?? STARS[0];
  const L = lumOf(s), Lv = lumOf(v), Lw = L * LSUN, Rm = s.R * RSUN;
  const I = s.d ? Lw / (4 * Math.PI * (s.d * PC) ** 2) : 1361;
  const rT = s.T / v.T, rL = L / Lv, rR = s.R / v.R;
  const lines = [
    `HR diagram: selected ${s.name} (${GROUP_NAME[s.group]}, ${s.type}, ${s.where}).`,
    `Numbers: T = ${sci(s.T, 3, 1e-3, 1e6)} K (class ${spectral(s.T)}), L = ${sci(L)} L☉ (${sci(Lw)} W), R = ${sci(s.R)} R☉ (${sci(Rm)} m), M = ${short(s.M)} M☉ (${sci(s.M * MSUN)} kg), λ_max = ${plain(peak(s.T) * 1e9)} nm (${sci(peak(s.T))} m).`,
    s.d
      ? `Distance: ${short(s.d)} pc = ${sci(s.d * PC)} m = ${short((s.d * PC) / LY)} ly; parallax p = ${plain(1 / s.d)}″; received intensity I = ${sci(I)} W m⁻².`
      : `At Earth (1 AU): I = 1361 W m⁻² (the solar constant).`,
  ];
  if (s.cepheid) lines.push(`Cepheid period: ${s.cepheid} days → L = ${sci(cepheidL(s.cepheid))} L☉.`);
  lines.push(
    `Note: ${s.note}`,
    `Compared with ${v.name}: T₁/T₂ = ${plain(rT)}, L₁/L₂ = ${sci(rL)}, r₁/r₂ = √(L₁/L₂)·(T₂/T₁)² = ${sci(rR)}, λ_peak ratio = ${plain(1 / rT)}.`,
    `Overlays: regions ${opts.regions ? 'on' : 'off'}, equal-radius lines ${opts.radii ? 'on' : 'off'}, life tracks ${opts.tracks ? 'on' : 'off'}, names ${opts.labels ? 'on' : 'off'}, black-body curves ${opts.norm ? 'normalised to each peak' : 'same scale'}.`,
  );
  return lines.join('\n');
}

export function summarizeBinary(sysId: string, earth: boolean, phi: number, speed: number, playing: boolean, feed: number, boom: number): string {
  const s = SYSTEMS.find((x) => x.id === sysId) ?? SYSTEMS[0];
  const Py = periodYears(s), Ps = periodSeconds(s);
  const Pstr = Py < 1 ? `${plain(Py * 365.25)} days` : `${plain(Py)} years`;
  const v = speeds(s), rv = radial(s, phi), lam = shifted(s, phi), Mtot = massFromOrbit(s), rs = radii(s);
  const lines = [
    `Binaries: ${s.name} (${s.label}), view: ${earth ? 'from Earth' : 'free 3D'}, phase φ = ${phi.toFixed(2)}, ${playing ? `playing at ×${speed}` : 'paused'}.`,
    `Orbit: period P = ${Pstr} (${sci(Ps)} s), separation a = ${plain(s.a)} AU, inclination ${s.inc}°.`,
    `Bodies: ${s.bodies.map((b, k) => `${b.name} (${short(b.M)} M☉, v = ${plain(v[k] / 1e3)} km s⁻¹, v_radial = ${plain(rv[k] / 1e3)} km s⁻¹, Hα = ${plain(lam[k], 5)} nm vs ${HALPHA} nm)`).join('; ')}.`,
    `Relative brightness at φ = ${phi.toFixed(2)}: ${plain(brightness(s, phi))}.`,
  ];
  if (s.kind === 'typeIa') {
    lines.push(`Type Ia state: ${boom > 0 ? `exploded! Supernova light curve at day ${Math.round(boom * 120)} (peak L ≈ ${sci(SN_IA_L)} L☉)` : `white dwarf mass ${plain(1.2 + 0.2 * feed)} M☉ climbing towards 1.40 M☉ Chandrasekhar limit`}.`);
  } else {
    lines.push(`Kepler / Newton working: M₁ + M₂ = 4π²a³ / GP² = ${sci(Mtot)} kg = ${plain(Mtot / MSUN)} M☉; M₁/M₂ = r₂/r₁ = v₂/v₁ = ${plain(rs[1] / rs[0])}.`);
  }
  lines.push(`Summary: ${s.what}`);
  return lines.join('\n');
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function summarizeParallax(starId: string, customD: number, month: number, orbiting: boolean): string {
  const custom = starId === 'custom';
  const st = custom ? undefined : STARS.find((x) => x.id === starId);
  const d = custom ? customD : st?.d ?? 1.3;
  const p = 1 / d;
  const pRad = (p / 3600) * (Math.PI / 180);
  const fmtP = p >= 0.01 ? `${plain(p)}″` : `${plain(p * 1000)} mas`;
  const limit = p < 1e-5 ? 'too small even for Gaia' : p < 0.01 ? 'needs a space telescope such as Gaia' : 'measurable from the ground';
  return [
    `Parallax: ${custom ? `custom distance (${short(d)} pc)` : `${st?.name ?? starId} (${short(d)} pc)`}, month: ${MONTH_NAMES[Math.floor(month) % 12]} (${month.toFixed(1)})${orbiting ? ', Earth orbiting' : ''}.`,
    `Parallax angle p = ${fmtP} = ${sci(p / 3600, 3)}° = ${sci(pRad)} rad (6-month total shift 2p = ${p >= 0.005 ? `${plain(2 * p)}″` : `${plain(2 * p * 1000)} mas`}).`,
    `Distance: d = 1 / p(″) = 1 / ${plain(p)} = ${short(d)} pc = ${sci(d * PC)} m = ${short((d * PC) / LY)} light-years.`,
    `Trig working: d = 1 AU / tan p = ${sci(AU)} / tan(${sci(p / 3600, 3)}°) = ${sci(AU / Math.tan(pRad))} m.`,
    `Observability: ${limit}.`,
  ].join('\n');
}
