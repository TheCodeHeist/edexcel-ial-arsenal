<script lang="ts">
  /* Kernel's settings view: who pays for the AI (the student's free Puter account, or their own Gemini key),
     signing in / pasting the key, and clearing history. The site itself never pays and never holds a key. */
  import { onMount } from 'svelte';
  import { indicator } from '../../lib/motion';
  import {
    getAI, setAI, onAI, AIError, puterSignIn, puterSignOut, listGeminiModels, pickGeminiModel, GEMINI_KEY_URL,
    type AISettings, type GeminiModel,
  } from '../../lib/ai';
  import { kernel, refreshAccount, clearChats } from '../../lib/kernel/store.svelte';

  let s = $state<AISettings>(getAI());
  let puterBusy = $state(false);
  let puterMsg = $state('');
  let keyDraft = $state('');
  let showKey = $state(false);
  let keyBusy = $state(false);
  let keyMsg = $state<{ ok: boolean; text: string } | null>(null);
  let models = $state<GeminiModel[]>([]);
  let confirmClear = $state(false);

  const signedIn = $derived(kernel.user !== null && kernel.user !== undefined);

  function choose(p: AISettings['provider']) {
    setAI({ provider: p });
    if (p === 'puter') refreshAccount();
  }

  async function signIn() {
    puterBusy = true; puterMsg = '';
    try { kernel.user = await puterSignIn(); refreshAccount(); } catch (e) { puterMsg = (e as Error).message; } finally { puterBusy = false; }
  }
  async function signOut() {
    puterBusy = true;
    try { await puterSignOut(); kernel.user = null; kernel.usage = null; } catch (e) { puterMsg = (e as Error).message; } finally { puterBusy = false; }
  }

  async function saveKey() {
    const k = keyDraft.trim();
    if (!k) return;
    keyBusy = true; keyMsg = null;
    try {
      const list = await listGeminiModels(k);
      const auto = pickGeminiModel(list);
      if (!auto) throw new AIError('model', "This key can't use any Gemini text models.");
      models = list;
      setAI({ geminiKey: k, geminiAuto: auto, geminiModel: '' });
      keyDraft = ''; showKey = false;
      keyMsg = { ok: true, text: 'Key works. It is saved in this browser only.' };
    } catch (e) {
      keyMsg = { ok: false, text: (e as Error).message };
    } finally {
      keyBusy = false;
    }
  }
  function removeKey() { setAI({ geminiKey: '', geminiAuto: '', geminiModel: '' }); models = []; keyMsg = null; }

  onMount(() => {
    const off = onAI((v) => (s = v));
    if (s.provider === 'gemini' && s.geminiKey) listGeminiModels(s.geminiKey).then((m) => (models = m), () => {});
    return off;
  });
</script>

<div class="kx-settings">
  <section>
    <h3 class="kx-h">Who pays for Kernel</h3>
    <p class="kx-fine">Never the site, and never you: Kernel runs on your own free allowance.</p>
    <div class="seg kx-seg" role="group" aria-label="AI provider" use:indicator>
      <button type="button" aria-pressed={s.provider === 'puter'} onclick={() => choose('puter')}>Puter account</button>
      <button type="button" aria-pressed={s.provider === 'gemini'} onclick={() => choose('gemini')}>My Gemini key <small>beta</small></button>
    </div>
  </section>

  {#if s.provider === 'puter'}
    <section class="kx-card">
      {#if signedIn}
        <p>Signed in to Puter{kernel.user ? ` as ${kernel.user}` : ''}. Your questions use your own free monthly Puter allowance.</p>
        <button type="button" class="btn" disabled={puterBusy} onclick={signOut}>Sign out</button>
      {:else}
        <p>Sign in once with a free Puter account (Google or email). No keys, nothing to copy.</p>
        <button type="button" class="btn primary" disabled={puterBusy} onclick={signIn}>{puterBusy ? 'Opening…' : 'Sign in with Puter'}</button>
      {/if}
      {#if puterMsg}<p class="kx-msg bad" role="alert">{puterMsg}</p>{/if}
    </section>
  {:else}
    <section class="kx-card">
      {#if s.geminiKey}
        <p>Using your Gemini key <code>…{s.geminiKey.slice(-4)}</code>.</p>
        <label class="kx-field">
          <span>Model</span>
          <select value={s.geminiModel} onchange={(e) => setAI({ geminiModel: (e.target as HTMLSelectElement).value })}>
            <option value="">Automatic ({s.geminiAuto || 'Flash'})</option>
            {#each models as m (m.id)}<option value={m.id}>{m.label}</option>{/each}
          </select>
        </label>
        <button type="button" class="btn" onclick={removeKey}>Remove key</button>
      {:else}
        <ol class="kx-steps">
          <li>Open <a href={GEMINI_KEY_URL} target="_blank" rel="noopener">Google AI Studio</a> and sign in with Google.</li>
          <li>Click <b>Create API key</b> and copy it.</li>
          <li>Paste it here.</li>
        </ol>
        <form class="kx-row" onsubmit={(e) => { e.preventDefault(); saveKey(); }}>
          <input type={showKey ? 'text' : 'password'} bind:value={keyDraft} placeholder="Paste your key" autocomplete="off" spellcheck="false" aria-label="Gemini API key" />
          <button type="button" class="kx-icon-btn" aria-label={showKey ? 'Hide key' : 'Show key'} onclick={() => (showKey = !showKey)}>{showKey ? 'Hide' : 'Show'}</button>
          <button type="submit" class="btn primary" disabled={keyBusy || !keyDraft.trim()}>{keyBusy ? 'Checking…' : 'Save'}</button>
        </form>
      {/if}
      {#if keyMsg}<p class="kx-msg" class:bad={!keyMsg.ok} role={keyMsg.ok ? 'status' : 'alert'}>{keyMsg.text}</p>{/if}
      <p class="kx-fine">Your key stays in this browser and is only ever sent to Google. On the free tier Google may use what you send to improve its products, and keeps a chat for a day when Kernel uses its tools, so don't send anything private.</p>
    </section>
  {/if}

  <section>
    <h3 class="kx-h">Chat history</h3>
    <p class="kx-fine">{kernel.chats.length} chat{kernel.chats.length === 1 ? '' : 's'}, saved in this browser only.</p>
    {#if confirmClear}
      <div class="kx-row">
        <button type="button" class="btn danger-btn" onclick={() => { clearChats(); confirmClear = false; }}>Delete all chats</button>
        <button type="button" class="btn" onclick={() => (confirmClear = false)}>Cancel</button>
      </div>
    {:else}
      <button type="button" class="btn" disabled={!kernel.chats.length} onclick={() => (confirmClear = true)}>Clear history</button>
    {/if}
  </section>
</div>
