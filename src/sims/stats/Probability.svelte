<script lang="ts" module>
  export type Venn2Query = 'none' | 'A' | 'B' | 'AB' | 'AuB' | 'notA' | 'Aonly' | 'AgivenB' | 'BgivenA' | 'notAgivenNotB';
  export type TreeSelect = 'bayes' | 'AB' | 'AnB' | 'nAB' | 'nAnB';

  export interface ProbPrefs {
    view: 'venn2' | 'venn3' | 'tree';
    onlyA: number;
    both: number;
    onlyB: number;
    highlight: Venn2Query;
    // 3-set regions
    v3: { a: number; b: number; c: number; ab: number; ac: number; bc: number; abc: number };
    v3Sel: Record<string, boolean>;
    // tree
    labelA: string;
    labelB: string;
    pA: number;
    pBgivenA: number;
    pBgivenNotA: number;
    treeSel: TreeSelect;
  }

  export const PROB_PREFS: ProbPrefs = {
    view: 'venn2',
    onlyA: 0.25,
    both: 0.15,
    onlyB: 0.30,
    highlight: 'AgivenB',
    v3: { a: 0.18, b: 0.14, c: 0.12, ab: 0.08, ac: 0.06, bc: 0.07, abc: 0.05 },
    v3Sel: { a: false, b: false, c: false, ab: true, ac: true, bc: false, abc: true, out: false },
    labelA: 'Condition',
    labelB: 'Test +',
    pA: 0.05,
    pBgivenA: 0.94,
    pBgivenNotA: 0.06,
    treeSel: 'bayes',
  };
</script>

