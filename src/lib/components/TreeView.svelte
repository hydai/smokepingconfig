<script lang="ts">
  import { tree } from '$lib/store.js';
  import TreeNode from './TreeNode.svelte';
</script>

<div class="tree" role="tree" aria-label="SmokePing targets">
  {#each $tree.nodes as node (node.id)}
    <TreeNode {node} depth={0} />
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
