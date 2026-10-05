<script lang="ts">
  import { goto } from '$app/navigation';
  import { account, markUpdatesSeen } from './account.svelte';
  import Modal from './Modal.svelte';
  import UpdateArt from './UpdateArt.svelte';
  import { unseenUpdates } from './updates';

  /**
   * "What's changed": shown once to a returning teacher after an update, on
   * the laptop only. Closing it in any way counts as having seen it.
   */
  const items = $derived(unseenUpdates(account.seenUpdate).flatMap((update) => update.items));

  function reviewDestinations() {
    markUpdatesSeen();
    goto('/destinations');
  }
</script>

{#if items.length}
  <Modal onClose={markUpdatesSeen} labelledby="whats-changed-title">
    <div class="dialog whats-changed">
      <div>
        <p class="eyebrow">What's changed</p>
        <h2 id="whats-changed-title">Thank you for all your feedback</h2>
        <p class="muted">Here's what's new in Happy Hallways.</p>
      </div>

      <ol class="changes">
        {#each items as item (item.title)}
          <li>
            <div>
              <h3>{item.title}</h3>
              <p class="muted">{item.text}</p>
            </div>
            <UpdateArt art={item.art} />
          </li>
        {/each}
      </ol>

      <div class="dialog-actions">
        <button class="btn" onclick={reviewDestinations}>Review destinations</button>
        <button class="btn btn-primary" onclick={markUpdatesSeen}>Got it</button>
      </div>
    </div>
  </Modal>
{/if}

<style>
  .whats-changed {
    width: min(860px, 100%);
    max-height: calc(100vh - 32px);
    overflow-y: auto;
  }

  .changes {
    display: grid;
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .changes li {
    display: grid;
    grid-template-columns: 1fr minmax(0, 260px);
    align-items: center;
    gap: 28px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  h3 {
    margin-bottom: 6px;
    font-size: 18px;
  }

  @media (max-width: 640px) {
    .changes li {
      grid-template-columns: 1fr;
      gap: 12px;
    }
  }
</style>
