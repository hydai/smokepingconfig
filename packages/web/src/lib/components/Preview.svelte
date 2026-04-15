<script lang="ts">
  import { t } from 'svelte-i18n';

  import { serializeCatalog } from '@smokepingconf/core';
  import { tree } from '$lib/store.js';

  const text = $derived(serializeCatalog($tree));
  const bytes = $derived(new TextEncoder().encode(text).length);
  const lineCount = $derived(text.split('\n').length);
</script>

<div class="preview">
  <header class="stats">
    <span>{$t('stats.lines', { values: { count: lineCount } })}</span>
    <span aria-hidden="true">·</span>
    <span>{$t('stats.bytes', { values: { count: bytes } })}</span>
  </header>
  <pre class="output" data-testid="preview"><code>{text}</code></pre>
</div>

<style>
  .preview {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .stats {
    display: flex;
    gap: 0.4rem;
    font-size: 0.75rem;
    opacity: 0.6;
    margin-bottom: 0.5rem;
    font-variant-numeric: tabular-nums;
  }
  .output {
    flex: 1;
    margin: 0;
    padding: 0.75rem 1rem;
    background: color-mix(in srgb, currentColor 4%, transparent);
    border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.45;
    overflow: auto;
    white-space: pre;
    min-height: 0;
  }
  code {
    font-family: inherit;
  }
</style>
