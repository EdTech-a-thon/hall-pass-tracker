<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A small panel that opens under its button, like a filter's choices. It's
   * fixed to the window so a scrolling table never clips it, opens upward when
   * there's no room below, and closes on Escape or a click outside.
   */
  let {
    open = $bindable(false),
    trigger,
    children,
    minWidth = 220,
  }: {
    open: boolean;
    trigger: Snippet<[{ toggle: () => void }]>;
    children: Snippet<[{ close: () => void }]>;
    minWidth?: number;
  } = $props();

  let anchor: HTMLDivElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();
  let position = $state({ top: 0, bottom: 0, left: 0, above: false });

  const close = () => (open = false);
  const toggle = () => (open = !open);

  function place() {
    if (!anchor) return;
    const box = anchor.getBoundingClientRect();
    position = {
      top: box.bottom + 4,
      bottom: window.innerHeight - box.top + 4,
      left: Math.min(box.left, window.innerWidth - minWidth - 16),
      above: box.bottom + 320 > window.innerHeight && box.top > 320,
    };
  }

  $effect(() => {
    if (!open) return;
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  });

  function onOutside(event: PointerEvent) {
    const target = event.target as Node;
    if (open && !anchor?.contains(target) && !panel?.contains(target)) close();
  }
</script>

<svelte:window onpointerdown={onOutside} onkeydown={(event) => open && event.key === 'Escape' && close()} />

<div class="popover-anchor" bind:this={anchor}>
  {@render trigger({ toggle })}
</div>

{#if open}
  <div
    class="popover"
    bind:this={panel}
    style:top={position.above ? 'auto' : `${position.top}px`}
    style:bottom={position.above ? `${position.bottom}px` : 'auto'}
    style:left="{position.left}px"
    style:min-width="{minWidth}px"
  >
    {@render children({ close })}
  </div>
{/if}

<style>
  .popover-anchor {
    display: inline-block;
  }

  .popover {
    position: fixed;
    z-index: 60;
    max-width: 360px;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    box-shadow: 0 8px 24px rgb(42 38 31 / 14%);
  }
</style>
