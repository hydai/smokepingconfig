<script lang="ts">
  import { serializeCatalog } from '$lib/serializer.js';
  import { resetTree, tree } from '$lib/store.js';

  const text = $derived(serializeCatalog($tree));

  let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      flash('copied');
    } catch {
      flash('failed');
    }
  }

  function flash(state: 'copied' | 'failed') {
    copyState = state;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copyState = 'idle';
    }, 1800);
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
    if (window.confirm('Reset all edits and start from the curated catalog?')) {
      resetTree();
    }
  }
</script>

<div class="actions" role="toolbar" aria-label="Output actions">
  <button type="button" onclick={copy} aria-live="polite" data-state={copyState}>
    {#if copyState === 'copied'}
      ✓ Copied
    {:else if copyState === 'failed'}
      ✗ Failed
    {:else}
      Copy
    {/if}
  </button>
  <button type="button" onclick={download}>Download</button>
  <button type="button" class="ghost" onclick={reset}>Reset</button>
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
  button[data-state='failed'] {
    border-color: #ef4444;
    color: #dc2626;
  }
</style>
