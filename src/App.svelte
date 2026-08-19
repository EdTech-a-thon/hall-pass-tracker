<script lang="ts">
  import LoginView from './components/LoginView.svelte';
  import RegisterView from './components/RegisterView.svelte';
  import KioskView from './components/KioskView.svelte';
  import TeacherView from './components/TeacherView.svelte';
  import RequestModal from './components/RequestModal.svelte';
  import KioskLinkModal from './components/KioskLinkModal.svelte';
  import DemoModal from './components/DemoModal.svelte';
  import Notice from './components/Notice.svelte';
  import { app } from './lib/store.svelte';
</script>

{#if app.view === 'kiosk'}
  <KioskView />
{:else if app.view === 'teacher-register'}
  <RegisterView />
{:else if app.view === 'teacher'}
  <TeacherView />
{:else}
  <LoginView />
{/if}

{#if app.modal?.kind === 'request'}
  <RequestModal student={app.modal.student} />
{:else if app.modal?.kind === 'kiosk-link'}
  <KioskLinkModal url={app.modal.url} label={app.modal.label} />
{:else if app.modal}
  <DemoModal />
{/if}

{#if app.notice}
  <Notice notice={app.notice} />
{/if}
