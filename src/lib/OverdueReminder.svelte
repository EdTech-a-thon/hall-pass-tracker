<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { account, markReturned, openPasses } from './account.svelte';
  import Icon from './Icon.svelte';
  import { link } from './link.svelte';
  import { duration, isOverdue } from './passes';
  import Toast from './Toast.svelte';

  /**
   * The Overdue Reminder: every teacher page shows each overdue student, as a
   * toast, until they are back. It can't be dismissed while they are still out. The kiosk
   * never shows it. See CONTEXT.md and docs/adr/0003.
   */

  // Re-read the clock every 15 seconds so a pass shows up soon after it becomes overdue.
  let clock = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (clock = Date.now()), 15_000);
    return () => clearInterval(timer);
  });

  const overdue = $derived(
    openPasses()
      .filter((pass) => isOverdue(pass, clock))
      .sort((a, b) => a.outAt.localeCompare(b.outAt)),
  );

  /** A paired kiosk that can't reach this tab may already have signed these students back in. */
  const mayBeOutOfDate = $derived(account.kiosk?.kind === 'device' && link.status !== 'live');

  // Put the count at the front of the tab's title, so a teacher in another tab still sees it.
  const titlePrefix = /^\(\d+\) Overdue · /;
  let navigated = $state(0);
  afterNavigate(() => navigated++);
  $effect(() => {
    void navigated;
    const base = document.title.replace(titlePrefix, '');
    document.title = overdue.length ? `(${overdue.length}) Overdue · ${base}` : base;
  });
  $effect(() => () => {
    document.title = document.title.replace(titlePrefix, '');
  });
</script>

{#if overdue.length}
  <Toast icon="clock" tone="warn" class="overdue-reminder">
    <div class="stack" style="gap:8px">
      <ul class="overdue-list">
        {#each overdue as pass (pass.id)}
          <li>
            <span>
              {pass.studentName} has been at the {pass.destination} for {duration(pass, clock)} min (expected {pass.minutes})
            </span>
            <button class="btn btn-small" onclick={() => markReturned(pass.id)}>
              <Icon name="check" size={14} />Mark back
            </button>
          </li>
        {/each}
      </ul>
      {#if mayBeOutOfDate}
        <span class="small" style="font-weight:500">
          The kiosk is offline, so this may be out of date. Check the door before marking anyone back.
        </span>
      {/if}
    </div>
  </Toast>
{/if}

<style>
  .overdue-list {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .overdue-list li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px 12px;
  }
</style>
