<script lang="ts">
  import { t } from 'svelte-i18n';

  import {
    MAX_URL_LENGTH,
    buildShareUrl,
    serializeCatalog,
    writeHashState
  } from '@smokepingconf/core';
  import { baseCatalog, resetTree, tree } from '$lib/store.js';

  const text = $derived(serializeCatalog($tree));

  type CopyState = 'idle' | 'copied' | 'failed';
  type ShareState = 'idle' | 'copied' | 'toolong' | 'failed';

  let copyState = $state<CopyState>('idle');
  let shareState = $state<ShareState>('idle');
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let shareTimer: ReturnType<typeof setTimeout> | undefined;

  const shareInfo = $derived(buildShareUrl($tree, baseCatalog));

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      flash('copied');
    } catch {
      flash('failed');
    }
  }

  function flash(state: Exclude<CopyState, 'idle'>) {
    copyState = state;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copyState = 'idle';
    }, 1800);
  }

  async function share() {
    if (!shareInfo.ok) {
      flashShare('toolong');
      return;
    }
    writeHashState($tree, baseCatalog);
    try {
      await navigator.clipboard.writeText(shareInfo.url);
      flashShare('copied');
    } catch {
      flashShare('failed');
    }
  }

  function flashShare(state: Exclude<ShareState, 'idle'>) {
    shareState = state;
    if (shareTimer) clearTimeout(shareTimer);
    shareTimer = setTimeout(() => {
      shareState = 'idle';
    }, 2200);
  }

  function download() {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Targets';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function reset() {
    if (window.confirm($t('actions.resetConfirm'))) {
      resetTree();
    }
  }
</script>

<div class="actions" role="toolbar" aria-label="Output actions">
  <button type="button" onclick={copy} aria-live="polite" data-state={copyState}>
    {#if copyState === 'copied'}
      {$t('actions.copied')}
    {:else if copyState === 'failed'}
      {$t('actions.copyFailed')}
    {:else}
      {$t('actions.copy')}
    {/if}
  </button>
  <button type="button" onclick={download}>{$t('actions.download')}</button>
  <button
    type="button"
    onclick={share}
    data-state={shareState}
    title={shareInfo.ok
      ? $t('actions.shareTitleOk', { values: { length: shareInfo.length } })
      : $t('actions.shareTitleTooLong', {
          values: { length: shareInfo.length, max: MAX_URL_LENGTH }
        })}
    disabled={!shareInfo.ok && shareState === 'idle'}
  >
    {#if shareState === 'copied'}
      {$t('actions.shareCopied')}
    {:else if shareState === 'toolong'}
      {$t('actions.shareTooLong')}
    {:else if shareState === 'failed'}
      {$t('actions.shareFailed')}
    {:else}
      {$t('actions.share')}
    {/if}
  </button>
  <button type="button" class="ghost" onclick={reset}>{$t('actions.reset')}</button>
</div>

<style>
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  button {
    appearance: none;
    border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    background: Canvas;
    color: CanvasText;
    font: inherit;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    transition:
      background 0.12s,
      border-color 0.12s;
  }
  button:hover {
    background: color-mix(in srgb, currentColor 6%, transparent);
    border-color: color-mix(in srgb, currentColor 32%, transparent);
  }
  button:focus-visible {
    outline: 2px solid #38bdf8;
    outline-offset: 2px;
  }
  button.ghost {
    border-color: transparent;
    opacity: 0.7;
  }
  button.ghost:hover {
    opacity: 1;
  }
  button[data-state='copied'] {
    border-color: #22c55e;
    color: #16a34a;
  }
  button[data-state='failed'],
  button[data-state='toolong'] {
    border-color: #ef4444;
    color: #dc2626;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
