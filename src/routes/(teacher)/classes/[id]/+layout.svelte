<script lang="ts">
  import { replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { account, currentSchedule, findClass, moveWarning, setActiveClass } from '#lib/account.svelte.ts';
  import AddStudentsDialog from '#lib/AddStudentsDialog.svelte';
  import ClassSettingsDialog from '#lib/ClassSettingsDialog.svelte';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import KioskBadge from '#lib/KioskBadge.svelte';
  import { now } from '#lib/passes.ts';
  import { formatRange, sortedPeriods } from '#lib/schedule.ts';

  let { children } = $props();

  const cls = $derived(findClass(page.params.id ?? ''));
  const base = $derived(`/classes/${page.params.id}`);
  const current = $derived(cls?.students.filter((student) => student.status === 'current').length ?? 0);
  const onKiosk = $derived(account.activeClass?.id === cls?.id);
  const warning = $derived(cls ? moveWarning(cls.id) : null);
  /** When the Current Schedule puts this class on the kiosk. */
  const schedule = $derived(currentSchedule());
  const periods = $derived(schedule ? sortedPeriods(schedule).filter((period) => period.classId === cls?.id) : []);

  let adding = $state(false);
  let settings = $state(false);
  let confirmingMove = $state(false);

  // A brand-new class arrives with ?add, so the teacher goes straight to adding students.
  onMount(() => {
    if (page.url.searchParams.has('add')) {
      adding = true;
      replaceState(base, {});
    }
  });

  const tabs = [
    { href: '', label: 'Now' },
    { href: '/students', label: 'Students' },
  ];

  function showOnKiosk() {
    if (warning) confirmingMove = true;
    else moveKiosk();
  }

  function moveKiosk() {
    confirmingMove = false;
    if (cls) setActiveClass({ id: cls.id, changedAt: now() });
  }
</script>

{#if cls}
  <div class="page">
    <header class="class-head">
      <div class="class-title">
        <div class="row">
          <h1>{cls.name}</h1>
          {#if account.kiosk && onKiosk}
            <KioskBadge />
          {:else if account.kiosk}
            <button class="btn btn-small" onclick={showOnKiosk}><Icon name="tablet" size={14} />Show on kiosk</button>
          {/if}
        </div>
        <p class="muted small">
          {current} {current === 1 ? 'student' : 'students'}
          {#if periods.length}
            · <a href="/schedule/{schedule?.id}">{schedule?.name}: {periods.map(formatRange).join(', ')}</a>
          {/if}
        </p>
      </div>
      <div class="row">
        <button class="btn btn-quiet" onclick={() => (settings = true)} aria-label="Class settings" title="Class settings">
          <Icon name="settings" size={18} />
        </button>
        <button class="btn btn-primary" onclick={() => (adding = true)}><Icon name="user-plus" size={16} />Add students</button>
      </div>
    </header>

    <nav class="tabs" aria-label="Class sections">
      {#each tabs as tab (tab.href)}
        <a href="{base}{tab.href}" class:active={page.url.pathname === base + tab.href}>{tab.label}</a>
      {/each}
    </nav>

    {@render children()}
  </div>

  {#if adding}<AddStudentsDialog {cls} onClose={() => (adding = false)} />{/if}
  {#if settings}<ClassSettingsDialog {cls} onClose={() => (settings = false)} />{/if}
  {#if confirmingMove && warning}
    <ConfirmDialog
      title="Move the kiosk to {cls.name}?"
      message={warning}
      confirmLabel="Move the kiosk"
      onConfirm={moveKiosk}
      onCancel={() => (confirmingMove = false)}
    />
  {/if}
{:else}
  <div class="page">
    <div class="empty">This class doesn't exist anymore. <a href="/">Go to your classes</a></div>
  </div>
{/if}
