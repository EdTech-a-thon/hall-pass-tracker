<script lang="ts">
  import Shell from './Shell.svelte';
  import MfaForm from './MfaForm.svelte';
  import { app, signInTeacher } from '../lib/store.svelte';

  let error = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (app.submitting) return;
    const data = new FormData(event.target as HTMLFormElement);
    app.submitting = true;
    error = '';
    try {
      error = await signInTeacher(String(data.get('email')).trim().toLowerCase(), String(data.get('password')));
    } finally {
      app.submitting = false;
    }
  }
</script>

<Shell mode="teacher">
  <main class="login-wrap">
    <section class="login-copy">
      <p class="eyebrow">PRIVATE TEACHER ACCESS</p>
      <h1>Your class, at a glance.</h1>
      <p>Review passes, spot patterns, and keep student information protected.</p>
      <div class="privacy-note">
        <span class="lock-icon">▣</span>
        <div>
          <strong>Kiosks cannot read your class</strong><br />
          <span>The device by the door signs students out and in. It can never read the log.</span>
        </div>
      </div>
    </section>

    <section class="login-card" aria-labelledby="login-title">
      {#if app.pendingMfa}
        <MfaForm />
      {:else}
        <div class="login-icon">T</div>
        <p class="eyebrow">TEACHER SIGN IN</p>
        <h2 id="login-title">Welcome back</h2>
        <p class="muted">Use your verified school account. Teacher sessions end on refresh.</p>
        {#if app.startupError}
          <p class="form-error">{app.startupError}</p>
        {/if}
        <form onsubmit={submit}>
          <label>
            Email address
            <input name="email" type="email" autocomplete="username" maxlength="254" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autocomplete="current-password" minlength="12" maxlength="128" required />
          </label>
          <p class="form-error" role="alert">{error}</p>
          <button class="button primary full" type="submit" disabled={app.submitting}>Open teacher workspace</button>
        </form>

        <div class="switch-login">
          New to Hallway?
          <button class="link-button" onclick={() => (app.view = 'teacher-register')}>Create a classroom account</button>
        </div>
        <div class="switch-login">
          <span>Using this device by the door?</span>
          <span>Sign in here, then choose Enter kiosk mode.</span>
        </div>
      {/if}
    </section>
  </main>
</Shell>
