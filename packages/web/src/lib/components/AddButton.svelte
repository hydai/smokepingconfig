<script lang="ts">
  let {
    onclick,
    label
  }: {
    onclick: () => void;
    label: string;
  } = $props();
</script>

<button type="button" class="add" {onclick}>
  <span aria-hidden="true">＋</span>
  {label}
</button>

<style>
  .add {
    font: inherit;
    font-size: 0.8125rem;
    appearance: none;
    border: 1px dashed color-mix(in srgb, currentColor 25%, transparent);
    background: transparent;
    color: inherit;
    padding: 0.3rem 0.65rem;
    border-radius: 6px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    opacity: 0.75;
    transition:
      opacity 0.12s,
      border-color 0.12s,
      background 0.12s;
  }
  .add:hover {
    opacity: 1;
    border-color: color-mix(in srgb, currentColor 40%, transparent);
    background: color-mix(in srgb, currentColor 5%, transparent);
  }
  .add span {
    font-size: 1em;
    line-height: 1;
  }
</style>
