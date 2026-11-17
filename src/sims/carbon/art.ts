/* Carbon Alchemy drawings, as SVG strings: the transmutation sigil, the unknown's sample bottle, test tubes for
   each identification test (animated by the .tt / .go classes in carbon.css) and lab apparatus. Drawn, never
   photographed (design book §11). Colours inside the white-tile drawings stay fixed so they read true in every theme. */

import { TESTS, type TestResult } from './data';

const D2R = Math.PI / 180;

export const SIGIL = `<svg class="sigil" viewBox="0 0 400 400" aria-hidden="true" fill="none" stroke="currentColor">
  <g class="s1"><circle cx="200" cy="200" r="190" stroke-width="1"/><circle cx="200" cy="200" r="178" stroke-width="5" stroke-dasharray="1 9.33" opacity=".8"/>
  ${Array.from({ length: 12 }, (_, i) => { const a = i * 30 * D2R; return `<circle cx="${(200 + 184 * Math.cos(a)).toFixed(1)}" cy="${(200 + 184 * Math.sin(a)).toFixed(1)}" r="3.2" fill="currentColor" stroke="none"/>`; }).join('')}</g>
  <g class="s2"><circle cx="200" cy="200" r="150" stroke-width="1" stroke-dasharray="3 6"/><path d="M200 50 L330 275 L70 275Z M200 350 L70 125 L330 125Z" stroke-width="1" opacity=".55"/></g>
  <g class="s3"><path d="M200 82 L302 141 L302 259 L200 318 L98 259 L98 141Z" stroke-width="1.6"/><circle cx="200" cy="200" r="70" stroke-width="1.2"/>
  ${Array.from({ length: 6 }, (_, i) => { const a = (i * 60 - 90) * D2R; return `<circle cx="${(200 + 118 * Math.cos(a)).toFixed(1)}" cy="${(200 + 118 * Math.sin(a)).toFixed(1)}" r="5" fill="currentColor" stroke="none"/>`; }).join('')}</g></svg>`;
