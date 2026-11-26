<script lang="ts">
  /* Kernel, the AI helper: the floating bubble and the panel it opens. A right-hand sidebar on wide screens (the page
     makes room for it, so a past-paper question stays readable beside the chat), a full-screen sheet on phones.
     Every AI interaction on the site lands here: "Ask Kernel" on a question opens that question's chat.
     Mounted once per page (Base.astro, Sim.astro); state lives in src/lib/kernel/store.svelte.ts. */
  import { onMount, tick } from 'svelte';
  import '../../styles/kernel.css';
  import {
    kernel, initKernel, currentChat, closeKernel, openKernel, newChat, selectChat, deleteChat, send, stop, retry,
    listenForAsks, allowanceSummary, refreshAccount, type KChat,
  } from '../../lib/kernel/store.svelte';
  import { getAI, onAI, puterSignIn, type Provider } from '../../lib/ai';
  import { store } from '../../lib/util';
  import KernelSettings from './KernelSettings.svelte';

  let render = $state<((s: string) => string) | null>(null);
  let provider = $state<Provider>('puter');
  let hasKey = $state(false);
  let photo = $state<Blob | null>(null);
  let photoUrl = $state('');
  let signingIn = $state(false);
  let signInMsg = $state('');
  let scroller = $state<HTMLElement>();
  let input = $state<HTMLTextAreaElement>();
  let fileIn = $state<HTMLInputElement>();
  let stick = true; // keep scrolled to the bottom while an answer streams, unless the student scrolls up

  /* Resizing (wider screens): the window is pinned bottom-right, so it grows from its left and top edges. CSS caps it
     at the viewport (minus margins), so a saved size can never push it off a smaller screen. */
  const MIN_W = 320, MIN_H = 400, GAP_X = 40, GAP_Y = 112;
  const maxW = () => innerWidth - GAP_X, maxH = () => innerHeight - GAP_Y;
  let size = $state<{ w: number; h: number } | null>(store.get('kernel-size', null));
  let resizing = $state(false);
  let panel = $state<HTMLElement>();
  const maxed = $derived(!!size && size.w >= 9999);

  function startResize(e: PointerEvent, mode: 'x' | 'y' | 'xy') {
    if (e.button !== 0 || !panel) return;
    e.preventDefault();
    const r = panel.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, sw = r.width, sh = r.height;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    resizing = true;
    const move = (ev: PointerEvent) => {
      const w = mode === 'y' ? sw : Math.round(Math.min(maxW(), Math.max(MIN_W, sw + sx - ev.clientX)));
      const h = mode === 'x' ? sh : Math.round(Math.min(maxH(), Math.max(MIN_H, sh + sy - ev.clientY)));
      size = { w, h };
    };
    const up = () => {
      resizing = false;
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      store.set('kernel-size', size);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  /** Toggle between the largest the screen allows and the size before. 9999 = "as big as it fits" (CSS clamps it). */
  let before: { w: number; h: number } | null = null;
  function toggleMax() {
    if (maxed) { size = before; before = null; }
    else { before = size; size = { w: 9999, h: 9999 }; }
    store.set('kernel-size', size);
  }

  const chat = $derived(currentChat());
  const signedIn = $derived(kernel.user !== null && kernel.user !== undefined);
  const ready = $derived(provider === 'gemini' ? hasKey : signedIn);
  const allowance = $derived(provider === 'puter' ? allowanceSummary(kernel.usage) : null);

  const SUGGEST_Q = ['Explain what this question is asking', 'Give me a hint to start', 'Show a full worked solution', 'How do I get full marks?'];
  const SUGGEST = ['What can you do?', 'Find me a June 2019 physics unit 1 question on moments', 'How do I balance a redox equation?', 'When do I use the chain rule?'];

  $effect(() => {
    if (kernel.open && !render) import('../../lib/kernel/render').then((m) => (render = m.renderKernel), () => {});
  });
  $effect(() => { document.documentElement.classList.toggle('kx-open', kernel.open); });
  $effect(() => {
    // follow the stream
    void chat?.messages.at(-1)?.text; void chat?.id; void kernel.view;
    if (stick && scroller) tick().then(() => scroller && (scroller.scrollTop = scroller.scrollHeight));
  });
  $effect(() => {
    if (kernel.open && kernel.view === 'chat' && matchMedia('(min-width: 761px)').matches) tick().then(() => input?.focus());
  });

  function onScroll() {
    if (!scroller) return;
    stick = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 60;
  }

  function submit() {
    if (kernel.busy) { stop(); return; }
    const t = kernel.draft;
    if (!t.trim() && !photo) return;
    stick = true;
    send(t, photo);
    kernel.draft = '';
    clearPhoto();
    if (input) input.style.height = '';
  }
  function keydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
  }
  function grow() {
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  }
  function pick(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!f) return;
    clearPhoto();
    photo = f;
    photoUrl = URL.createObjectURL(f);
  }
  function clearPhoto() { if (photoUrl) URL.revokeObjectURL(photoUrl); photo = null; photoUrl = ''; }

  async function signIn() {
    signingIn = true; signInMsg = '';
    try { kernel.user = await puterSignIn(); refreshAccount(); } catch (e) { signInMsg = (e as Error).message; } finally { signingIn = false; }
  }

  const when = (t: number) => {
    const d = Date.now() - t;
    if (d < 6e4) return 'just now';
    if (d < 36e5) return `${Math.floor(d / 6e4)} min ago`;
    if (d < 864e5) return `${Math.floor(d / 36e5)} h ago`;
    return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };
  const preview = (c: KChat) => c.messages.find((m) => m.role === 'user')?.text ?? (c.context ? 'Past-paper question' : 'Empty chat');

  onMount(() => {
    initKernel();
    provider = getAI().provider;
    hasKey = !!getAI().geminiKey;
    const offAI = onAI((s) => { provider = s.provider; hasKey = !!s.geminiKey; });
    const offAsk = listenForAsks();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && kernel.open) closeKernel(); };
    document.addEventListener('keydown', esc);
    return () => { offAI(); offAsk(); document.removeEventListener('keydown', esc); document.documentElement.classList.remove('kx-open'); };
  });
