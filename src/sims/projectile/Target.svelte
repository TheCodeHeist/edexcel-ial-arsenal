<script lang="ts" module>
  export interface TScore { hits: number; first: number; shots: number; streak: number; best: number }
</script>

<script lang="ts">
  /* Target: land the ball on the flag. Work it out on paper, set the one thing you control, fire. A hit with the
     first shot counts as a first-shot hit; the working is there if you get stuck (that target then no longer counts
     as first-shot). */
  import Scene from './Scene.svelte';
  import { untrack } from 'svelte';
  import type { Dim, Shot } from './scene';
  import Seg from '../../components/ui/Seg.svelte';
  import { newChallenge, shoot, working, type Challenge, type Course, type TMode, type Outcome } from './target';
  import { Player } from './player.svelte';
  import { G, type Launch } from './physics';
  import { sig } from '../circuit/format';

  let { score, prefs, hidden: off = false }: { score: TScore; prefs: { mode: TMode; course: Course }; hidden?: boolean } = $props();

  let c = $state<Challenge>(untrack(() => newChallenge(prefs.mode, prefs.course)));
  let setDeg = $state(30), setU = $state(15);
  let tries = $state<Outcome[]>([]);
  let solved = $state(false), helped = $state(false), showWork = $state(false);
  const player = new Player();
  let flying = $state<Outcome | null>(null);
  player.onend = () => {
    if (!flying) return;
    const o = flying;
    tries = [...tries, o];
    flying = null;
    score.shots++;
    if (o.hit && !solved) {
      solved = true; score.hits++;
      if (tries.length === 1 && !helped) { score.first++; score.streak++; score.best = Math.max(score.best, score.streak); }
      else score.streak = 0;
    }
  };

  function fresh() {
    player.reset(); flying = null;
    c = newChallenge(prefs.mode, prefs.course);
    tries = []; solved = false; helped = false; showWork = false;
    if (c.mode === 'speed') setU = Math.round(Math.max(5, c.answers[0] * (0.7 + Math.random() * 0.2)));
    else setDeg = c.h > 0 ? 10 : 30;
  }
  $effect(() => { void prefs.mode; void prefs.course; if (prefs.mode !== c.mode || prefs.course !== c.course) fresh(); });

  const L = $derived<Launch>({ u: c.mode === 'angle' ? c.u : setU, deg: c.mode === 'speed' ? c.deg : setDeg, h: c.h, g: G, k: 0 });
  function fire() {
    if (player.playing) return;
    flying = shoot(L, c.target, c.wall);
    player.play(flying.f.T);
  }
  function help() { showWork = !showWork; if (showWork && !solved) helped = true; }

  const last = $derived(tries[tries.length - 1] ?? null);
  const trails = $derived<Shot[]>(tries.map((o, i) => ({ f: o.f, color: i === tries.length - 1 && !flying ? (o.hit ? 'var(--good)' : 'var(--ch1)') : 'var(--muted)' })));
  const dims = $derived.by<Dim[]>(() => {
    const d: Dim[] = [{ a: [0, 0], b: [c.target.x, 0], label: `${c.target.x} m`, off: -16 }];
    if (c.target.y > 0) d.push({ a: [c.target.x + c.target.w / 2, 0], b: [c.target.x + c.target.w / 2, c.target.y], label: `${c.target.y} m`, off: 26 });
    if (c.wall) d.push({ a: [c.wall.x, 0], b: [c.wall.x, c.wall.h], label: `${c.wall.h} m`, off: 18 });
    return d;
  });
  const given = $derived(c.mode === 'angle' ? `Launch speed ${c.u} m s⁻¹ · you choose the angle` : `Launch angle ${c.deg}° · you choose the speed`);
  const lines = $derived(working(c));
  fresh();
</script>

