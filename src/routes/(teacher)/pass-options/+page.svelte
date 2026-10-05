<script lang="ts">
  import { account, resetPassAllowance, setPassAllowance, setPassOptions } from '#lib/account.svelte.ts';
  import { shortDate } from '#lib/passes.ts';
  import RequestCard from '#lib/RequestCard.svelte';

  const allowance = $derived(account.passAllowance);
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

  <section class="card">
    <div class="option-row">
      <div>
        <h2>Pass Allowance</h2>
        <p class="muted small">
          How many passes each student gets in a stretch of time. Each class counts on its own. Students see how many
          they have left when they tap their name. Untick a destination's "Counts toward the Pass Allowance" box for
          trips like the Nurse, and mark students with an IEP or 504 plan as exempt on the Students page.
        </p>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          aria-label="Pass Allowance"
          checked={allowance.enabled}
          onchange={(event) => setPassAllowance({ enabled: event.currentTarget.checked })}
        />
        <span aria-hidden="true"></span>
      </label>
    </div>

    {#if allowance.enabled}
      <div class="option-row">
        <div>
          <h2>Passes per student</h2>
        </div>
        <div class="inline">
          <select
            aria-label="Passes per student"
            value={allowance.passes}
            onchange={(event) => setPassAllowance({ passes: Number(event.currentTarget.value) })}
            style="width:80px"
          >
            {#each Array.from({ length: 20 }, (_, index) => index + 1) as option (option)}
              <option value={option}>{option}</option>
            {/each}
          </select>
          <select
            aria-label="Counted"
            value={allowance.per}
            onchange={(event) => setPassAllowance({ per: event.currentTarget.value as 'day' | 'week' | 'reset' })}
          >
            <option value="day">per day</option>
            <option value="week">per week</option>
            <option value="reset">until I reset it</option>
          </select>
        </div>
      </div>

      {#if allowance.per === 'reset'}
        <div class="option-row">
          <div>
            <h2>Counting since {shortDate(allowance.since)}</h2>
            <p class="muted small">Reset at the start of each quarter or term to give every student a fresh count.</p>
          </div>
          <button class="btn" onclick={resetPassAllowance}>Reset</button>
        </div>
      {/if}

      <div class="option-row">
        <div>
          <h2>When a student has used them all</h2>
          <p class="muted small">
            Either way, you can let them go with your PIN at the kiosk, or give them an Extra Pass from the Students
            page. Extra Passes are marked so you can see them later.
          </p>
        </div>
        <select
          aria-label="When a student has used them all"
          value={allowance.whenUsedUp}
          onchange={(event) => setPassAllowance({ whenUsedUp: event.currentTarget.value as 'stop' | 'warn' })}
          style="width:auto"
        >
          <option value="stop">Stop them at the kiosk</option>
          <option value="warn">Warn them, but let them go</option>
        </select>
      </div>
    {/if}
  </section>

  <RequestCard
    title="Need a setting we didn't think of?"
    text="Email us, and we'll add it."
    subject="Happy Hallways: a pass option idea"
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

  .inline {
    display: flex;
    gap: 8px;
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
