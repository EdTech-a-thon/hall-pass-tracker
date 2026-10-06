<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import Popover from './Popover.svelte';

  /**
   * A menu that reads as part of a sentence ("Math · Period 1 ▾") until it's
   * clicked, then lists the choices. It shows what's true, not what was
   * clicked: the page decides whether a choice happens (after asking, say).
   */
  let {
    label,
    value,
    options,
    onchoose,
    icon,
  }: {
    /** What the menu chooses, for screen readers: "Schedule". */
    label: string;
    value: string;
    options: { value: string; label: string; disabled?: boolean; hint?: string }[];
    onchoose: (value: string) => void;
    icon?: IconName;
  } = $props();

  let open = $state(false);
  const current = $derived(options.find((option) => option.value === value)?.label ?? 'Choose…');
</script>

<Popover bind:open minWidth={240}>
  {#snippet trigger({ toggle })}
    <button class="menu-button" aria-label="{label}: {current}" aria-haspopup="menu" aria-expanded={open} onclick={toggle}>
      {#if icon}<Icon name={icon} size={16} />{/if}
      <span>{current}</span>
      <Icon name="chevron-down" size={16} />
    </button>
  {/snippet}
  {#snippet children({ close })}
    <div class="menu" role="menu" aria-label={label}>
      {#each options as option (option.value)}
        <button
          class="choice"
          role="menuitemradio"
          aria-checked={option.value === value}
          disabled={option.disabled}
          onclick={() => {
            close();
            if (option.value !== value) onchoose(option.value);
          }}
        >
          <span class="check">{#if option.value === value}<Icon name="check" size={15} />{/if}</span>
          <span class="choice-text">
            {option.label}
            {#if option.hint}<span class="hint">{option.hint}</span>{/if}
          </span>
        </button>
      {/each}
    </div>
  {/snippet}
</Popover>

<style>
  .menu-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  .menu-button:hover,
  .menu-button[aria-expanded='true'] {
    background: var(--surface-sunk);
  }

  .menu {
    display: grid;
  }

  .choice {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 7px 8px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--text);
    font-size: 14px;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }

  .choice:hover:not(:disabled) {
    background: var(--surface-sunk);
  }

  .choice:disabled {
    color: var(--faint);
    cursor: default;
  }

  .check {
    display: inline-grid;
    flex: none;
    width: 16px;
    color: var(--accent);
  }

  .choice-text {
    display: grid;
  }

  .hint {
    color: var(--muted);
    font-size: 12.5px;
    font-weight: 600;
  }
</style>
