<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * A small link button beside a guide heading. Clicking it copies the address
   * of that section, so a teacher can paste it into an email and the reader
   * lands right on it. It's a real link too, so right-click "Copy link" works.
   */
  let { id }: { id: string } = $props();

  let copied = $state(false);

  async function copy(event: MouseEvent) {
    event.preventDefault();
    const address = `${location.origin}${location.pathname}#${id}`;
    history.replaceState(history.state, '', `#${id}`);
    try {
      await navigator.clipboard.writeText(address);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // Some browsers only allow copying on secure pages; the address bar now shows the link to copy by hand.
    }
  }
</script>

<a class="section-link" href="#{id}" onclick={copy} aria-label="Copy a link to this section" title="Copy a link to this section">
  <Icon name={copied ? 'check' : 'link'} size={16} />
  {#if copied}<span class="copied" role="status">Link copied</span>{/if}
</a>

<style>
  .section-link {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 6px;
    padding: 4px;
    border-radius: 6px;
    color: var(--muted);
    opacity: 0.55;
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    transition: opacity 120ms;
  }

  .section-link:hover,
  .section-link:focus-visible,
  :global(h2:hover) > .section-link {
    opacity: 1;
    color: var(--accent);
  }

  .copied {
    color: var(--accent);
  }
</style>
