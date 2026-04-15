<script lang="ts">
  import { dndzone, type DndEvent } from 'svelte-dnd-action';

  import { reorderSiblings, tree } from '$lib/store.js';
  import type { Node } from '$lib/types.js';
  import TreeNode from './TreeNode.svelte';

  const flipDurationMs = 180;

  let items = $state<Node[]>([]);
  let dragging = $state(false);

  $effect(() => {
    if (!dragging) items = [...$tree.nodes];
  });

  function handleConsider(event: CustomEvent<DndEvent<Node>>) {
    dragging = true;
    items = event.detail.items;
  }

  function handleFinalize(event: CustomEvent<DndEvent<Node>>) {
    items = event.detail.items;
    dragging = false;
    reorderSiblings(
      null,
      items.map((n) => n.id)
    );
  }
</script>

<div
  class="tree"
  aria-label="SmokePing targets"
  use:dndzone={{ items, flipDurationMs, type: 'root', dropTargetStyle: {} }}
  onconsider={handleConsider}
  onfinalize={handleFinalize}
>
  {#each items as node (node.id)}
    <div>
      <TreeNode {node} depth={0} />
    </div>
  {/each}
</div>

<style>
  .tree {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    font-size: 0.9375rem;
  }
</style>
