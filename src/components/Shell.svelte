<script lang="ts">
  import type { Snippet } from 'svelte';

  let { mode, children }: { mode: 'kiosk' | 'teacher'; children: Snippet } = $props();
</script>

<div class="app-shell {mode}">
  <header class="topbar">
    <a class="brand" href="#top" onclick={(event) => event.preventDefault()}>
      <span class="brand-mark">H</span><span>Hallway</span>
    </a>
    <div class="mode-badge">
      <span></span>{mode === 'kiosk' ? 'Student kiosk' : 'Teacher workspace'}
    </div>
  </header>
  {@render children()}
  <footer class="test-footer">Test environment · no production student data</footer>
</div>
