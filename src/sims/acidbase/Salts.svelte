<script lang="ts" module>
  export interface SaltsPrefs {
    conjId: string;
    saltId: string;
  }
  export const SALTS_PREFS: SaltsPrefs = { conjId: 'nitration', saltId: 'ch3coona' };
</script>

<script lang="ts">
  /* Conjugate Pairs & Salt Hydrolysis: Brønsted–Lowry proton transfer & why salts aren't always pH 7 (Spec 14.1–14.2). */
  import { CONJUGATES, SALTS } from './salts';
  import { chem } from '../../lib/chem';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: SaltsPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  const conj = $derived(CONJUGATES.find((c) => c.id === prefs.conjId) ?? CONJUGATES[0]);
  const salt = $derived(SALTS.find((s) => s.id === prefs.saltId) ?? SALTS[1]);

  $effect(() => {
    stats = [
      ['Salt', salt.formula],
      ['pH', salt.approxPH],
      ['Solution', salt.verdict],
    ];
  });
</script>

<main class="layout ac-salts" hidden={off}>
  <section class="panel stage" aria-label="Brønsted-Lowry conjugate pairs">
    <div class="ph"><h2>Brønsted–Lowry conjugate acid–base pairs</h2></div>
    <div class="picker" role="group" aria-label="Choose a proton-transfer reaction">
      {#each CONJUGATES as c (c.id)}
        <button type="button" class="chip" class:on={prefs.conjId === c.id} onclick={() => (prefs.conjId = c.id)}>{c.title}</button>
      {/each}
    </div>

    <div class="ac-eq">{@html chem(conj.eq)}</div>

    <div class="ac-pairs">
      <div class="ac-pair">
        <span class="ac-badge acid">Pair 1 (donates H⁺)</span>
        <div class="ac-pline"><b>{conj.acid1}</b> (acid) ⟶ <b>{conj.base1}</b> (conjugate base)</div>
      </div>
      <div class="ac-pair">
        <span class="ac-badge base">Pair 2 (accepts H⁺)</span>
        <div class="ac-pline"><b>{conj.base2}</b> (base) ⟶ <b>{conj.acid2}</b> (conjugate acid)</div>
      </div>
    </div>
    <p class="note pad">{conj.note}</p>

    <div class="ac-div"></div>
    <div class="ph"><h2>pH of salt solutions (hydrolysis)</h2></div>
    <div class="picker" role="group" aria-label="Choose a salt">
      {#each SALTS as s (s.id)}
        <button type="button" class="chip" class:on={prefs.saltId === s.id} onclick={() => (prefs.saltId = s.id)}>{s.name}</button>
      {/each}
    </div>
    <div class="ac-eq">{@html chem(salt.eq)}</div>
    <dl class="reads pad">
      <div><dt>Parent acid</dt><dd class="txt">{salt.parentAcid}</dd></div>
      <div><dt>Parent base</dt><dd class="txt">{salt.parentBase}</dd></div>
      <div><dt>Approx. pH</dt><dd>{salt.approxPH}</dd></div>
      <div><dt>Solution</dt><dd class="txt">{salt.verdict}</dd></div>
    </dl>
    <p class="note pad">{salt.why}</p>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Definitions and exam rules">
      <div class="ph"><h2>Definitions &amp; exam rules</h2></div>
      <div class="facts pad">
        <b>Brønsted–Lowry definitions</b>
        <ul>
          <li><b>Acid:</b> a proton (H⁺) donor.</li>
          <li><b>Base:</b> a proton (H⁺) acceptor.</li>
          <li><b>Conjugate pair:</b> two species that differ by a single H⁺ ion (e.g. CH₃COOH / CH₃COO⁻).</li>
          <li><b>Strong acid + strong base</b> → neutral salt (pH 7).</li>
          <li><b>Weak acid + strong base</b> → alkaline salt (pH &gt; 7) because the conjugate base hydrolyses water.</li>
          <li><b>Strong acid + weak base</b> → acidic salt (pH &lt; 7) because the conjugate acid donates H⁺ to water.</li>
        </ul>
      </div>
    </section>
  </aside>
</main>
