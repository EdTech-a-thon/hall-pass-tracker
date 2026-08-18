<script lang="ts">
  import LoginView from './components/LoginView.svelte';
  import RegisterView from './components/RegisterView.svelte';
  import KioskView from './components/KioskView.svelte';
  import TeacherView from './components/TeacherView.svelte';
  import RequestModal from './components/RequestModal.svelte';
  import PairingModal from './components/PairingModal.svelte';
  import DemoModal from './components/DemoModal.svelte';
  import Notice from './components/Notice.svelte';
  import { app } from './lib/store.svelte';
</script>

{#if app.view === 'kiosk-login'}
  <LoginView mode="kiosk" />
{:else if app.view === 'teacher-login'}
  <LoginView mode="teacher" />
{:else if app.view === 'teacher-register'}
  <RegisterView />
{:else if app.view === 'kiosk'}
  <KioskView />
{:else}
  <TeacherView />
{/if}

{#if app.modal?.kind === 'request'}
  <RequestModal student={app.modal.student} />
{:else if app.modal?.kind === 'pairing'}
  <PairingModal code={app.modal.code} />
{:else if app.modal}
  <DemoModal kind={app.modal.kind} />
{/if}

{#if app.notice}
  <Notice notice={app.notice} />
{/if}
