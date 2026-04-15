<script lang="ts">
  import { onMount } from 'svelte';
  import { locale, waitLocale } from 'svelte-i18n';
  import '../app.css';
  import '$lib/i18n/index.js';
  import { readHashState } from '@smokepingconf/core';
  import { baseCatalog, tree } from '$lib/store.js';

  let { children } = $props();
  let ready = $state(false);

  onMount(async () => {
    const fromHash = readHashState(baseCatalog);
    if (fromHash) tree.set(fromHash);
    locale.set(fromHash?.language ?? 'en');
    await waitLocale();
    ready = true;
  });
</script>

{#if ready}
  {@render children()}
{/if}
