<script lang="ts">
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import { t } from 'svelte-i18n';
  import type { Node } from '$lib/types.js';
  import { reorderSiblings, setIncluded } from '$lib/store.js';
  import EditForm from './EditForm.svelte';
  import Self from './TreeNode.svelte';

  let { node, depth = 0 }: { node: Node; depth?: number } = $props();

  // `depth` is fixed per node; initial value capture is intentional.
  // svelte-ignore state_referenced_locally
  let expanded = $state(depth === 0);
  let editing = $state(false);

  let childItems = $state<Node[]>([]);
  let childDragging = $state(false);

  $effect(() => {
    if (!childDragging) childItems = [...node.children];
  });

  function handleChildConsider(event: CustomEvent<DndEvent<Node>>) {
    childDragging = true;
    childItems = event.detail.items;
  }

  function handleChildFinalize(event: CustomEvent<DndEvent<Node>>) {
    childItems = event.detail.items;
    childDragging = false;
    reorderSiblings(
      node.id,
      childItems.map((n) => n.id)
    );
  }

  const isCategory = $derived(node.type === 'category' && node.children.length > 0);

  function countLeaves(n: Node, onlyIncluded: boolean): number {
    if (n.type === 'target') return onlyIncluded && !n.included ? 0 : 1;
    let total = 0;
    for (const child of n.children) total += countLeaves(child, onlyIncluded);
    return total;
  }

  const total = $derived(countLeaves(node, false));
  const enabled = $derived(countLeaves(node, true));

  function toggleIncluded(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    setIncluded(node.id, input.checked);
  }

  function toggleExpanded() {
    expanded = !expanded;
  }

  function toggleEdit() {
    editing = !editing;
  }
</script>

<div class="row" style:--depth={depth}>
  {#if isCategory}
    <button
      type="button"
      class="chevron"
      onclick={toggleExpanded}
      aria-label={expanded ? $t('tree.collapse') : $t('tree.expand')}
      aria-expanded={expanded}
    >
      {expanded ? '▾' : '▸'}
    </button>
  {:else}
    <span class="chevron spacer" aria-hidden="true"></span>
  {/if}

  <label class="label" class:dim={!node.included}>
    <input
      type="checkbox"
      checked={node.included}
      onchange={toggleIncluded}
      aria-label={$t('tree.includeNode', { values: { name: node.menu } })}
    />
    <span class="name">{node.menu}</span>
    {#if isCategory}
      <span class="count">({enabled}/{total})</span>
    {:else if node.host}
      <span class="host">{node.host}</span>
    {/if}
  </label>

  <button
    type="button"
    class="edit"
    onclick={toggleEdit}
    aria-label={editing
      ? $t('tree.editClose', { values: { name: node.menu } })
      : $t('tree.editOpen', { values: { name: node.menu } })}
    aria-pressed={editing}
  >
    ✎
  </button>
</div>

{#if editing}
  <div style:--depth={depth}>
    <EditForm {node} onClose={() => (editing = false)} />
  </div>
{/if}

{#if expanded && node.children.length > 0}
  <div
    class="children"
    role="group"
    use:dndzone={{
      items: childItems,
      flipDurationMs: 180,
      type: `p:${node.id}`,
      dropTargetStyle: {}
    }}
    onconsider={handleChildConsider}
    onfinalize={handleChildFinalize}
  >
    {#each childItems as child (child.id)}
      <div>
        <Self node={child} depth={depth + 1} />
      </div>
    {/each}
  </div>
{/if}

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0;
    padding-left: calc(var(--depth) * 1rem);
    border-radius: 4px;
  }
  .row:hover {
    background: color-mix(in srgb, currentColor 6%, transparent);
  }
  .chevron {
    width: 1.25rem;
    height: 1.25rem;
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 0.8em;
    cursor: pointer;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .chevron:hover:not(.spacer) {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
  .chevron.spacer {
    cursor: default;
  }
  .label {
    display: inline-flex;
    align-items: baseline;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
    flex: 1;
    min-width: 0;
  }
  .label.dim .name,
  .label.dim .host,
  .label.dim .count {
    opacity: 0.45;
  }
  .name {
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }
  .count {
    font-variant-numeric: tabular-nums;
    font-size: 0.8rem;
    opacity: 0.6;
  }
  .host {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    opacity: 0.6;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }
  input[type='checkbox'] {
    accent-color: #38bdf8;
    cursor: pointer;
  }
  .edit {
    opacity: 0;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-size: 0.85em;
    transition: opacity 0.12s;
  }
  .row:hover .edit,
  .edit:focus-visible,
  .edit[aria-pressed='true'] {
    opacity: 0.8;
  }
  .edit:hover {
    background: color-mix(in srgb, currentColor 12%, transparent);
    opacity: 1;
  }
</style>