export function bottleSVG() {
  return `<svg width="44" height="70" viewBox="0 0 44 70" aria-hidden="true"><path d="M16 4h12v14l10 12v34a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V30l10-12z" fill="#e9eef0" stroke="#33424a" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.5 40h29v24a2.5 2.5 0 0 1-2.5 2.5H10a2.5 2.5 0 0 1-2.5-2.5z" fill="#cfd9de"/><rect x="11" y="34" width="22" height="14" rx="2" fill="#fff" stroke="#33424a" stroke-width="1"/><text x="22" y="44" text-anchor="middle" font-family="PT Serif,serif" font-weight="700" font-size="11" fill="#33424a">?</text></svg>`;
}
export function tubeSVG(tid: string, res: TestResult) {
  const T = TESTS.find(t => t.id === tid)!, v = res.vis || {};
  const c0 = T.from, c1 = v.to || c0;
  const liq = tid === 'litmus' || tid === 'smell' ? '#e9eef0' : c0;
  let s = `<svg width="64" height="150" viewBox="0 0 64 150" aria-hidden="true">`;
  if (v.paper) s += `<rect x="16" y="2" width="9" height="30" rx="1.5" class="pap" style="--p0:${v.paper[0]};--p1:${v.paper[1]}" stroke="#33424a" stroke-width=".8"/><line x1="20.5" y1="32" x2="20.5" y2="40" stroke="#33424a" stroke-width=".8"/>`;
  if (v.fumes || v.waft) s += `<g class="${v.waft ? 'waft' : 'fum'}" fill="none" stroke="${v.waft ? '#8aa0aa' : '#c9d4d9'}" stroke-width="${v.waft ? 1.4 : 4}" stroke-linecap="round">${[0, 1, 2].map(i => `<path style="--d:${i * .6}" d="M${24 + i * 8} 34 q-4 -6 0 -12 q4 -6 0 -12"/>`).join('')}</g>`;
  s += `<path class="liq" style="--c0:${liq};--c1:${tid === 'litmus' || tid === 'smell' ? liq : c1}" d="M19.5 80H44.5V128a12.5 12.5 0 0 1-25 0Z"/>`;
  if (v.ppt) s += `<g class="ppt" fill="${v.ppt}">${Array.from({ length: 26 }, (_, i) => { const a = i * 2.4, rr = 1.6 + (i % 3) * .6; const x = 32 + Math.cos(a) * (3 + i * .38) * .95, y = 136 - Math.abs(Math.sin(a)) * (2 + i * .22); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr}"/>`; }).join('')}<path d="M21 130a11 11 0 0 0 22 0z" opacity=".9"/></g>`;
  if (v.mirror) s += `<g class="mir"><path d="M19.5 72V128a12.5 12.5 0 0 0 25 0V72" fill="none" stroke="#aeb7bd" stroke-width="4"/><path d="M21.5 74V126" stroke="#ffffff" stroke-width="1.6" opacity=".9"/><path d="M42.5 74V128" stroke="#7e8a91" stroke-width="1.2"/></g>`;
  if (v.bubbles) s += `<g class="bub" fill="none" stroke="#7d9aa6" stroke-width="1">${Array.from({ length: 9 }, (_, i) => `<circle style="--d:${(i * .17).toFixed(2)}" cx="${23 + (i * 7) % 18}" cy="${128 - (i % 3) * 6}" r="${1.4 + (i % 3) * .5}"/>`).join('')}</g>`;
  s += `<path d="M18 36V128a14 14 0 0 0 28 0V36" fill="none" stroke="#33424a" stroke-width="1.6"/><path d="M15.5 36h33" stroke="#33424a" stroke-width="1.6" stroke-linecap="round"/><path d="M22 44V124" stroke="#fff" stroke-width="2" opacity=".55" stroke-linecap="round"/>`;
  s += `</svg>`;
  return s;
}
export const APP: Record<string, string> = {
  reflux: `<svg class="appsvg" viewBox="0 0 150 175"><path class="gl" d="M52 8h16M54 8v94M66 8v94"/><path class="gl" d="M47 20h26v74H47z"/><path class="wat" d="M73 86h14M80 82l-0 0"/><path class="wat" d="M73 28h14"/><text class="wl" x="90" y="89">in</text><text class="wl" x="90" y="31">out</text>
    <path class="liq3" d="M42 134a20 20 0 0 0 36 0z"/><path class="gl" d="M54 102v12a22 22 0 1 0 12 0v-12"/><circle class="gran" cx="55" cy="140" r="1.6"/><circle class="gran" cx="63" cy="142" r="1.6"/><circle class="gran" cx="59" cy="137" r="1.4"/>
    <rect class="heat" x="34" y="160" width="52" height="9" rx="2"/><text class="lb2" x="92" y="167">heater</text><text class="lb2" x="4" y="56">condenser</text><path class="gl" d="M73 14l4 -4M77 10" /><text class="lb2" x="78" y="12">open</text></svg>`,
  distil: `<svg class="appsvg" viewBox="0 0 170 150"><path class="liq3" d="M18 112a18 18 0 0 0 32 0z"/><path class="gl" d="M28 82v8a20 20 0 1 0 12 0v-8"/><path class="gl" d="M28 82V50h12v32"/><path class="gl" d="M34 18v40"/><circle cx="34" cy="60" r="2.6" fill="#33424a"/><text class="lb2" x="40" y="22">thermometer</text>
    <path class="gl" d="M40 58l70 34"/><path class="gl" d="M54 58l66 32l-5 9l-66 -32z"/><path class="wat" d="M114 100l8 10"/><path class="wat" d="M58 57l-6 -10"/><text class="wl" x="120" y="122">in</text><text class="wl" x="44" y="44">out</text>
    <path class="gl" d="M114 96l12 6v6h14v-6"/><path class="gl" d="M124 112l-6 26h30l-6 -26z"/><path class="liq2" d="M120 130l-2 8h30l-2 -8z"/><rect class="heat" x="12" y="138" width="44" height="8" rx="2"/></svg>`,
  sepfun: `<svg class="appsvg" viewBox="0 0 150 170"><path class="gl" d="M68 6h14v8"/><path class="liq3" d="M44 70h62c-3 18-14 34-26 46h-10c-12-12-23-28-26-46z"/><path class="liq2" d="M49 92h52c-6 10-13 18-21 24h-10c-8-6-15-14-21-24z"/><path class="gl" d="M66 14h18v8c22 6 30 26 24 50c-4 18-16 34-28 44v14h-10v-14c-12-10-24-26-28-44c-6-24 2-44 24-50z"/><path class="gl" d="M64 132h22M75 140v18"/><circle class="gl" cx="75" cy="132" r="4"/>
    <text class="lb2" x="110" y="76">organic</text><text class="lb2" x="104" y="102">aqueous</text><text class="lb2" x="92" y="138">tap</text></svg>`,
  buchner: `<svg class="appsvg" viewBox="0 0 150 170"><path class="gl" d="M36 18h78l-6 30H42z"/><path class="gl" d="M44 40h62"/><path class="liq2" d="M44 34h62v6H44z"/><path class="gl" d="M68 48v14h14V48"/><path class="gl" d="M64 62h22l2 10"/><path class="gl" d="M58 72l-22 76h78l-22 -76z"/><path class="gl" d="M96 86h30"/><text class="lb2" x="104" y="80">to pump</text><text class="lb2" x="70" y="12">Büchner funnel</text><text class="lb2" x="52" y="140">side-arm flask</text></svg>`,
};

