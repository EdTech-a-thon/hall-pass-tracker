<script lang="ts">
  import Shell from './Shell.svelte';
  import { app, forgetKiosk, submitStudentId } from '../lib/store.svelte';

  let error = $state('');

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    error = submitStudentId(String(new FormData(form).get('studentId')));
    form.reset();
  }
</script>

<Shell mode="kiosk">
  <main class="kiosk-main">
    <section class="kiosk-intro">
      <p class="eyebrow">{app.kioskLabel.toUpperCase()}</p>
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

    <section class="currently-out" aria-labelledby="scope-title">
      <div>
        <p class="eyebrow">WHAT THIS SCREEN CAN DO</p>
        <h2 id="scope-title">Sign out, sign back in</h2>
      </div>
      <div class="out-chips">
        <span class="empty-chip">It cannot see who is out, or read any past pass.</span>
      </div>
    </section>

    <button class="corner-link" onclick={forgetKiosk}>Stop using this device as a kiosk</button>
  </main>
</Shell>