<main class="layout predict target" hidden={off}>
  <section class="panel stage" aria-label="Course">
    <div class="stage-head">
      <div class="label-chip"><small>Target</small><span>{given}</span></div>
      <div class="stage-tools">
        <button class="btn" type="button" onclick={fresh}>{solved ? 'Next target' : 'New target'}</button>
      </div>
    </div>
    <div class="sky">
      <Scene snug launch={L} shots={trails} balls={flying ? [{ f: flying.f, t: player.t, color: 'var(--ch1)' }] : []}
        fit={{ x: c.target.x + 4, y: Math.max(c.top, c.target.y, c.wall?.h ?? 0) * 1.1 }} target={c.target} wall={c.wall}
        {dims} annot={{ u: `${sig(L.u)} m s⁻¹`, deg: `${L.deg}°`, h: c.h ? `${c.h} m` : undefined }} strobe={false} label="Target course" />
    </div>
    <p class="board-note">To scale · g = 9.81 m s⁻² · no air resistance · the target is {c.target.w} m wide{c.wall ? ` · the wall is ${c.wall.x} m away` : ''}{c.h ? ` · you launch from ${c.h} m up` : ''}.</p>
  </section>

  <section class="panel qpanel" aria-label="Aim">
    <div class="qbody">
      <h4>Aim</h4>
      {#if c.mode === 'angle'}
        <label class="ctl"><span class="ctl-l">Angle above horizontal <b>{setDeg}°</b></span>
          <input class="slider" type="range" min={c.h > 0 ? -30 : 0} max="85" step="0.5" bind:value={setDeg} disabled={player.playing} /></label>
        <div class="nudge">
          <button class="btn" type="button" onclick={() => (setDeg = Math.max(c.h > 0 ? -30 : 0, setDeg - 0.5))}>−0.5°</button>
          <input class="num" type="number" min={c.h > 0 ? -30 : 0} max="85" step="0.5" aria-label="Angle in degrees" bind:value={setDeg} />
          <button class="btn" type="button" onclick={() => (setDeg = Math.min(85, setDeg + 0.5))}>+0.5°</button>
        </div>
      {:else}
        <label class="ctl"><span class="ctl-l">Launch speed <b>{setU.toFixed(1)} m s⁻¹</b></span>
          <input class="slider" type="range" min="1" max="45" step="0.1" bind:value={setU} disabled={player.playing} /></label>
        <div class="nudge">
          <button class="btn" type="button" onclick={() => (setU = Math.max(1, +(setU - 0.1).toFixed(1)))}>−0.1</button>
          <input class="num" type="number" min="1" max="45" step="0.1" aria-label="Speed in metres per second" bind:value={setU} />
          <button class="btn" type="button" onclick={() => (setU = Math.min(45, +(setU + 0.1).toFixed(1)))}>+0.1</button>
        </div>
      {/if}
      <button class="btn primary big" type="button" onclick={fire} disabled={player.playing}>Fire</button>
      {#if last && !flying}
        <p class="verdict {last.hit ? 'ok' : 'no'}" aria-live="polite">{last.hit ? (tries.length === 1 && !helped ? 'First shot! ' : 'Hit! ') : ''}{last.msg}</p>
      {/if}
      <p class="why">{tries.length ? `${tries.length} shot${tries.length > 1 ? 's' : ''} at this target.` : 'Work it out first: a hit with your first shot scores a first-shot hit.'}</p>
      <button class="btn" type="button" onclick={help} aria-expanded={showWork}>{showWork ? 'Hide the working' : 'Show the working'}</button>
      {#if showWork}
        <div class="reveal">
          {#each lines as w, i (i)}<div class="eq">{w}</div>{/each}
          {#if c.mode === 'angle' && c.answers.length}
            <p class="why">Angles that land on the flag{c.wall ? ' and clear the wall' : ''}: {c.answers.map((a) => a + '°').join(' or ')}.</p>
          {/if}
        </div>
      {/if}
    </div>
  </section>
</main>
