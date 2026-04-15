<script lang="ts">
  import { t } from 'svelte-i18n';

  import { collectUsedProbes, probesFileSnippet } from '@smokepingconf/core';
  import { tree } from '$lib/store.js';

  const used = $derived(collectUsedProbes($tree.nodes, $tree.root.probe));
  const snippet = $derived(probesFileSnippet(used));
  const kinds = $derived([...used].join(', '));

  let expanded = $state(false);
  let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      flash('copied');
    } catch {
      flash('failed');
    }
  }

  function flash(s: 'copied' | 'failed') {
    copyState = s;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copyState = 'idle';
    }, 1800);
  }
</script>

<details class="notice" bind:open={expanded}>
  <summary>
    <span class="icon" aria-hidden="true">⚠</span>
    <span class="title">{$t('probes.noticeTitle')}</span>
    <span class="kinds">{kinds}</span>
  </summary>
  <p class="body">{$t('probes.noticeBody')}</p>
  <pre class="snippet"><code>{snippet}</code></pre>
  <button type="button" onclick={copy} data-state={copyState}>
    {#if copyState === 'copied'}
      {$t('actions.copied')}
    {:else if copyState === 'failed'}
      {$t('actions.copyFailed')}
    {:else}
      {$t('actions.copy')}
    {/if}
  </button>
</details>

<style>
  .notice {
    border: 1px solid color-mix(in srgb, #f59e0b 50%, transparent);
    background: color-mix(in srgb, #f59e0b 10%, Canvas);
    border-radius: 6px;
    padding: 0.35rem 0.6rem;
    font-size: 0.8125rem;
    margin-bottom: 0.75rem;
  }
  summary {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .icon {
    color: #d97706;
    font-size: 0.9em;
  }
  .title {
    font-weight: 600;
  }
  .kinds {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    opacity: 0.7;
  }
  .body {
    margin: 0.5rem 0 0.4rem;
    opacity: 0.85;
  }
  .snippet {
    margin: 0 0 0.5rem;
    padding: 0.5rem 0.75rem;
    background: color-mix(in srgb, currentColor 6%, transparent);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1.5;
    overflow: auto;
  }
  button {
    appearance: none;
    font: inherit;
    border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    background: Canvas;
    color: CanvasText;
    padding: 0.25rem 0.55rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
  }
  button[data-state='copied'] {
    border-color: #22c55e;
    color: #16a34a;
  }
  button[data-state='failed'] {
    border-color: #ef4444;
    color: #dc2626;
  }
</style>
