<script lang="ts">
  import { onMount } from 'svelte';
  import { locale, waitLocale } from 'svelte-i18n';
  import '../app.css';
  import '$lib/i18n/index.js';
  import { tree } from '$lib/store.js';
  import { readHashState } from '$lib/url-state.js';

  let { children } = $props();
  let ready = $state(false);

  onMount(async () => {
    const fromHash = readHashState();
    if (fromHash) tree.set(fromHash);
    locale.set(fromHash?.language ?? 'en');
    await waitLocale();
    ready = true;
  });
</script>

{#if ready}
  {@render children()}
{/if}
