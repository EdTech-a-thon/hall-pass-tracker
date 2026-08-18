<script lang="ts">
  import Shell from './Shell.svelte';
  import { dueTime } from '../lib/passes';
  import { app, lockKiosk, out, submitStudentId } from '../lib/store.svelte';

  let error = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const id = String(new FormData(form).get('studentId'));
    error = await submitStudentId(id);
    if (error) form.reset();
  }
</script>

<Shell mode="kiosk">
  <main class="kiosk-main">
    <section class="kiosk-intro">
      <p class="eyebrow">ROOM 214 · PERIOD 3</p>
      <h1>Where are you headed?</h1>
      <p>Enter your student ID to request a pass or check back in.</p>
    </section>

    <section class="id-card">
      <form onsubmit={submit}>
        <label for="student-id">Student ID</label>
        <div class="id-row">
          <input
            id="student-id"
            name="studentId"
            type="password"
            inputmode="numeric"
            pattern={'[0-9]{4}'}
            minlength="4"
            maxlength="4"
            autocomplete="off"
            placeholder="••••"
            aria-describedby="id-help"
            required
          />
          <button class="button dark" type="submit">Continue →</button>
        </div>
        <p id="id-help" class="muted">Your ID is hidden while you type.</p>
        <p class="form-error" role="alert">{error}</p>
      </form>
    </section>

    <section class="currently-out" aria-labelledby="out-title">
      <div>
        <p class="eyebrow">LIVE STATUS</p>
        <h2 id="out-title">Currently out <span>{out().length} / {app.classroom.limit}</span></h2>
      </div>
      <div class="out-chips">
        {#each out() as pass (pass.id)}
          <span><i>{pass.studentName.charAt(0)}</i>{pass.studentName} · due {dueTime(pass)}</span>
        {:else}
          <span class="empty-chip">Everyone is in class</span>
        {/each}
      </div>
    </section>

    <button class="corner-link" onclick={lockKiosk}>Lock kiosk</button>
  </main>
</Shell>
