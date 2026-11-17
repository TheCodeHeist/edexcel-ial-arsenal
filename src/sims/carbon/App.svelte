<script lang="ts">
  /* Carbon Alchemy. Four modes with hash routes: #lab #synthesis #identify #codex, and #reactions / #flowchart /
     #tests / #preparation for the codex sections. */
  import { onMount, tick } from 'svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import BottomDrawer from '../../components/ui/BottomDrawer.svelte';
  import { LABSET } from './data';
  import { Carbon, provide, type Tab } from './app.svelte';
  import { installDnd } from './dnd';
  import Lab from './Lab.svelte';
  import Synthesis from './Synthesis.svelte';
  import Identify from './Identify.svelte';
  import Codex from './Codex.svelte';
  import Inventory from './Inventory.svelte';
  import SynItems from './SynItems.svelte';
  import ReagentRack from './ReagentRack.svelte';

  const app = new Carbon();
  provide(app);

  const TABS = [['lab', 'Lab'], ['synthesis', 'Synthesis', 'Make'], ['identify', 'Identify', 'Test'], ['codex', 'Codex']] as const;
  const INFO: Record<Tab, [string, string]> = {
    lab: ['Lab', 'Drag or tap a compound and a reagent into the circle to react them.'],
    synthesis: ['Synthesis', 'Make the target from the starting materials, one reaction at a time.'],
    identify: ['Identify', 'Test the unknown, then name it from the four options.'],
    codex: ['Codex', 'Every route, test and technique in one place.'],
  };
  const views: Record<Tab, HTMLElement | undefined> = $state({ lab: undefined, synthesis: undefined, identify: undefined, codex: undefined });

  function setTab(t: Tab) {
    const prev = app.tab;
    app.tab = t;
    if (t === 'synthesis' && !app.syn.target) app.newSyn();
    if (t === 'identify' && !app.id.cid) app.newUnknown();
    if (prev !== t) tick().then(() => fadeIn(views[t]?.firstElementChild as HTMLElement));
  }

  /* routing */
  function fromHash() {
    const h = location.hash.slice(1);
    if (h === 'reactions' || h === 'flowchart') { app.cx.sub = 'reactions'; app.cx.layout = h === 'flowchart' ? 'flow' : 'cards'; setTab('codex'); }
    else if (h === 'tests' || h === 'preparation') { app.cx.sub = h; setTab('codex'); }
    else setTab((['lab', 'synthesis', 'identify', 'codex'] as const).find((t) => t === h) ?? 'lab');
  }
  fromHash(); // read the starting route before the effect below starts writing it
  $effect(() => {
    const h = '#' + (app.tab === 'codex' ? (app.cx.sub === 'reactions' ? (app.cx.layout === 'flow' ? 'flowchart' : 'reactions') : app.cx.sub) : app.tab);
    if (location.hash !== h) history.replaceState(null, '', h);
  });

  /* phones: on Lab and Synthesis the compounds and reagents move into a bottom drawer */
  let phone = $state(false);
  let drawer = $state<ReturnType<typeof BottomDrawer>>();
  let drawerOpen = $state(false), pane = $state<'c' | 'r'>('c');
  $effect(() => { app.docked = phone && (app.tab === 'lab' || app.tab === 'synthesis'); if (!app.docked) drawerOpen = false; });
  $effect(() => { document.documentElement.classList.toggle('docked', app.docked); });
  const ICON_C = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><circle cx="12" cy="12" r="3.6"/></svg>';
  const ICON_R = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/></svg>';
  const count = $derived(app.tab === 'lab' ? (app.prefs.free ? LABSET.size : app.labFound) : app.syn.start.length + app.syn.made.length);

  onMount(() => {
    const mq = matchMedia('(max-width: 760px)');
    const set = () => (phone = mq.matches); set(); mq.addEventListener('change', set);
    addEventListener('hashchange', fromHash);
    glint('.cc,.rgc,.rxc,.tcx,.tech,.proc,.flow,.tp-row,.opt,.tbtn');
    const off = installDnd({ active: () => app.active, closeDrawer: (fast) => drawer?.close(fast) });
    return () => { mq.removeEventListener('change', set); removeEventListener('hashchange', fromHash); off(); document.documentElement.classList.remove('docked'); };
  });
</script>

<SimHeader title="Carbon Alchemy" eyebrow="Edexcel IAL Chemistry · Units 5 & 6 · Organic synthesis"
  back={{ href: '/chemistry/', label: 'Arsenal' }} tabs={TABS} value={app.tab} onselect={setTab} />
<StatusLine label={INFO[app.tab][0]} hint={INFO[app.tab][1]} stats={app.stats()} />

<div bind:this={views.lab}><Lab hidden={app.tab !== 'lab'} /></div>
<div bind:this={views.synthesis}>{#if app.syn.target}<Synthesis hidden={app.tab !== 'synthesis'} />{/if}</div>
<div bind:this={views.identify}>{#if app.id.cid}<Identify hidden={app.tab !== 'identify'} />{/if}</div>
<div bind:this={views.codex}><Codex hidden={app.tab !== 'codex'} /></div>

{#if app.docked}
  <BottomDrawer bind:this={drawer} bind:open={drawerOpen} bind:pane tip="Tap to add · hold to drag" nudge={app.active?.needs ?? null}
    panes={[['c', 'Compounds', ICON_C, count || undefined], ['r', 'Reagents', ICON_R]]}>
    {#snippet content(p)}
      {#if p === 'c'}{#if app.tab === 'lab'}<Inventory />{:else}<SynItems />{/if}{:else}<ReagentRack />{/if}
    {/snippet}
  </BottomDrawer>
{/if}
