<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import { tree } from '$lib/store.js';
  import { readHashState } from '$lib/url-state.js';

  let { children } = $props();

  onMount(() => {
    const fromHash = readHashState();
    if (fromHash) tree.set(fromHash);
  });
</script>

{@render children()}
