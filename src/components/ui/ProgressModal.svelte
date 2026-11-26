<script lang="ts">
  /* Cross-lab Revision Progress & JSON Backup/Restore modal (opened via Settings or Ctrl+K). */
  import { onMount } from 'svelte';
  import { SUBJECTS } from '../../data/subjects';
  import { readProgress, exportArsenalData, importArsenalData, clearAllProgress, type ProgressSummary } from '../../lib/progress';

  let open = $state(false);
  let summary = $state<ProgressSummary | null>(null);
  let notice = $state('');
  let confirmClear = $state(false);
  let fileInput = $state<HTMLInputElement>();

  function refresh() { summary = readProgress(); }

  function show() {
    refresh();
    notice = '';
    confirmClear = false;
    open = true;
  }

  function close() { open = false; }

  function downloadBackup() {
    const json = exportArsenalData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ial-arsenal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notice = 'Backup downloaded.';
  }

  async function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = importArsenalData(text);
    if (res.ok) {
      notice = `Restored ${res.count} saved items. Refreshing…`;
      refresh();
      setTimeout(() => window.location.reload(), 700);
    } else {
      notice = res.error ?? 'Import failed.';
    }
    if (fileInput) fileInput.value = '';
  }

  function doClear() {
    if (!confirmClear) { confirmClear = true; return; }
    clearAllProgress();
    confirmClear = false;
    refresh();
    notice = 'Progress cleared (theme & performance settings kept).';
  }

  onMount(() => {
    const onOpen = () => show();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) close(); };
    window.addEventListener('arsenal-progress', onOpen);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('arsenal-progress', onOpen);
      document.removeEventListener('keydown', onKey);
    };
  });
</script>

{#if open && summary}
  {@const acc = summary.totalAttempted > 0 ? Math.round((summary.totalRight / summary.totalAttempted) * 100) : 0}
  {@const labs = summary.labs}
  <div class="modal-bg" role="presentation" onclick={close}>
    <div class="modal-box glass pr-modal" role="dialog" aria-modal="true" aria-label="Revision progress and backup" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && close()}>
      <div class="modal-head">
        <div>
          <span class="eyebrow">Stored locally · Zero accounts</span>
          <h3>Revision Progress</h3>
        </div>
        <button type="button" class="modal-x" aria-label="Close" onclick={close}>✕</button>
      </div>

      <div class="pr-stats">
        <div class="pr-stat"><small>Answered</small><b>{summary.totalAttempted}</b></div>
        <div class="pr-stat"><small>Accuracy</small><b>{summary.totalAttempted ? `${acc}%` : '—'}</b></div>
        <div class="pr-stat"><small>Labs tried</small><b>{summary.practised}/{labs.length}</b></div>
        <div class="pr-stat"><small>Best streak</small><b>{summary.bestStreak}</b></div>
      </div>

      <div class="modal-body pr-body">
        {#each SUBJECTS.filter((s) => labs.some((l) => l.subject === s.id)) as subj}
          <div class="pr-sec">
            <span class="pp-lbl">{subj.name}</span>
            <div class="pr-list">
              {#each labs.filter((l) => l.subject === subj.id) as lab}
                {@const pct = lab.total > 0 ? Math.round((lab.right / lab.total) * 100) : 0}
                <a class="pr-row" href={lab.href}>
                  <div class="pr-top">
                    <b>{lab.title}</b>
                    <span class="pr-meta">
                      {#if lab.total > 0}
                        {lab.right}/{lab.total} ({pct}%){#if lab.best > 1} · best {lab.best}{/if}
                      {:else if lab.extra}
                        {lab.extra}
                      {:else}
                        Not practised yet
                      {/if}
                    </span>
                  </div>
                  <div class="pr-bar"><i style:width={`${pct}%`}></i></div>
                </a>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      {#if notice}<p class="pr-notice">{notice}</p>{/if}

      <div class="pr-actions">
        <div class="pr-io">
          <button type="button" class="btn" onclick={downloadBackup}>Export JSON</button>
          <button type="button" class="btn" onclick={() => fileInput?.click()}>Import JSON</button>
          <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />
        </div>
        <button type="button" class="pp-reset" class:danger={confirmClear} onclick={doClear}>
          {confirmClear ? 'Click again to clear' : 'Clear progress'}
        </button>
      </div>
    </div>
  </div>
{/if}