<script lang="ts">
  import Seg from '../../components/ui/Seg.svelte';
  import TopicLinks from './TopicLinks.svelte';
  import { fmt, fmtTrim, venn2Stats, tree2Stats } from './math';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: ProbPrefs;
    hidden?: boolean;
    stats?: [string, string | number][];
  } = $props();

  const VIEW_OPTS = [
    ['venn2', '2-Set Venn', 'Venn 2'],
    ['venn3', '3-Set Venn', 'Venn 3'],
    ['tree', 'Tree & Bayes', 'Tree'],
  ] as const;

  const v2 = $derived.by(() => venn2Stats(prefs.onlyA, prefs.both, prefs.onlyB));
  const tr = $derived.by(() => tree2Stats(prefs.pA, prefs.pBgivenA, prefs.pBgivenNotA));

  // 3-set helpers
  const v3Sum = $derived(
    prefs.v3.a + prefs.v3.b + prefs.v3.c + prefs.v3.ab + prefs.v3.ac + prefs.v3.bc + prefs.v3.abc,
  );
  const v3Out = $derived(Math.max(0, +(1 - v3Sum).toFixed(4)));
  const v3Valid = $derived(v3Sum <= 1 + 1e-6 && Object.values(prefs.v3).every((x) => x >= -1e-6));
  const v3SelectedProb = $derived(
    (prefs.v3Sel.a ? prefs.v3.a : 0) +
    (prefs.v3Sel.b ? prefs.v3.b : 0) +
    (prefs.v3Sel.c ? prefs.v3.c : 0) +
    (prefs.v3Sel.ab ? prefs.v3.ab : 0) +
    (prefs.v3Sel.ac ? prefs.v3.ac : 0) +
    (prefs.v3Sel.bc ? prefs.v3.bc : 0) +
    (prefs.v3Sel.abc ? prefs.v3.abc : 0) +
    (prefs.v3Sel.out ? v3Out : 0),
  );

  function clampVenn2(which: 'onlyA' | 'both' | 'onlyB', nextVal: number) {
    const clean = Math.max(0, Math.min(1, +nextVal.toFixed(2)));
    const other =
      (which === 'onlyA' ? 0 : prefs.onlyA) +
      (which === 'both' ? 0 : prefs.both) +
      (which === 'onlyB' ? 0 : prefs.onlyB);
    prefs[which] = Math.min(clean, Math.max(0, +(1 - other).toFixed(2)));
  }

  function makeIndependent() {
    const pA = Math.min(0.95, Math.max(0.05, v2.pA || 0.4));
    const pB = Math.min(0.95, Math.max(0.05, v2.pB || 0.45));
    const both = +(pA * pB).toFixed(3);
    prefs.both = both;
    prefs.onlyA = +Math.max(0, pA - both).toFixed(3);
    prefs.onlyB = +Math.max(0, pB - both).toFixed(3);
  }

  function makeMutuallyExclusive() {
    prefs.both = 0;
    if (prefs.onlyA + prefs.onlyB > 1) {
      const s = prefs.onlyA + prefs.onlyB;
      prefs.onlyA = +(prefs.onlyA / s * 0.85).toFixed(2);
      prefs.onlyB = +(prefs.onlyB / s * 0.85).toFixed(2);
    }
  }

  const v2QueryMeta = $derived.by(() => {
    const q = prefs.highlight;
    const regionFlags = (r: 'onlyA' | 'both' | 'onlyB' | 'neither') => {
      if (q === 'A') return { num: r === 'onlyA' || r === 'both', den: false };
      if (q === 'B') return { num: r === 'both' || r === 'onlyB', den: false };
      if (q === 'AB') return { num: r === 'both', den: false };
      if (q === 'AuB') return { num: r !== 'neither', den: false };
      if (q === 'notA') return { num: r === 'onlyB' || r === 'neither', den: false };
      if (q === 'Aonly') return { num: r === 'onlyA', den: false };
      if (q === 'AgivenB') return { num: r === 'both', den: r === 'both' || r === 'onlyB' };
      if (q === 'BgivenA') return { num: r === 'both', den: r === 'onlyA' || r === 'both' };
      if (q === 'notAgivenNotB') return { num: r === 'neither', den: r === 'onlyA' || r === 'neither' };
      return { num: false, den: false };
    };
    const formulas: Record<Venn2Query, { label: string; value: number; eq: string }> = {
      none: { label: 'P(S)', value: 1, eq: 'Click any region or formula chip to highlight' },
      A: { label: 'P(A)', value: v2.pA, eq: `P(A) = ${fmtTrim(v2.onlyA, 3)} + ${fmtTrim(v2.both, 3)} = ${fmt(v2.pA, 4)}` },
      B: { label: 'P(B)', value: v2.pB, eq: `P(B) = ${fmtTrim(v2.both, 3)} + ${fmtTrim(v2.onlyB, 3)} = ${fmt(v2.pB, 4)}` },
      AB: { label: 'P(A ∩ B)', value: v2.both, eq: `P(A ∩ B) = ${fmt(v2.both, 4)}` },
      AuB: { label: 'P(A ∪ B)', value: v2.pUnion, eq: `P(A ∪ B) = P(A) + P(B) − P(A ∩ B) = ${fmt(v2.pA, 3)} + ${fmt(v2.pB, 3)} − ${fmt(v2.both, 3)} = ${fmt(v2.pUnion, 4)}` },
      notA: { label: "P(A')", value: 1 - v2.pA, eq: `P(A') = 1 − P(A) = ${fmt(1 - v2.pA, 4)}` },
      Aonly: { label: "P(A ∩ B')", value: v2.onlyA, eq: `P(A ∩ B') = ${fmt(v2.onlyA, 4)}` },
      AgivenB: { label: 'P(A | B)', value: v2.pAgivenB, eq: `P(A | B) = P(A ∩ B) / P(B) = ${fmt(v2.both, 3)} / ${fmt(v2.pB, 3)} = ${fmt(v2.pAgivenB, 4)}` },
      BgivenA: { label: 'P(B | A)', value: v2.pBgivenA, eq: `P(B | A) = P(A ∩ B) / P(A) = ${fmt(v2.both, 3)} / ${fmt(v2.pA, 3)} = ${fmt(v2.pBgivenA, 4)}` },
      notAgivenNotB: { label: "P(A' | B')", value: v2.pNotAgivenNotB, eq: `P(A' | B') = P(A' ∩ B') / P(B') = ${fmt(v2.neither, 3)} / ${fmt(1 - v2.pB, 3)} = ${fmt(v2.pNotAgivenNotB, 4)}` },
    };
    return { regionFlags, ...formulas[q] };
  });

  const v2Reg = $derived({
    fOut: v2QueryMeta.regionFlags('neither'),
    fA: v2QueryMeta.regionFlags('onlyA'),
    fB: v2QueryMeta.regionFlags('onlyB'),
    fAB: v2QueryMeta.regionFlags('both'),
  });

  const treeHi = $derived({
    hiAB: prefs.treeSel === 'AB' || prefs.treeSel === 'bayes',
    hiAnB: prefs.treeSel === 'AnB',
    hinAB: prefs.treeSel === 'nAB' || prefs.treeSel === 'bayes',
    hinAnB: prefs.treeSel === 'nAnB',
  });

  const actKey = (e: KeyboardEvent, fn: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
  };

  const TREE_PRESETS = [
    { id: 'med', label: 'Medical test (Bayes)', a: 'Disease', b: 'Pos', pA: 0.05, ba: 0.94, nba: 0.06 },
    { id: 'fac', label: 'Factory A & B', a: 'Machine A', b: 'Faulty', pA: 0.65, ba: 0.03, nba: 0.07 },
    { id: 'urn', label: 'Counters (no repl.)', a: '1st Red', b: '2nd Red', pA: 0.40, ba: 0.33, nba: 0.44 },
    { id: 'rain', label: 'Rain & late bus', a: 'Rain', b: 'Late', pA: 0.30, ba: 0.45, nba: 0.15 },
  ];

  $effect(() => {
    if (prefs.view === 'venn2') {
      stats = [
        ['P(A ∪ B)', fmt(v2.pUnion, 4)],
        ['P(A | B)', fmt(v2.pAgivenB, 4)],
        ['Independent?', v2.isIndependent ? 'Yes' : 'No'],
        ['Mutually excl.?', v2.isMutuallyExclusive ? 'Yes' : 'No'],
      ];
    } else if (prefs.view === 'venn3') {
      stats = [
        ['Selected prob', fmt(v3SelectedProb, 4)],
        ['P(A ∪ B ∪ C)', fmt(1 - v3Out, 4)],
        ['Outside', fmt(v3Out, 4)],
      ];
    } else {
      stats = [
        ['P(B)', fmt(tr.pB, 4)],
        ['P(A | B) Bayes', fmt(tr.pAgivenB, 4)],
        ['P(A ∩ B)', fmt(tr.pAB, 4)],
        ['Independent?', tr.isIndependent ? 'Yes' : 'No'],
      ];
    }
  });
