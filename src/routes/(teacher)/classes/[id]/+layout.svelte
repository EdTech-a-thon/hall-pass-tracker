<script lang="ts">
  import { page } from '$app/state';
  import { account, findClass, openPasses, setActiveClass } from '#lib/account.svelte.ts';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import { now } from '#lib/passes.ts';

  let { children } = $props();

  const cls = $derived(findClass(page.params.id ?? ''));
  const base = $derived(`/classes/${page.params.id}`);
  const current = $derived(cls?.students.filter((student) => student.status === 'current').length ?? 0);
  const onKiosk = $derived(account.activeClass?.id === cls?.id);
  const leaving = $derived(account.activeClass ? findClass(account.activeClass.id) : undefined);
  const stillOut = $derived(leaving ? openPasses(leaving.id).length : 0);

  let confirming = $state(false);

  const tabs = [
    { href: '', label: 'Now' },
    { href: '/students', label: 'Students' },
    { href: '/roster', label: 'Roster' },
    { href: '/setup', label: 'Setup' },
  ];

  function showOnKiosk() {
    if (stillOut) confirming = true;
    else moveKiosk();
  }

  function moveKiosk() {
    confirming = false;
    if (cls) setActiveClass({ id: cls.id, changedAt: now() });
  }
</script>

{#if cls}
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Class</p>
        <h1>{cls.name}</h1>
        <p class="muted">
          {current} {current === 1 ? 'student' : 'students'} · up to {cls.limit} out at once
        </p>
      </div>
      {#if account.kiosk}
        {#if onKiosk}
          <span class="badge ok"><Icon name="tablet" size={13} />On the kiosk</span>
        {:else}
          <button class="btn" onclick={showOnKiosk}><Icon name="tablet" size={16} />Show on kiosk</button>
        {/if}
      {/if}
    </header>

    <nav class="tabs" aria-label="Class sections">
      {#each tabs as tab (tab.href)}
        <a href="{base}{tab.href}" class:active={page.url.pathname === base + tab.href}>{tab.label}</a>
      {/each}
    </nav>

    {@render children()}
  </div>

  {#if confirming && leaving}
    <ConfirmDialog
      title="Move the kiosk to {cls.name}?"
      message="{stillOut} {stillOut === 1 ? 'student is' : 'students are'} still out in {leaving.name}. Their passes will end with an unknown return time."
      confirmLabel="Move the kiosk"
      onConfirm={moveKiosk}
      onCancel={() => (confirming = false)}
    />
  {/if}
{:else}
  <div class="page">
    <div class="empty">This class doesn't exist anymore. <a href="/">Go to your classes</a></div>
  </div>
{/if}
