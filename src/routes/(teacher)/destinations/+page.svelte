<script lang="ts">
  import { account } from '#lib/account.svelte.ts';
  import DestinationDialog from '#lib/DestinationDialog.svelte';
  import DestinationIcon from '#lib/DestinationIcon.svelte';
  import Icon from '#lib/Icon.svelte';
  import { updateOnboarding } from '#lib/onboarding.svelte.ts';
  import type { Destination } from '#lib/types.ts';

  /** undefined: closed. null: adding a new one. */
  let editing = $state<Destination | null | undefined>(undefined);

  // Looking over the destinations ticks them off the getting-started checklist.
  updateOnboarding({ visitedDestinations: true });
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Destinations</p>
      <h1>Where students can go</h1>
      <p class="muted">
        One list for all your classes. Students see these at the kiosk, with the color and icon you choose.
      </p>
    </div>
    <button class="btn btn-primary" onclick={() => (editing = null)}><Icon name="plus" size={16} />Add destination</button>
  </header>

  <div class="destination-cards">
    {#each account.destinations as destination (destination.id)}
      <button class="destination-card" onclick={() => (editing = destination)}>
        <DestinationIcon label={destination.label} size={44} />
        <div>
          <strong>{destination.label}</strong>
          <p class="muted small">{destination.minutes ? `${destination.minutes} minutes` : 'No time limit'}</p>
        </div>
      </button>
    {/each}
    <button class="destination-card add" onclick={() => (editing = null)}>
      <Icon name="plus" size={22} />Add destination
    </button>
  </div>

  {#if !account.destinations.length}
    <div class="notice-bar"><Icon name="alert-triangle" />Students can't sign out until there's at least one destination.</div>
  {/if}
</div>

{#if editing !== undefined}
  <DestinationDialog destination={editing} onClose={() => (editing = undefined)} />
{/if}
