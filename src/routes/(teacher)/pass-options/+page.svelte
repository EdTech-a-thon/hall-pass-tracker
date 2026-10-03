<script lang="ts">
  import { account, setPassOptions } from '#lib/account.svelte.ts';
  import RequestCard from '#lib/RequestCard.svelte';
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Pass Options</p>
      <h1>How passes work</h1>
      <p class="muted">These apply to every class. Changes reach the kiosk straight away.</p>
    </div>
  </header>

  <section class="card">
    <div class="option-row">
      <div>
        <h2>Most students out at once</h2>
        <p class="muted small">When this many are out, the kiosk asks the next student to wait.</p>
      </div>
      <select
        aria-label="Most students out at once"
        value={account.passLimit}
        onchange={(event) => setPassOptions({ passLimit: Number(event.currentTarget.value) })}
        style="width:90px"
      >
        {#each [1, 2, 3, 4, 5, 6] as option (option)}<option value={option}>{option}</option>{/each}
      </select>
    </div>

    <div class="option-row">
      <div>
        <h2>Let students line up</h2>
        <p class="muted small">
          When everyone allowed is out, students can join a line at the kiosk instead of being turned away. The next
          free spot is held for the first in line, and their name turns green when it's their turn.
        </p>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          aria-label="Let students line up"
          checked={account.lineEnabled}
          onchange={(event) => setPassOptions({ lineEnabled: event.currentTarget.checked })}
        />
        <span aria-hidden="true"></span>
      </label>
    </div>
  </section>

  <RequestCard
    title="Need a setting we didn't think of?"
    text="Email us, and we'll add it."
    subject="Hallway: a pass option idea"
  />
</div>

<style>
  .option-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }

  .option-row + .option-row {
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .option-row p {
    max-width: 60ch;
    margin-top: 3px;
  }

  .switch {
    position: relative;
    flex: 0 0 auto;
    width: 44px;
    height: 26px;
  }

  .switch input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .switch span {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: var(--border-strong);
    pointer-events: none;
    transition: background 0.15s;
  }

  .switch span::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.15s;
  }

  .switch input:checked + span {
    background: var(--accent);
  }

  .switch input:checked + span::after {
    transform: translateX(18px);
  }

  .switch input:focus-visible + span {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
