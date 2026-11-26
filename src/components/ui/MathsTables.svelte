<script lang="ts">
  /* The statistical tables from the IAL Maths formula book, inside the Formula & Data Booklet modal.
     Normal, binomial and Poisson are computed (src/lib/stats.ts, matching every printed digit); χ² and the
     correlation critical values are typed in from the booklet. Each table has a small look-up above it. */
  import { phi, binomCdf, poissonCdf, dp4, NORMAL_Z, NORMAL_POINTS, BINOM_N, BINOM_P, POISSON_L, binomBlock, poissonBlock } from '../../lib/stats';
  import { CHI_P, CHI2, CORR } from '../../data/mathsbooklet';

  type T = 'normal' | 'points' | 'binom' | 'poisson' | 'chi' | 'corr';
  const TABLES: readonly [T, string][] = [
    ['normal', 'Normal Φ(z)'], ['points', '% points'], ['binom', 'Binomial'], ['poisson', 'Poisson'], ['chi', 'χ²'], ['corr', 'Correlation'],
  ];
  let t = $state<T>('normal');

  // look-ups: any value, not just the printed grid
  let z = $state(1.96);
  let bn = $state(10), bp = $state(0.3), bx = $state(3);
  let pl = $state(4), px = $state(5);
  let n = $state(10);              // binomial block shown
  let pi = $state(0);              // Poisson block shown

  const ok = (...v: number[]) => v.every((x) => Number.isFinite(x));
  const zOut = $derived(ok(z) ? dp4(phi(z)) : '—');
  const bOut = $derived(ok(bn, bp, bx) && bn >= 1 && bn <= 200 && Number.isInteger(bn) && bp >= 0 && bp <= 1 ? dp4(binomCdf(bn, bp, Math.floor(bx))) : '—');
  const pOut = $derived(ok(pl, px) && pl > 0 && pl <= 200 ? dp4(poissonCdf(pl, Math.floor(px))) : '—');

  const bRows = $derived(binomBlock(n));
  const pRows = $derived(poissonBlock(pi));
  const zCols = $derived.by(() => {
    const per = Math.ceil(NORMAL_Z.length / 5);
    return Array.from({ length: 5 }, (_, c) => NORMAL_Z.slice(c * per, (c + 1) * per));
  });
  const near = $derived(ok(z) ? NORMAL_Z.reduce((b, v) => (Math.abs(v - Math.abs(z)) < Math.abs(b - Math.abs(z)) ? v : b), 0) : -1);
</script>

