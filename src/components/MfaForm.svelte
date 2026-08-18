<script lang="ts">
  import { verifyMfa } from '../lib/store.svelte';

  let error = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const code = String(new FormData(event.target as HTMLFormElement).get('code'));
    error = await verifyMfa(code);
  }
</script>

<div class="login-icon">2</div>
<p class="eyebrow">SECOND FACTOR</p>
<h2>Check your school email</h2>
<p class="muted">
  PocketBase sent a one-time verification code. Authenticator-app TOTP is not enabled in this
  prototype because PocketBase does not provide it natively.
</p>
<form onsubmit={submit}>
  <label>
    One-time code
    <!-- svelte-ignore a11y_autofocus -->
    <input name="code" inputmode="numeric" pattern={'[0-9]{6,10}'} minlength="6" maxlength="10" autocomplete="one-time-code" required autofocus />
  </label>
  <p class="form-error" role="alert">{error}</p>
  <button class="button primary full" type="submit">Verify and continue</button>
</form>
