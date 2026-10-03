<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The dimmed layer behind every pop-up. Escape closes it, and so does a click
   * on the dimmed area. The click must start there too, so dragging to select
   * text in a field and letting go outside the box doesn't close it by accident.
   */
  let {
    onClose,
    labelledby,
    label,
    overlay = 'backdrop',
    children,
  }: {
    onClose: () => void;
    labelledby?: string;
    label?: string;
    /** The kiosk uses its own, larger overlay style. */
    overlay?: 'backdrop' | 'overlay';
    children: Snippet;
  } = $props();

  let pressedOutside = false;
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />

<div
  class={overlay}
  role="dialog"
  aria-modal="true"
  aria-labelledby={labelledby}
  aria-label={label}
  tabindex="-1"
  onpointerdown={(event) => (pressedOutside = event.target === event.currentTarget)}
  onclick={(event) => {
    if (pressedOutside && event.target === event.currentTarget) onClose();
    pressedOutside = false;
  }}
  onkeydown={() => {}}
>
  {@render children()}
</div>
