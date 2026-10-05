<script lang="ts">
  import Modal from './Modal.svelte';
  import { account, deleteDestination, saveDestination } from './account.svelte';
  import { destinationColors, type DestinationColor, type DestinationIcon } from './destinations';
  import { destinationIconGroups } from './icons';
  import Icon from './Icon.svelte';
  import { newId } from './passes';
  import type { Destination } from './types';

  /** Edits one destination, or creates one when `destination` is null. */
  let { destination, onClose }: { destination: Destination | null; onClose: () => void } = $props();

  // The dialog edits a copy; nothing changes until Save.
  // svelte-ignore state_referenced_locally
  let label = $state(destination?.label ?? '');
  // A number field hands back a number, or null while it's empty.
  // svelte-ignore state_referenced_locally
  let minutes = $state<number | null>(destination?.minutes ?? null);
  // svelte-ignore state_referenced_locally
  let color = $state<DestinationColor>(destination?.color ?? 'green');
  // svelte-ignore state_referenced_locally
  let icon = $state<DestinationIcon>(destination?.icon ?? 'map-pin');
  // svelte-ignore state_referenced_locally
  let counts = $state(destination?.countsTowardAllowance !== false);
  let error = $state('');

  const colorNames = Object.keys(destinationColors) as DestinationColor[];

  /** Icon names read as words: "glass-water" is found by "water". */
  let iconSearch = $state('');
  const iconGroups = $derived(
    Object.entries(destinationIconGroups)
      .map(([group, names]) => ({
        group,
        names: names.filter((name) => name.replaceAll('-', ' ').includes(iconSearch.trim().toLowerCase())),
      }))
      .filter((entry) => entry.names.length),
  );

  function save(event: SubmitEvent) {
    event.preventDefault();
    const name = label.trim();
    const limit = typeof minutes === 'number' && !Number.isNaN(minutes) ? Math.round(minutes) : null;
    if (!name) {
      error = 'Give the destination a name.';
      return;
    }
    if (account.destinations.some((each) => each.id !== destination?.id && each.label.toLowerCase() === name.toLowerCase())) {
      error = `There's already a destination called ${name}.`;
      return;
    }
    if (limit !== null && !(limit >= 1 && limit <= 120)) {
      error = 'Minutes should be between 1 and 120, or left empty for no time limit.';
      return;
    }
    const saved: Destination = { id: destination?.id ?? newId(), label: name, minutes: limit, color, icon };
    if (!counts) saved.countsTowardAllowance = false;
    saveDestination(saved);
    onClose();
  }

  function remove() {
    if (destination) deleteDestination(destination.id);
    onClose();
  }
</script>

<Modal onClose={onClose} labelledby="destination-title">
  <form class="dialog destination-dialog" style="width:min(560px,100%)" onsubmit={save}>
    <div class="dialog-head">
      <h2 id="destination-title">{destination ? `Edit ${destination.label}` : 'New destination'}</h2>
      <span
        class="destination-icon"
        style:width="44px"
        style:height="44px"
        style:background={destinationColors[color].soft}
        style:color={destinationColors[color].strong}
        aria-hidden="true"
      >
        <Icon name={icon} size={24} />
      </span>
    </div>

    <label class="field">Name <input bind:value={label} placeholder="Library" /></label>

    <label class="field">
      Minutes the trip should take (optional)
      <input type="number" min="1" max="120" bind:value={minutes} placeholder="No time limit" style="max-width:160px" />
      <span class="muted small" style="font-weight:500">Leave it empty if this trip has no time limit. It'll never show as overdue.</span>
    </label>

    <label class="check">
      <input type="checkbox" bind:checked={counts} />
      <span>
        Counts toward the Pass Allowance
        <span class="muted small">Untick for trips that shouldn't use up a student's passes, like the Nurse.</span>
      </span>
    </label>

    <div class="field">
      <span>Color</span>
      <div class="swatches" role="group" aria-label="Color">
        {#each colorNames as name (name)}
          <button
            type="button"
            class="swatch"
            style:background={destinationColors[name].strong}
            aria-label={name}
            aria-pressed={color === name}
            onclick={() => (color = name)}
          ></button>
        {/each}
      </div>
    </div>

    <div class="field icon-field">
      <span>Icon</span>
      <input type="search" placeholder="Search icons, e.g. water, book, bus" bind:value={iconSearch} aria-label="Search icons" />
      <div class="icon-groups">
        {#each iconGroups as entry (entry.group)}
          <p class="eyebrow">{entry.group}</p>
          <div class="icon-choices" role="group" aria-label={entry.group}>
            {#each entry.names as name (name)}
              <button
                type="button"
                class="icon-choice"
                style:color={icon === name ? destinationColors[color].strong : ''}
                title={name.replaceAll('-', ' ')}
                aria-label={name.replaceAll('-', ' ')}
                aria-pressed={icon === name}
                onclick={() => (icon = name)}
              >
                <Icon {name} size={20} />
              </button>
            {/each}
          </div>
        {:else}
          <p class="muted small">No icons match "{iconSearch}".</p>
        {/each}
      </div>
    </div>

    {#if error}<p class="form-error" role="alert">{error}</p>{/if}

    <div class="dialog-actions" style="justify-content:space-between">
      {#if destination}
        <button type="button" class="btn btn-danger" onclick={remove}><Icon name="trash" size={15} />Delete</button>
      {:else}
        <span></span>
      {/if}
      <div class="row">
        <button type="button" class="btn" onclick={onClose}>Cancel</button>
        <button class="btn btn-primary">Save</button>
      </div>
    </div>
  </form>
</Modal>
