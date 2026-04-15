<script lang="ts">
  import { t } from 'svelte-i18n';

  import type { Node, ProbeKind } from '$lib/types.js';
  import { mutateNode, removeNode, tree } from '$lib/store.js';
  import {
    PROBE_KINDS,
    PROBE_META,
    fieldsToProbe,
    probeToFields
  } from '$lib/probes.js';

  let { node, onClose }: { node: Node; onClose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  let name = $state(node.name);
  // svelte-ignore state_referenced_locally
  let menu = $state(node.menu);
  // svelte-ignore state_referenced_locally
  let title = $state(node.title);
  // svelte-ignore state_referenced_locally
  let host = $state(node.host ?? '');
  // svelte-ignore state_referenced_locally
  let probeKind = $state<'' | ProbeKind>(node.probe?.kind ?? '');
  // svelte-ignore state_referenced_locally
  let probeFields = $state<Record<string, string>>(probeToFields(node.probe));

  const currentMeta = $derived(probeKind ? PROBE_META[probeKind] : null);

  function save(event: SubmitEvent) {
    event.preventDefault();
    mutateNode(node.id, (n) => {
      n.name = name.trim() || n.name;
      n.menu = menu;
      n.title = title;
      if (n.type === 'target') {
        n.host = host.trim() || undefined;
      }
      const probe = fieldsToProbe(probeKind, probeFields);
      if (probe) n.probe = probe;
      else delete n.probe;
    });
    onClose();
  }

  function del() {
    if (node.source !== 'custom') return;
    if (!window.confirm($t('edit.deleteConfirm', { values: { name: node.menu } }))) return;
    tree.update((state) => {
      removeNode(state.nodes, node.id);
      return state;
    });
    onClose();
  }

  function fieldLabel(key: string): string {
    switch (key) {
      case 'lookup':
        return $t('edit.lookup');
      case 'recordType':
        return $t('edit.recordType');
      case 'url':
        return $t('edit.url');
      case 'pingport':
        return $t('edit.port');
      default:
        return key;
    }
  }
</script>

<form class="edit-form" onsubmit={save}>
  <div class="grid">
    <label>
      <span>{$t('edit.name')} <em>{$t('edit.nameHint')}</em></span>
      <input bind:value={name} required pattern="[^/\s]+" />
    </label>
    <label>
      <span>{$t('edit.menu')}</span>
      <input bind:value={menu} />
    </label>
    <label class="full">
      <span>{$t('edit.title')}</span>
      <input bind:value={title} />
    </label>
    {#if node.type === 'target'}
      <label class="full">
        <span>{$t('edit.host')}</span>
        <input bind:value={host} placeholder={$t('edit.hostPlaceholder')} />
      </label>
    {/if}
    <label>
      <span>{$t('edit.probe')} {node.type === 'category' ? `(${$t('edit.probeOverrideHint')})` : ''}</span>
      <select bind:value={probeKind}>
        <option value="">{$t('edit.probeInherit')}</option>
        {#each PROBE_KINDS as k (k)}
          <option value={k}>{PROBE_META[k].label}</option>
        {/each}
      </select>
    </label>
    {#if currentMeta}
      {#each currentMeta.fields as field (field.key)}
        <label>
          <span>{fieldLabel(field.key)}</span>
          {#if field.type === 'select'}
            <select bind:value={probeFields[field.key]}>
              {#each field.options ?? [] as opt (opt.value)}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          {:else}
            <input
              type={field.type}
              placeholder={field.placeholder}
              bind:value={probeFields[field.key]}
              required={field.required}
            />
          {/if}
        </label>
      {/each}
    {/if}
  </div>

  <div class="actions">
    <button type="submit" class="primary">{$t('edit.save')}</button>
    <button type="button" onclick={onClose}>{$t('edit.cancel')}</button>
    {#if node.source === 'custom'}
      <button type="button" class="danger" onclick={del}>{$t('edit.delete')}</button>
    {/if}
  </div>
</form>

<style>
  .edit-form {
    margin: 0.25rem 0 0.5rem calc(var(--depth, 0) * 1rem + 1.5rem);
    padding: 0.75rem;
    border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    background: color-mix(in srgb, currentColor 3%, transparent);
    border-radius: 6px;
    font-size: 0.8125rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem 0.75rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }
  label.full {
    grid-column: 1 / -1;
  }
  label span {
    font-size: 0.75rem;
    opacity: 0.7;
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }
  label em {
    font-style: normal;
    font-size: 0.7rem;
    opacity: 0.6;
  }
  input,
  select {
    font: inherit;
    padding: 0.3rem 0.45rem;
    border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    border-radius: 4px;
    background: Canvas;
    color: CanvasText;
  }
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid #38bdf8;
    outline-offset: 1px;
    border-color: transparent;
  }
  .actions {
    margin-top: 0.75rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .actions button {
    font: inherit;
    padding: 0.3rem 0.7rem;
    border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    border-radius: 4px;
    background: Canvas;
    color: CanvasText;
    cursor: pointer;
  }
  .actions button.primary {
    border-color: #38bdf8;
    background: #38bdf8;
    color: #0b1220;
    font-weight: 600;
  }
  .actions button.danger {
    margin-left: auto;
    color: #dc2626;
    border-color: color-mix(in srgb, #dc2626 50%, transparent);
  }
  .actions button:hover:not(.primary) {
    background: color-mix(in srgb, currentColor 6%, transparent);
  }
</style>
