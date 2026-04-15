<script lang="ts">
  import Actions from '$lib/components/Actions.svelte';
  import Preview from '$lib/components/Preview.svelte';
  import TreeView from '$lib/components/TreeView.svelte';
</script>

<div class="app">
  <header>
    <div class="title">
      <h1>SmokePing Config Builder</h1>
      <p class="sub">Pick targets, preview the <code>Targets</code> file, copy or download.</p>
    </div>
  </header>

  <main class="layout">
    <section class="pane tree-pane" aria-label="Targets tree">
      <h2>Targets</h2>
      <TreeView />
    </section>
    <section class="pane preview-pane" aria-label="Generated config">
      <div class="pane-header">
        <h2>Preview</h2>
        <Actions />
      </div>
      <Preview />
    </section>
  </main>
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .title h1 {
    margin: 0;
    font-size: 1.125rem;
    letter-spacing: -0.01em;
  }
  .title .sub {
    margin: 0;
    font-size: 0.8125rem;
    opacity: 0.6;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.9em;
    padding: 0.05em 0.25em;
    background: color-mix(in srgb, currentColor 10%, transparent);
    border-radius: 3px;
  }
  .layout {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(320px, 1fr) 1fr;
    gap: 1px;
    background: color-mix(in srgb, currentColor 12%, transparent);
    min-height: 0;
  }
  .pane {
    background: Canvas;
    padding: 1rem 1.5rem;
    overflow: auto;
    min-height: 0;
  }
  .pane h2 {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.6;
  }
  .pane-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }
  .preview-pane {
    display: flex;
    flex-direction: column;
  }
  @media (max-width: 768px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
</style>
