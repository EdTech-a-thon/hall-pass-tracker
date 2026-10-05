<script lang="ts">
  import { account, holdsOn, letStudentGo } from './account.svelte';
  import Icon from './Icon.svelte';
  import { link } from './link.svelte';
  import Modal from './Modal.svelte';
  import { displayName } from './roster';
  import type { Class } from './types';

  /**
   * Lists the class with whatever is stopping each student right now: a
   * used-up allowance, No-Pass Time, or waiting in a line. One click lets a
   * student past all of it; they then tap their name at the kiosk.
   */
  let { cls, onClose }: { cls: Class; onClose: () => void } = $props();

  // The kiosk can only use what the laptop gives it once the two are talking.
  const kioskReachable = $derived(account.kiosk?.kind === 'this-computer' || link.status === 'live');

  const rows = $derived(
    cls.students
      .filter((student) => student.status === 'current')
      .map((student) => ({ id: student.id, name: displayName(student), holds: holdsOn(cls.id, student.id) }))
      .sort((a, b) => b.holds.length - a.holds.length || a.name.localeCompare(b.name)),
  );
</script>

<Modal {onClose} labelledby="let-go-title">
  <div class="dialog" style="width:min(620px,100%)">
    <div class="dialog-head">
      <div>
        <h2 id="let-go-title">Let a student go</h2>
        <p class="muted small">
          Lets them past whatever is stopping them right now. They tap their name at the kiosk to go, and their pass
          shows that you let them.
        </p>
      </div>
    </div>

    {#if !kioskReachable}
      <div class="notice-bar">
        <Icon name="alert-triangle" />The kiosk is offline, so it can't hear about this. Let them go at the kiosk with your
        PIN instead.
      </div>
    {/if}

    <ul class="let-go-list">
      {#each rows as row (row.id)}
        {@const waiting = row.holds.filter((hold) => !hold.given)}
        <li>
          <div>
            <strong>{row.name}</strong>
            <div class="row" style="gap:6px;flex-wrap:wrap">
              {#each row.holds as hold (hold.kind)}
                <span class="badge" class:warn={!hold.given} class:ok={hold.given}>{hold.text}</span>
              {:else}
                <span class="muted small">Nothing's stopping them</span>
              {/each}
            </div>
          </div>
          {#if waiting.length}
            <button class="btn btn-small btn-primary" disabled={!kioskReachable} onclick={() => letStudentGo(cls.id, row.id)}>
              Let {row.name} go
            </button>
          {:else if row.holds.length}
            <span class="muted small"><Icon name="check" size={14} /> Let go: they can tap their name at the kiosk</span>
          {/if}
        </li>
      {/each}
    </ul>

    <div class="dialog-actions">
      <button class="btn" onclick={onClose}>Done</button>
    </div>
  </div>
</Modal>

<style>
  .let-go-list {
    display: grid;
    gap: 0;
    max-height: 60vh;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  .let-go-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 0;
    border-top: 1px solid var(--border);
  }
</style>
