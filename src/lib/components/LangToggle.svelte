<script lang="ts">
  import { locale, t } from 'svelte-i18n';

  import { setLanguage, tree } from '$lib/store.js';
  import type { Language } from '$lib/types.js';

  const choices: { value: Language; label: string }[] = [
    { value: 'en', label: 'EN' },
    { value: 'zh-TW', label: '中' }
  ];

  // Keep the i18n locale in sync with the tree's language.
  $effect(() => {
    const lang = $tree.language;
    if ($locale !== lang) locale.set(lang);
  });

  function pick(lang: Language) {
    setLanguage(lang);
    locale.set(lang);
  }
</script>

<div class="lang" role="group" aria-label={$t('language.label')}>
  {#each choices as choice (choice.value)}
    <button
      type="button"
      onclick={() => pick(choice.value)}
      aria-pressed={$tree.language === choice.value}
    >
      {choice.label}
    </button>
  {/each}
</div>

<style>
  .lang {
    display: inline-flex;
    border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    border-radius: 6px;
    overflow: hidden;
  }
  button {
    appearance: none;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    padding: 0.25rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }
  button[aria-pressed='true'] {
    background: color-mix(in srgb, currentColor 15%, transparent);
  }
  button:hover:not([aria-pressed='true']) {
    background: color-mix(in srgb, currentColor 6%, transparent);
  }
  button + button {
    border-left: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  }
</style>
