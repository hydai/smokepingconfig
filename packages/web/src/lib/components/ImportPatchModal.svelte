<script lang="ts">
  import { t } from 'svelte-i18n';

  import type { DriftReport, WorkingTree } from '@smokepingconf/core';
  import { commitImportedTree, previewPatchYaml } from '$lib/store.js';

  let { onClose }: { onClose: () => void } = $props();

  type Stage = 'idle' | 'previewed' | 'error';

  let stage = $state<Stage>('idle');
  let yamlText = $state('');
  let errorMsg = $state('');
  let preview = $state<{ tree: WorkingTree; drift: DriftReport } | null>(null);

  async function onFileChosen(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    yamlText = await file.text();
    input.value = '';
  }

  function analyze() {
    errorMsg = '';
    if (!yamlText.trim()) {
      errorMsg = $t('importPatch.errors.empty');
      stage = 'error';
      return;
    }
    try {
      preview = previewPatchYaml(yamlText);
      stage = 'previewed';
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
      stage = 'error';
    }
  }

  function apply() {
    if (!preview) return;
    commitImportedTree(preview.tree);
    onClose();
  }

  function backdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }
</script>

<div
  class="backdrop"
  onclick={backdropClick}
  onkeydown={(e) => {
    if (e.key === 'Escape') onClose();
  }}
  role="dialog"
  aria-modal="true"
  aria-labelledby="import-patch-title"
  tabindex="-1"
>
  <div class="modal">
    <header>
      <h2 id="import-patch-title">{$t('importPatch.title')}</h2>
      <button class="close" type="button" onclick={onClose} aria-label={$t('importPatch.close')}>
        ×
      </button>
    </header>

    {#if stage !== 'previewed'}
      <section>
        <label class="file-label">
          {$t('importPatch.fileLabel')}
          <input type="file" accept=".yaml,.yml,text/yaml" onchange={onFileChosen} />
        </label>

        <label class="paste-label">
          {$t('importPatch.pasteLabel')}
          <textarea bind:value={yamlText} rows="12" spellcheck="false" placeholder="schema: 1
baseVersion:
  date: 2026-04-15
  sha: abc1234
excluded:
  - /CDN/Akamai"></textarea>
        </label>

        {#if stage === 'error'}
          <p class="error" role="alert">{errorMsg}</p>
        {/if}

        <div class="actions">
          <button type="button" onclick={analyze} disabled={!yamlText.trim()}>
            {$t('importPatch.analyze')}
          </button>
          <button type="button" class="ghost" onclick={onClose}>
            {$t('importPatch.cancel')}
          </button>
        </div>
      </section>
    {:else if preview}
      <section class="preview">
        <h3>{$t('importPatch.preview.heading')}</h3>
        {#if preview.drift.missingPaths.length === 0 && !preview.drift.baseMismatch}
          <p class="clean">{$t('importPatch.preview.clean')}</p>
        {:else}
          {#if preview.drift.baseMismatch}
            {@const bm = preview.drift.baseMismatch}
            <div class="drift-block">
              <strong>{$t('importPatch.preview.mismatchHeading')}</strong>
              <p class="mismatch-line">
                {$t('importPatch.preview.mismatchPatch', {
                  values: { date: bm.patch.date, sha: bm.patch.sha }
                })}
              </p>
              <p class="mismatch-line">
                {#if bm.actual}
                  {$t('importPatch.preview.mismatchBase', {
                    values: { date: bm.actual.date, sha: bm.actual.sha }
                  })}
                {:else}
                  {$t('importPatch.preview.mismatchBaseUnknown')}
                {/if}
              </p>
            </div>
          {/if}
          {#if preview.drift.missingPaths.length > 0}
            <div class="drift-block">
              <strong
                >{$t('importPatch.preview.missingHeading', {
                  values: { count: preview.drift.missingPaths.length }
                })}</strong
              >
              <ul>
                {#each preview.drift.missingPaths as p (p)}
                  <li><code>{p}</code></li>
                {/each}
              </ul>
            </div>
          {/if}
          <p class="hint">{$t('importPatch.preview.hint')}</p>
        {/if}

        <div class="actions">
          <button type="button" onclick={apply}>{$t('importPatch.apply')}</button>
          <button
            type="button"
            class="ghost"
            onclick={() => {
              stage = 'idle';
              preview = null;
            }}
          >
            {$t('importPatch.back')}
          </button>
        </div>
      </section>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, CanvasText 40%, transparent);
    display: grid;
    place-items: center;
    padding: 1rem;
    z-index: 100;
  }
  .modal {
    background: Canvas;
    color: CanvasText;
    border-radius: 8px;
    max-width: 640px;
    width: 100%;
    max-height: calc(100vh - 2rem);
    overflow: auto;
    padding: 1.25rem;
    box-shadow: 0 20px 40px rgb(0 0 0 / 0.25);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.75rem;
  }
  h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.95rem;
  }
  .close {
    background: transparent;
    border: none;
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
    padding: 0 0.4rem;
    color: inherit;
  }
  .file-label,
  .paste-label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.8125rem;
    font-weight: 500;
    margin-bottom: 0.75rem;
  }
  textarea {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 0.75rem;
    padding: 0.5rem;
    border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    border-radius: 4px;
    background: Canvas;
    color: CanvasText;
    resize: vertical;
  }
  input[type='file'] {
    font: inherit;
  }
  .error {
    color: #dc2626;
    font-size: 0.8125rem;
    margin: 0.5rem 0;
    padding: 0.5rem;
    border-left: 3px solid #dc2626;
    background: color-mix(in srgb, #dc2626 10%, transparent);
    white-space: pre-wrap;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .actions button {
    appearance: none;
    border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    background: Canvas;
    color: CanvasText;
    font: inherit;
    padding: 0.4rem 0.85rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
  }
  .actions button.ghost {
    border-color: transparent;
    opacity: 0.7;
  }
  .actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .preview .clean {
    color: #16a34a;
    margin: 0.5rem 0 0;
  }
  .drift-block {
    margin: 0.5rem 0;
    padding: 0.5rem 0.75rem;
    border-left: 3px solid #f59e0b;
    background: color-mix(in srgb, #f59e0b 8%, transparent);
  }
  .drift-block strong {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.8125rem;
  }
  .drift-block ul {
    margin: 0;
    padding-left: 1.2rem;
    font-size: 0.8125rem;
  }
  .mismatch-line {
    margin: 0.1rem 0;
    font-size: 0.8125rem;
    font-family: ui-monospace, Menlo, monospace;
  }
  .hint {
    font-size: 0.75rem;
    opacity: 0.7;
    margin: 0.5rem 0 0;
  }
</style>