</script>

{#snippet sparkle()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" />
  </svg>
{/snippet}

<button type="button" class="kx-fab" class:open={kernel.open} aria-expanded={kernel.open} aria-controls="kernel-panel"
  aria-label={kernel.open ? 'Close Kernel' : 'Ask Kernel, the AI helper'} title={kernel.open ? 'Close' : 'Ask Kernel (beta)'}
  onclick={() => (kernel.open ? closeKernel() : openKernel())}>
  <span class="kx-fab-i chat">{@render sparkle()}</span>
  <span class="kx-fab-i x"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></span>
  {#if kernel.busy && !kernel.open}<i class="kx-fab-dot" aria-hidden="true"></i>{/if}
</button>

<div id="kernel-panel" class="kx-panel" class:open={kernel.open} class:resizing role="dialog" aria-label="Kernel, the AI helper" inert={!kernel.open}
  bind:this={panel} style:--kx-w={size ? size.w + 'px' : null} style:--kx-h={size ? size.h + 'px' : null}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="kx-grip x" onpointerdown={(e) => startResize(e, 'x')} ondblclick={toggleMax}></div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="kx-grip y" onpointerdown={(e) => startResize(e, 'y')} ondblclick={toggleMax}></div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="kx-grip xy" title="Drag to resize · double-click to maximise" onpointerdown={(e) => startResize(e, 'xy')} ondblclick={toggleMax}></div>
  <header class="kx-head">
    <div class="kx-title">
      <span class="kx-logo">{@render sparkle()}<i class="kx-online" class:off={!ready} aria-hidden="true"></i></span>
      <div>
        <b>Kernel <span class="kx-beta">Beta</span></b>
        <small>{kernel.view === 'history' ? 'Your chats' : kernel.view === 'settings' ? 'Settings' : !ready ? 'Sign in to start' : kernel.busy ? 'Typing…' : 'Your AI study buddy'}</small>
      </div>
    </div>
    <div class="kx-actions">
      <button type="button" class="kx-icon-btn" title="New chat" aria-label="New chat" onclick={() => newChat()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <button type="button" class="kx-icon-btn" class:on={kernel.view === 'history'} title="Chat history" aria-label="Chat history" aria-pressed={kernel.view === 'history'}
        onclick={() => (kernel.view = kernel.view === 'history' ? 'chat' : 'history')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>
      </button>
      <button type="button" class="kx-icon-btn" class:on={kernel.view === 'settings'} title="Settings" aria-label="Kernel settings" aria-pressed={kernel.view === 'settings'}
        onclick={() => (kernel.view = kernel.view === 'settings' ? 'chat' : 'settings')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
      </button>
      <button type="button" class="kx-icon-btn kx-maxbtn" title={maxed ? 'Restore size' : 'Maximise'} aria-label={maxed ? 'Restore size' : 'Maximise'} aria-pressed={maxed} onclick={toggleMax}>
        {#if maxed}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
        {/if}
      </button>
      <button type="button" class="kx-icon-btn" title="Minimise" aria-label="Close Kernel" onclick={closeKernel}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
    </div>
  </header>

  {#if allowance}
    <div class="kx-meter" title="Puter's free allowance is monthly and doesn't roll over">
      <div class="kx-bar" class:low={allowance.share < 0.15}><i style:width="{Math.round(allowance.share * 100)}%"></i></div>
      <span>
        <b>{Math.round(allowance.share * 100)}%</b> left this month
        {#if allowance.questions !== null} · ≈ {allowance.questions} question{allowance.questions === 1 ? '' : 's'} (≈ {allowance.perDay}/day){/if}
      </span>
    </div>
  {/if}

  {#if kernel.view === 'settings'}
    <div class="kx-body"><KernelSettings /></div>
  {:else if kernel.view === 'history'}
    <div class="kx-body">
      {#if kernel.chats.length}
        <ul class="kx-history">
          {#each kernel.chats as c (c.id)}
            <li class:current={c.id === kernel.current}>
              <button type="button" class="kx-hrow" onclick={() => selectChat(c.id)}>
                <b>{c.title}</b>
                <small>{c.context && c.title !== preview(c) ? preview(c) + ' · ' : ''}{when(c.at)}</small>
              </button>
              <button type="button" class="kx-icon-btn sm" aria-label={`Delete chat: ${c.title}`} title="Delete" onclick={() => deleteChat(c.id)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="kx-empty">No chats yet. Ask Kernel something, or press <b>Ask Kernel</b> on any past-paper question.</p>
      {/if}
    </div>
  {:else}
    <div class="kx-body kx-chat" bind:this={scroller} onscroll={onScroll}>
      {#if chat?.context}
        {@const cx = chat.context}
        <div class="kx-context">
          <div class="kx-ctx-head">
            <div><b>{cx.title}</b><small>{cx.subtitle ? cx.subtitle + ' · ' : ''}{cx.marks} mark{cx.marks === 1 ? '' : 's'}</small></div>
            <a class="kx-ctx-link" href={cx.href}>Open</a>
          </div>
          <div class="kx-crops">
            {#each cx.qp as u (u)}<img src={u} alt="" loading="lazy" decoding="async" />{/each}
          </div>
          <p class="kx-fine">Kernel can see this question and its official mark scheme.</p>
        </div>
      {/if}

      {#if provider === 'puter' && kernel.user === null}
        <div class="kx-gate">
          <p><b>Sign in to use Kernel.</b> It's free: Kernel runs on your own free Puter account, so the site never pays and never sees a key.</p>
          <button type="button" class="btn primary" disabled={signingIn} onclick={signIn}>{signingIn ? 'Opening…' : 'Sign in with Puter'}</button>
          {#if signInMsg}<p class="kx-msg bad" role="alert">{signInMsg}</p>{/if}
          <button type="button" class="kx-link" onclick={() => (kernel.view = 'settings')}>Or use your own Gemini key</button>
        </div>
      {:else if provider === 'gemini' && !ready}
        <div class="kx-gate">
          <p><b>Add your Gemini key</b> in settings to use Kernel with Gemini.</p>
          <button type="button" class="btn primary" onclick={() => (kernel.view = 'settings')}>Open settings</button>
        </div>
      {/if}

      {#if !chat || chat.messages.length === 0}
        <div class="kx-hello">
          {#if !chat?.context}
            <p class="kx-hi"><b>Hi, I'm Kernel.</b> Ask me about anything in IAL Physics, Chemistry or Maths, or send a photo of a question or your working.</p>
          {/if}
          <div class="kx-suggest">
            {#each chat?.context ? SUGGEST_Q : SUGGEST as sgt (sgt)}
              <button type="button" disabled={!ready || kernel.busy} onclick={() => { stick = true; send(sgt); }}>{sgt}</button>
            {/each}
          </div>
        </div>
      {:else}
        <ol class="kx-msgs">
          {#each chat.messages as m (m.id)}
            <li class="kx-msg-row {m.role}">
              {#if m.role === 'user'}
                <div class="kx-bubble">
                  {#if m.photo}<img class="kx-photo" src={m.photo} alt="Attached" />{/if}
                  <p>{m.text}</p>
                </div>
              {:else}
                <div class="kx-answer">
                  {#if m.tools?.length}
                    <ul class="kx-tools" aria-label="What Kernel did">
                      {#each m.tools as t, i (i)}<li>{t}</li>{/each}
                    </ul>
                  {/if}
                  {#if m.text}
                    {#if render}<div class="kx-md">{@html render(m.text)}</div>{:else}<p class="kx-plain">{m.text}</p>{/if}
                  {:else if !m.error}
                    <span class="kx-typing" aria-label="Kernel is thinking"><i></i><i></i><i></i></span>
                  {/if}
                  {#if m.error}
                    <p class="kx-msg bad" role="alert">{m.error}</p>
                    {#if m === chat.messages.at(-1)}<button type="button" class="btn" onclick={retry}>Try again</button>{/if}
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ol>
      {/if}
    </div>

    <form class="kx-composer" onsubmit={(e) => { e.preventDefault(); submit(); }}>
      {#if photoUrl}
        <div class="kx-attach"><img src={photoUrl} alt="Your attachment" /><button type="button" aria-label="Remove photo" onclick={clearPhoto}>×</button></div>
      {/if}
      <div class="kx-inputrow">
        <button type="button" class="kx-icon-btn" title="Attach a photo" aria-label="Attach a photo" disabled={!ready} onclick={() => fileIn?.click()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4Z" /><circle cx="12" cy="13" r="3.5" /></svg>
        </button>
        <textarea
          bind:this={input}
          bind:value={kernel.draft}
          rows="1"
          placeholder={chat?.context ? 'Ask about this question…' : 'Ask Kernel anything…'}
          aria-label="Message Kernel"
          disabled={!ready}
          oninput={grow}
          onkeydown={keydown}
        ></textarea>
        <button type="submit" class="kx-send" class:stop={kernel.busy} disabled={!ready || (!kernel.busy && !kernel.draft.trim() && !photo)}
          aria-label={kernel.busy ? 'Stop' : 'Send'} title={kernel.busy ? 'Stop' : 'Send'}>
          {#if kernel.busy}
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" /></svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          {/if}
        </button>
      </div>
      <input bind:this={fileIn} type="file" accept="image/*" hidden onchange={pick} />
      <p class="kx-fine kx-disclaim">Kernel is in beta and can make mistakes. Check important answers against the mark scheme.</p>
    </form>
  {/if}
</div>
