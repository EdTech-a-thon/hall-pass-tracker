<script lang="ts">
  import Shell from './Shell.svelte';
  import MfaForm from './MfaForm.svelte';
  import { app, pairKiosk, signInTeacher } from '../lib/store.svelte';

  let { mode }: { mode: 'kiosk' | 'teacher' } = $props();

  const teacher = $derived(mode === 'teacher');
  let error = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (app.submitting) return;
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    app.submitting = true;
    error = '';
    try {
      if (mode === 'kiosk') {
        error = await pairKiosk(String(data.get('pairingCode')).trim());
      } else {
        error = await signInTeacher(String(data.get('email')).trim().toLowerCase(), String(data.get('password')));
      }
    } finally {
      app.submitting = false;
    }
  }
</script>

<Shell {mode}>
  <main class="login-wrap">
    <section class="login-copy">
      <p class="eyebrow">{teacher ? 'PRIVATE TEACHER ACCESS' : 'CLASSROOM DEVICE'}</p>
      <h1>{teacher ? 'Your class, at a glance.' : 'Ready for the hallway?'}</h1>
      <p>
        {teacher
          ? 'Review passes, spot patterns, and keep student information protected.'
          : 'A teacher must unlock this kiosk before students can request a pass.'}
      </p>
      <div class="privacy-note">
        <span class="lock-icon">▣</span>
        <div>
          <strong>Encrypted by design</strong><br />
          <span>Student information is encrypted before it leaves this device.</span>
        </div>
      </div>
    </section>

    <section class="login-card" aria-labelledby="login-title">
      {#if app.pendingMfa}
        <MfaForm />
      {:else}
        <div class="login-icon">{teacher ? 'T' : 'K'}</div>
        <p class="eyebrow">{teacher ? 'TEACHER SIGN IN' : 'UNLOCK KIOSK'}</p>
        <h2 id="login-title">Welcome back</h2>
        <p class="muted">
          {teacher
            ? 'Use your verified school account. Teacher sessions end on refresh.'
            : 'Enter the one-time link code shown in the teacher workspace. Never enter a teacher password on a kiosk.'}
        </p>
        <form onsubmit={submit}>
          {#if teacher}
            <label>
              Email address
              <input name="email" type="email" autocomplete="username" maxlength="254" required />
            </label>
            <label>
              Password
              <input name="password" type="password" autocomplete="current-password" minlength="12" maxlength="128" required />
            </label>
          {:else}
            <label>
              One-time link code
              <input name="pairingCode" inputmode="numeric" pattern={'[0-9]{8}'} minlength="8" maxlength="8" autocomplete="off" placeholder="00000000" required />
            </label>
          {/if}
          <p class="form-error" role="alert">{error}</p>
          <button class="button primary full" type="submit" disabled={app.submitting}>
            {teacher ? 'Open teacher workspace' : 'Unlock this kiosk'}
          </button>
        </form>

        {#if teacher}
          <div class="switch-login">
            New to Hallway?
            <button class="link-button" onclick={() => (app.view = 'teacher-register')}>Create a classroom account</button>
          </div>
        {/if}
        <div class="switch-login">
          {teacher ? 'Setting up a classroom device?' : 'Need reports and settings?'}
          <button class="link-button" onclick={() => (app.view = teacher ? 'kiosk-login' : 'teacher-login')}>
            {teacher ? 'Open kiosk linking' : 'Teacher sign in'}
          </button>
        </div>
      {/if}
    </section>
  </main>
</Shell>