<div class="seg mt-seg" role="group" aria-label="Statistical table">
  {#each TABLES as [id, label]}
    <button type="button" aria-pressed={t === id} onclick={() => (t = id)}>{label}</button>
  {/each}
</div>

{#if t === 'normal'}
  <p class="mt-cap">Φ(z) = P(Z ≤ z) for Z ∼ N(0, 1). For negative z use Φ(−z) = 1 − Φ(z).</p>
  <div class="mt-look">
    <label>z <input type="number" step="0.01" bind:value={z} /></label>
    <span class="mt-res">Φ(z) = <b>{zOut}</b></span>
  </div>
  <div class="mt-scroll">
    <div class="mt-zcols">
      {#each zCols as col}
        <table class="mt-table">
          <thead><tr><th>z</th><th>Φ(z)</th></tr></thead>
          <tbody>
            {#each col as v}
              <tr class:hit={v === near}><th>{v.toFixed(2)}</th><td>{dp4(phi(v))}</td></tr>
            {/each}
          </tbody>
        </table>
      {/each}
    </div>
  </div>
{:else if t === 'points'}
  <p class="mt-cap">The values z which Z ∼ N(0, 1) exceeds with probability p: P(Z &gt; z) = 1 − Φ(z) = p.</p>
  <div class="mt-scroll">
    <table class="mt-table mt-narrow">
      <thead><tr><th>p</th><th>z</th></tr></thead>
      <tbody>{#each NORMAL_POINTS as [p, v]}<tr><th>{p}</th><td>{v}</td></tr>{/each}</tbody>
    </table>
  </div>
{:else if t === 'binom'}
  <p class="mt-cap">P(X ≤ x) for X ∼ B(n, p).</p>
  <div class="mt-look">
    <label>n <input type="number" min="1" max="200" step="1" bind:value={bn} /></label>
    <label>p <input type="number" min="0" max="1" step="0.01" bind:value={bp} /></label>
    <label>x <input type="number" min="0" step="1" bind:value={bx} /></label>
    <span class="mt-res">P(X ≤ x) = <b>{bOut}</b></span>
  </div>
  <div class="seg mt-sub" role="group" aria-label="Number of trials n">
    {#each BINOM_N as v}<button type="button" aria-pressed={n === v} onclick={() => (n = v)}>n = {v}</button>{/each}
  </div>
  <div class="mt-scroll">
    <table class="mt-table">
      <thead><tr><th>x \ p</th>{#each BINOM_P as p}<th>{p.toFixed(2)}</th>{/each}</tr></thead>
      <tbody>{#each bRows as row, x}<tr><th>{x}</th>{#each row as v}<td>{v}</td>{/each}</tr>{/each}</tbody>
    </table>
  </div>
{:else if t === 'poisson'}
  <p class="mt-cap">P(X ≤ x) for X ∼ Po(λ).</p>
  <div class="mt-look">
    <label>λ <input type="number" min="0" step="0.1" bind:value={pl} /></label>
    <label>x <input type="number" min="0" step="1" bind:value={px} /></label>
    <span class="mt-res">P(X ≤ x) = <b>{pOut}</b></span>
  </div>
  <div class="seg mt-sub" role="group" aria-label="Range of λ">
    <button type="button" aria-pressed={pi === 0} onclick={() => (pi = 0)}>λ = 0.5 – 5.0</button>
    <button type="button" aria-pressed={pi === 1} onclick={() => (pi = 1)}>λ = 5.5 – 10.0</button>
  </div>
  <div class="mt-scroll">
    <table class="mt-table">
      <thead><tr><th>x \ λ</th>{#each POISSON_L[pi] as l}<th>{l.toFixed(1)}</th>{/each}</tr></thead>
      <tbody>{#each pRows as row, x}<tr><th>{x}</th>{#each row as v}<td>{v}</td>{/each}</tr>{/each}</tbody>
    </table>
  </div>
{:else if t === 'chi'}
  <p class="mt-cap">The values a χ² random variable on ν degrees of freedom exceeds with the probability shown.</p>
  <div class="mt-scroll">
    <table class="mt-table">
      <thead><tr><th>ν</th>{#each CHI_P as p}<th>{p}</th>{/each}</tr></thead>
      <tbody>{#each CHI2 as row, i}<tr><th>{i + 1}</th>{#each row as v}<td>{v}</td>{/each}</tr>{/each}</tbody>
    </table>
  </div>
{:else}
  <p class="mt-cap">Critical values for testing ρ = 0: the smallest sample coefficient significant at each level, on a one-tailed test.</p>
  <div class="mt-scroll">
    <table class="mt-table">
      <thead>
        <tr><th></th><th colspan="5">Product moment coefficient</th><th colspan="3" class="gap">Spearman’s coefficient</th></tr>
        <tr><th>n</th><th>0.10</th><th>0.05</th><th>0.025</th><th>0.01</th><th>0.005</th><th class="gap">0.05</th><th>0.025</th><th>0.01</th></tr>
      </thead>
      <tbody>{#each CORR as r}<tr><th>{r.n}</th>{#each r.pmcc as v}<td>{v}</td>{/each}{#each r.spearman as v, k}<td class="sp" class:gap={k === 0}>{v}</td>{/each}</tr>{/each}</tbody>
    </table>
  </div>
{/if}