</script>

<main class="layout st-two" hidden={off}>
  <section class="panel stage" aria-label="Venn and tree probability diagrams">
    <div class="stage-head">
      <div class="label-chip">
        {prefs.view === 'venn2' ? '2-Event Venn Diagram' : prefs.view === 'venn3' ? '3-Event Venn Diagram' : 'Probability Tree & Bayes’ Theorem'}
        <small>S1 · WST01</small>
      </div>
      <div class="stage-tools">
        <Seg label="Probability diagram" options={VIEW_OPTS} bind:value={prefs.view} />
      </div>
    </div>

    {#if prefs.view === 'tree'}
      <div class="st-presets">
        <small>Presets</small>
        {#each TREE_PRESETS as pr (pr.id)}
          <button type="button" class="chip" onclick={() => { prefs.labelA = pr.a; prefs.labelB = pr.b; prefs.pA = pr.pA; prefs.pBgivenA = pr.ba; prefs.pBgivenNotA = pr.nba; }}>{pr.label}</button>
        {/each}
      </div>
    {/if}

    <div class="st-board">
      {#if prefs.view === 'venn2'}
        <svg class="st-svg" viewBox="0 0 560 300" role="img" aria-label="2-set Venn diagram">
          <defs>
            <clipPath id="st-clip-a"><circle cx="215" cy="150" r="102" /></clipPath>
            <clipPath id="st-clip-b"><circle cx="345" cy="150" r="102" /></clipPath>
            <mask id="st-mask-onlyA">
              <rect width="560" height="300" fill="black" />
              <circle cx="215" cy="150" r="102" fill="white" />
              <circle cx="345" cy="150" r="102" fill="black" />
            </mask>
            <mask id="st-mask-onlyB">
              <rect width="560" height="300" fill="black" />
              <circle cx="345" cy="150" r="102" fill="white" />
              <circle cx="215" cy="150" r="102" fill="black" />
            </mask>
            <mask id="st-mask-neither">
              <rect width="560" height="300" fill="white" />
              <circle cx="215" cy="150" r="102" fill="black" />
              <circle cx="345" cy="150" r="102" fill="black" />
            </mask>
          </defs>

          <!-- Sample space S -->
          <rect
            class="venn-reg"
            x="24" y="20" width="512" height="260" rx="14"
            fill={v2Reg.fOut.num ? 'color-mix(in srgb, var(--accent) 26%, transparent)' : v2Reg.fOut.den ? 'color-mix(in srgb, var(--amph) 18%, transparent)' : 'var(--surf)'}
            stroke="var(--ink)" stroke-opacity=".45" stroke-width="2"
            mask="url(#st-mask-neither)"
            role="button"
            tabindex="0"
            aria-label="Highlight region outside A union B"
            onclick={() => (prefs.highlight = 'notAgivenNotB')}
            onkeydown={(e) => actKey(e, () => (prefs.highlight = 'notAgivenNotB'))}
          />
          <rect x="24" y="20" width="512" height="260" rx="14" fill="none" stroke="var(--ink)" stroke-opacity=".45" stroke-width="2" pointer-events="none" />

          <!-- Only A -->
          <rect
            class="venn-reg"
            x="0" y="0" width="560" height="300"
            fill={v2Reg.fA.num ? 'color-mix(in srgb, var(--accent) 36%, transparent)' : v2Reg.fA.den ? 'color-mix(in srgb, var(--amph) 20%, transparent)' : 'color-mix(in srgb, var(--cond) 10%, transparent)'}
            mask="url(#st-mask-onlyA)"
            role="button"
            tabindex="0"
            aria-label="Highlight A only"
            onclick={() => (prefs.highlight = 'Aonly')}
            onkeydown={(e) => actKey(e, () => (prefs.highlight = 'Aonly'))}
          />

          <!-- Only B -->
          <rect
            class="venn-reg"
            x="0" y="0" width="560" height="300"
            fill={v2Reg.fB.num ? 'color-mix(in srgb, var(--accent) 36%, transparent)' : v2Reg.fB.den ? 'color-mix(in srgb, var(--amph) 20%, transparent)' : 'color-mix(in srgb, var(--ligand) 10%, transparent)'}
            mask="url(#st-mask-onlyB)"
            role="button"
            tabindex="0"
            aria-label="Highlight B"
            onclick={() => (prefs.highlight = 'B')}
            onkeydown={(e) => actKey(e, () => (prefs.highlight = 'B'))}
          />

          <!-- Intersection A ∩ B -->
          <circle
            class="venn-reg"
            cx="345" cy="150" r="102"
            clip-path="url(#st-clip-a)"
            fill={v2Reg.fAB.num ? 'color-mix(in srgb, var(--accent) 55%, transparent)' : v2Reg.fAB.den ? 'color-mix(in srgb, var(--amph) 28%, transparent)' : 'color-mix(in srgb, var(--good) 14%, transparent)'}
            role="button"
            tabindex="0"
            aria-label="Highlight A intersect B"
            onclick={() => (prefs.highlight = 'AB')}
            onkeydown={(e) => actKey(e, () => (prefs.highlight = 'AB'))}
          />

          <!-- Circle outlines & labels -->
          <circle cx="215" cy="150" r="102" fill="none" stroke="var(--cond)" stroke-width="2.6" pointer-events="none" />
          <circle cx="345" cy="150" r="102" fill="none" stroke="var(--ligand)" stroke-width="2.6" pointer-events="none" />
          <text x="40" y="46" font-weight="800" font-size="16" fill="var(--muted)">S (total = 1)</text>
          <text x="148" y="48" font-weight="800" font-size="17" fill="var(--cond)">A</text>
          <text x="398" y="48" font-weight="800" font-size="17" fill="var(--ligand)">B</text>

          <text x="165" y="154" text-anchor="middle" font-family="var(--f-mono)" font-weight="700" font-size="18" fill="var(--ink)" pointer-events="none">{fmtTrim(v2.onlyA, 3)}</text>
          <text x="280" y="154" text-anchor="middle" font-family="var(--f-mono)" font-weight="700" font-size="18" fill="var(--ink)" pointer-events="none">{fmtTrim(v2.both, 3)}</text>
          <text x="395" y="154" text-anchor="middle" font-family="var(--f-mono)" font-weight="700" font-size="18" fill="var(--ink)" pointer-events="none">{fmtTrim(v2.onlyB, 3)}</text>
          <text x="486" y="258" text-anchor="end" font-family="var(--f-mono)" font-weight="700" font-size="16" fill="var(--muted)" pointer-events="none">neither = {fmtTrim(v2.neither, 3)}</text>
        </svg>

      {:else if prefs.view === 'venn3'}
        <svg class="st-svg" viewBox="0 0 560 330" role="img" aria-label="3-set Venn diagram">
          <rect x="24" y="14" width="512" height="302" rx="14" fill="var(--surf)" stroke="var(--ink)" stroke-opacity=".45" stroke-width="2" />
          <circle cx="230" cy="135" r="88" fill="color-mix(in srgb, var(--cond) 12%, transparent)" stroke="var(--cond)" stroke-width="2.4" />
          <circle cx="330" cy="135" r="88" fill="color-mix(in srgb, var(--accent) 12%, transparent)" stroke="var(--accent)" stroke-width="2.4" />
          <circle cx="280" cy="212" r="88" fill="color-mix(in srgb, var(--ligand) 12%, transparent)" stroke="var(--ligand)" stroke-width="2.4" />

          <text x="40" y="38" font-weight="800" font-size="15" fill="var(--muted)">S</text>
          <text x="150" y="54" font-weight="800" font-size="16" fill="var(--cond)">A</text>
          <text x="404" y="54" font-weight="800" font-size="16" fill="var(--accent)">B</text>
          <text x="372" y="285" font-weight="800" font-size="16" fill="var(--ligand)">C</text>

          {#each [
            ['a', 192, 114, prefs.v3.a],
            ['b', 368, 114, prefs.v3.b],
            ['c', 280, 260, prefs.v3.c],
            ['ab', 280, 102, prefs.v3.ab],
            ['ac', 226, 194, prefs.v3.ac],
            ['bc', 334, 194, prefs.v3.bc],
            ['abc', 280, 158, prefs.v3.abc],
            ['out', 485, 294, v3Out],
          ] as [key, rx, ry, val] (key)}
            <g
              class="venn-reg"
              role="button"
              tabindex="0"
              aria-label={`Toggle 3-set region ${key}`}
              onclick={() => (prefs.v3Sel[key as string] = !prefs.v3Sel[key as string])}
              onkeydown={(e) => actKey(e, () => (prefs.v3Sel[key as string] = !prefs.v3Sel[key as string]))}
            >
              <rect
                x={(rx as number) - 24} y={(ry as number) - 14} width="48" height="26" rx="13"
                fill={prefs.v3Sel[key as string] ? 'var(--accent)' : 'var(--raised)'}
                stroke={prefs.v3Sel[key as string] ? 'var(--accent)' : 'var(--line)'}
                stroke-width="1.5"
              />
              <text
                x={rx as number} y={(ry as number) + 3}
                text-anchor="middle"
                font-family="var(--f-mono)" font-weight="700" font-size="12.5"
                fill={prefs.v3Sel[key as string] ? 'var(--accent-ink)' : 'var(--ink)'}
              >{fmtTrim(val as number, 2)}</text>
            </g>
          {/each}
        </svg>

      {:else}
        <svg class="st-svg" viewBox="0 0 640 310" role="img" aria-label="2-stage probability tree">
          <!-- Level 1 -->
          <line x1="60" y1="155" x2="235" y2="85" stroke={treeHi.hiAB || treeHi.hiAnB ? 'var(--accent)' : 'var(--ink)'} stroke-opacity={treeHi.hiAB || treeHi.hiAnB ? 1 : 0.45} stroke-width={treeHi.hiAB || treeHi.hiAnB ? 3.5 : 2} />
          <line x1="60" y1="155" x2="235" y2="225" stroke={treeHi.hinAB || treeHi.hinAnB ? 'var(--accent)' : 'var(--ink)'} stroke-opacity={treeHi.hinAB || treeHi.hinAnB ? 1 : 0.45} stroke-width={treeHi.hinAB || treeHi.hinAnB ? 3.5 : 2} />

          <!-- Level 2 -->
          <line x1="255" y1="85" x2="455" y2="48" stroke={treeHi.hiAB ? 'var(--good)' : 'var(--ink)'} stroke-opacity={treeHi.hiAB ? 1 : 0.4} stroke-width={treeHi.hiAB ? 3.5 : 2} />
          <line x1="255" y1="85" x2="455" y2="122" stroke={treeHi.hiAnB ? 'var(--good)' : 'var(--ink)'} stroke-opacity={treeHi.hiAnB ? 1 : 0.4} stroke-width={treeHi.hiAnB ? 3.5 : 2} />
          <line x1="255" y1="225" x2="455" y2="188" stroke={treeHi.hinAB ? 'var(--amph)' : 'var(--ink)'} stroke-opacity={treeHi.hinAB ? 1 : 0.4} stroke-width={treeHi.hinAB ? 3.5 : 2} />
          <line x1="255" y1="225" x2="455" y2="262" stroke={treeHi.hinAnB ? 'var(--good)' : 'var(--ink)'} stroke-opacity={treeHi.hinAnB ? 1 : 0.4} stroke-width={treeHi.hinAnB ? 3.5 : 2} />

          <!-- Edge probabilities -->
          <text x="142" y="106" text-anchor="middle" font-family="var(--f-mono)" font-weight="700" font-size="12" fill="var(--ink)">{fmtTrim(tr.pA, 3)}</text>
          <text x="142" y="212" text-anchor="middle" font-family="var(--f-mono)" font-weight="700" font-size="12" fill="var(--muted)">{fmtTrim(tr.pNotA, 3)}</text>

          <text x="355" y="54" text-anchor="middle" font-family="var(--f-mono)" font-weight="700" font-size="12" fill="var(--ink)">{fmtTrim(tr.pBgivenA, 3)}</text>
          <text x="355" y="116" text-anchor="middle" font-family="var(--f-mono)" font-weight="700" font-size="12" fill="var(--muted)">{fmtTrim(tr.pNotBgivenA, 3)}</text>
          <text x="355" y="194" text-anchor="middle" font-family="var(--f-mono)" font-weight="700" font-size="12" fill="var(--ink)">{fmtTrim(tr.pBgivenNotA, 3)}</text>
          <text x="355" y="256" text-anchor="middle" font-family="var(--f-mono)" font-weight="700" font-size="12" fill="var(--muted)">{fmtTrim(tr.pNotBgivenNotA, 3)}</text>

          <!-- Nodes -->
          <circle cx="60" cy="155" r="7" fill="var(--surf)" stroke="var(--ink)" stroke-width="2" />
          <g>
            <circle cx="245" cy="85" r="14" fill="var(--surf)" stroke="var(--cond)" stroke-width="2.2" />
            <text x="245" y="89" text-anchor="middle" font-weight="700" font-size="12" fill="var(--ink)">A</text>
          </g>
          <g>
            <circle cx="245" cy="225" r="14" fill="var(--surf)" stroke="var(--muted)" stroke-width="2" />
            <text x="245" y="229" text-anchor="middle" font-weight="700" font-size="12" fill="var(--ink)">A'</text>
          </g>

          <!-- Leaves -->
          {#each [
            ['AB', 48, 'B', `P(A∩B) = ${fmt(tr.pAB, 4)}`, treeHi.hiAB],
            ['AnB', 122, "B'", `P(A∩B') = ${fmt(tr.pAnB, 4)}`, treeHi.hiAnB],
            ['nAB', 188, 'B', `P(A'∩B) = ${fmt(tr.pnAB, 4)}`, treeHi.hinAB],
            ['nAnB', 262, "B'", `P(A'∩B') = ${fmt(tr.pnAnB, 4)}`, treeHi.hinAnB],
          ] as [id, ly, sym, txt, active] (id)}
            <g
              class="venn-reg"
              role="button"
              tabindex="0"
              aria-label={`Select tree leaf ${id}`}
              onclick={() => (prefs.treeSel = id as TreeSelect)}
              onkeydown={(e) => actKey(e, () => (prefs.treeSel = id as TreeSelect))}
            >
              <circle cx="465" cy={ly as number} r="13" fill={active ? 'var(--accent-soft)' : 'var(--surf)'} stroke={active ? 'var(--accent)' : 'var(--line)'} stroke-width="2" />
              <text x="465" y={(ly as number) + 4} text-anchor="middle" font-weight="700" font-size="11.5" fill="var(--ink)">{sym}</text>
              <text x="488" y={(ly as number) + 4} font-family="var(--f-mono)" font-weight="700" font-size="12.5" fill={active ? 'var(--ink)' : 'var(--muted)'}>{txt}</text>
            </g>
          {/each}
        </svg>
      {/if}

      <div class="st-key">
        {#if prefs.view === 'venn2'}
          <span><i class="k on"></i> Numerator region</span>
          <span><i class="k approx"></i> Conditioning event (denominator)</span>
        {:else if prefs.view === 'venn3'}
          <span>Click any region pill to include/exclude it in your custom union probability</span>
        {:else}
          <span>A = {prefs.labelA}, B = {prefs.labelB} · Click any leaf or Bayes button to highlight paths</span>
        {/if}
      </div>
    </div>

    <div class="st-card" style="margin-top:12px">
      {#if prefs.view === 'venn2'}
        <h3>{v2QueryMeta.label} = {fmt(v2QueryMeta.value, 4)}</h3>
        <div class="eq">{v2QueryMeta.eq}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
          <span class="st-pill {v2.isIndependent ? 'ok' : 'warn'}">
            {v2.isIndependent ? 'Independent' : 'Not independent'} (P(A)P(B) = {fmt(v2.indepProduct, 4)} vs {fmt(v2.both, 4)})
          </span>
          <span class="st-pill {v2.isMutuallyExclusive ? 'ok' : 'warn'}">
            {v2.isMutuallyExclusive ? 'Mutually exclusive (P(A ∩ B) = 0)' : 'Not mutually exclusive'}
          </span>
        </div>
      {:else if prefs.view === 'venn3'}
        <h3>3-Set Breakdown</h3>
        <div class="eq">Selected sum = {fmt(v3SelectedProb, 4)} · P(A ∪ B ∪ C) = {fmt(v3Sum, 4)} · Outside = {fmt(v3Out, 4)}</div>
      {:else}
        <h3>Bayes’ Theorem Working</h3>
        <ul class="st-work">
          <li><b>Total B</b><span>P(B) = P(A ∩ B) + P(A' ∩ B) = {fmt(tr.pAB, 4)} + {fmt(tr.pnAB, 4)} = {fmt(tr.pB, 4)}</span></li>
          <li><b>Bayes</b><span>P(A | B) = P(A ∩ B) / P(B) = {fmt(tr.pAB, 4)} / {fmt(tr.pB, 4)} = {fmt(tr.pAgivenB, 4)}</span></li>
          <li><b>Reverse</b><span>P(A | B') = {fmt(tr.pAnB, 4)} / {fmt(tr.pNotB, 4)} = {fmt(tr.pAgivenNotB, 4)}</span></li>
        </ul>
      {/if}
    </div>
  </section>

  <aside class="panel side" aria-label="Probability controls">
    <div class="ph"><h2>Probability Setup</h2></div>
    <div class="ctls">
      {#if prefs.view === 'venn2'}
        <label class="ctl">
          <span class="ctl-l">P(A only) = P(A ∩ B') <b>{fmtTrim(prefs.onlyA, 2)}</b></span>
          <input class="slider" type="range" min="0" max="0.9" step="0.01" value={prefs.onlyA} oninput={(e) => clampVenn2('onlyA', Number((e.currentTarget as HTMLInputElement).value))} />
        </label>
        <label class="ctl">
          <span class="ctl-l">P(A ∩ B) <b>{fmtTrim(prefs.both, 2)}</b></span>
          <input class="slider" type="range" min="0" max="0.9" step="0.01" value={prefs.both} oninput={(e) => clampVenn2('both', Number((e.currentTarget as HTMLInputElement).value))} />
        </label>
        <label class="ctl">
          <span class="ctl-l">P(B only) = P(A' ∩ B) <b>{fmtTrim(prefs.onlyB, 2)}</b></span>
          <input class="slider" type="range" min="0" max="0.9" step="0.01" value={prefs.onlyB} oninput={(e) => clampVenn2('onlyB', Number((e.currentTarget as HTMLInputElement).value))} />
        </label>

        <div class="st-presets" style="margin:0">
          <button type="button" class="btn sm" onclick={makeIndependent}>Make independent</button>
          <button type="button" class="btn sm" onclick={makeMutuallyExclusive}>Make mutually exclusive</button>
        </div>

        <div class="ctl">
          <span class="ctl-l">Highlight formula</span>
          <div class="st-presets" style="margin:0">
            {#each [
              ['A', 'P(A)'],
              ['B', 'P(B)'],
              ['AB', 'P(A ∩ B)'],
              ['AuB', 'P(A ∪ B)'],
              ['notA', "P(A')"],
              ['AgivenB', 'P(A | B)'],
              ['BgivenA', 'P(B | A)'],
              ['notAgivenNotB', "P(A' | B')"],
            ] as [qKey, qLabel] (qKey)}
              <button
                type="button"
                class="chip"
                aria-pressed={prefs.highlight === qKey}
                onclick={() => (prefs.highlight = qKey as Venn2Query)}
              >{qLabel}</button>
            {/each}
          </div>
        </div>

      {:else if prefs.view === 'venn3'}
        <div class="row2">
          <label class="ctl"><span class="ctl-l">A only</span><input class="inp" type="number" min="0" max="1" step="0.01" bind:value={prefs.v3.a} /></label>
          <label class="ctl"><span class="ctl-l">B only</span><input class="inp" type="number" min="0" max="1" step="0.01" bind:value={prefs.v3.b} /></label>
          <label class="ctl"><span class="ctl-l">C only</span><input class="inp" type="number" min="0" max="1" step="0.01" bind:value={prefs.v3.c} /></label>
          <label class="ctl"><span class="ctl-l">A∩B∩C'</span><input class="inp" type="number" min="0" max="1" step="0.01" bind:value={prefs.v3.ab} /></label>
          <label class="ctl"><span class="ctl-l">A∩C∩B'</span><input class="inp" type="number" min="0" max="1" step="0.01" bind:value={prefs.v3.ac} /></label>
          <label class="ctl"><span class="ctl-l">B∩C∩A'</span><input class="inp" type="number" min="0" max="1" step="0.01" bind:value={prefs.v3.bc} /></label>
          <label class="ctl"><span class="ctl-l">A∩B∩C</span><input class="inp" type="number" min="0" max="1" step="0.01" bind:value={prefs.v3.abc} /></label>
        </div>
        {#if !v3Valid}
          <p class="why" style="color:var(--redox)">Regions sum to {fmt(v3Sum, 3)} &gt; 1. Reduce values so total ≤ 1.</p>
        {/if}

      {:else}
        <div class="row2">
          <label class="ctl"><span class="ctl-l">Event A</span><input class="inp" type="text" bind:value={prefs.labelA} /></label>
          <label class="ctl"><span class="ctl-l">Event B</span><input class="inp" type="text" bind:value={prefs.labelB} /></label>
        </div>
        <label class="ctl">
          <span class="ctl-l">P(A) <b>{fmtTrim(prefs.pA, 2)}</b></span>
          <input class="slider" type="range" min="0.01" max="0.99" step="0.01" bind:value={prefs.pA} />
        </label>
        <label class="ctl">
          <span class="ctl-l">P(B | A) <b>{fmtTrim(prefs.pBgivenA, 2)}</b></span>
          <input class="slider" type="range" min="0.01" max="0.99" step="0.01" bind:value={prefs.pBgivenA} />
        </label>
        <label class="ctl">
          <span class="ctl-l">P(B | A') <b>{fmtTrim(prefs.pBgivenNotA, 2)}</b></span>
          <input class="slider" type="range" min="0.01" max="0.99" step="0.01" bind:value={prefs.pBgivenNotA} />
        </label>
        <div class="ctl">
          <span class="ctl-l">Highlight path</span>
          <Seg label="Tree path" options={[['bayes', 'Bayes'], ['AB', 'A∩B'], ['AnB', "A∩B'"], ['nAB', "A'∩B"]] as const} bind:value={prefs.treeSel} />
        </div>
      {/if}

      <p class="why">
        Two events A and B are independent iff P(A ∩ B) = P(A)P(B) (equivalently P(B | A) = P(B | A')), and mutually exclusive iff P(A ∩ B) = 0.
      </p>
    </div>

    <TopicLinks items={[
      { id: 'S1.3.1', label: 'Elementary' },
      { id: 'S1.3.2', label: 'Conditional prob' },
      { id: 'S1.3.3', label: 'Independence' },
      { id: 'S1.3.4', label: 'Sum & product' },
    ]} />
  </aside>
</main>
