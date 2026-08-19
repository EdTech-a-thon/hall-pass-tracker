<script lang="ts">
  import Shell from './Shell.svelte';
  import { app, registerTeacher } from '../lib/store.svelte';

  let error = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (app.submitting) return;
    const data = new FormData(event.target as HTMLFormElement);
    const password = String(data.get('password'));
    if (password !== String(data.get('passwordConfirm'))) {
      error = 'The passwords do not match.';
      return;
    }
    app.submitting = true;
    try {
      error = await registerTeacher({
        displayName: String(data.get('displayName')).trim(),
        email: String(data.get('email')).trim().toLowerCase(),
        password,
        passwordConfirm: password,
      });
    } finally {
      app.submitting = false;
    }
  }
</script>

<Shell mode="teacher">
  <main class="login-wrap">
    <section class="login-copy">
      <p class="eyebrow">NEW CLASSROOM</p>
      <h1>Create your private workspace.</h1>
      <p>
        Each account represents one teacher and one classroom. Your roster and your hall pass log
        are visible to you alone, and never to another workspace.
      </p>
      <div class="privacy-note">
        <span class="lock-icon">▣</span>
        <div>
          <strong>You decide what the door device sees</strong><br />
          <span>A kiosk link lets a classroom device sign students out and in, and nothing more.</span>
        </div>
      </div>
    </section>

    <section class="login-card" aria-labelledby="register-title">
      <div class="login-icon">+</div>
      <p class="eyebrow">PUBLIC REGISTRATION</p>
      <h2 id="register-title">Create an account</h2>
      <p class="muted">No email messages are sent. Use an address you control and a unique password.</p>
      <form onsubmit={submit}>
        <label>
          Your name
          <input name="displayName" autocomplete="name" minlength="2" maxlength="80" required />
        </label>
        <label>
          Email address
          <input name="email" type="email" autocomplete="username" maxlength="254" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required />
        </label>
        <label>
          Confirm password
          <input name="passwordConfirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" required />
        </label>
        <div class="warning-box">
          <strong>Important:</strong> This prototype cannot send email, so there is no password reset.
          Keep this password somewhere safe.
        </div>
        <p class="form-error" role="alert">{error}</p>
        <button class="button primary full" type="submit" disabled={app.submitting}>Create private workspace</button>
      </form>
      <div class="switch-login">
        Already registered?
        <button class="link-button" onclick={() => (app.view = 'teacher-login')}>Teacher sign in</button>
      </div>
    </section>
  </main>
</Shell>
