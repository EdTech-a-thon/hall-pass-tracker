<script lang="ts">
  import type { Snippet } from 'svelte';
  import BrandMark from '../BrandMark.svelte';

  let { children }: { children?: Snippet } = $props();
</script>

<header class="welcome-header">
  <a class="wordmark" href="/welcome"><BrandMark size={34} />Happy Hallways</a>
  <nav aria-label="Site">{@render children?.()}</nav>
</header>

<style>
  .welcome-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px 20px;
    flex-wrap: wrap;
    width: min(1120px, calc(100% - 32px));
    min-height: 76px;
    margin: 0 auto;
  }

  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    font-size: 19px;
    font-weight: 800;
    letter-spacing: -0.02em;
    text-decoration: none;
  }

  nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 6px 22px;
  }

  nav :global(a:not(.cta)) {
    color: var(--muted);
    font-weight: 700;
    text-decoration: none;
  }

  nav :global(a:not(.cta):hover) {
    color: var(--text);
  }
</style>
