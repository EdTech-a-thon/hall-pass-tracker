<script lang="ts">
  import { page } from '$app/state';
  import { account, findClass } from './account.svelte';
  import Icon from './Icon.svelte';
  import KioskBadge from './KioskBadge.svelte';
  import { link } from './link.svelte';

  let classesOpen = $state(true);

  const path = $derived(page.url.pathname);
  const kioskClass = $derived(account.activeClass ? findClass(account.activeClass.id)?.name : undefined);

  /** One line under "Kiosk" saying whether the door is connected, and to what. */
  const kioskStatus = $derived.by(() => {
    const kiosk = account.kiosk;
    if (!kiosk) return { text: 'Not set up', dot: '' };
    if (kiosk.kind === 'this-computer') return { text: `This computer${kioskClass ? ` · ${kioskClass}` : ''}`, dot: 'live' };
    if (link.status === 'live') return { text: `Live${kioskClass ? ` · ${kioskClass}` : ''}`, dot: 'live' };
    if (link.status === 'taken') return { text: 'Open in another tab', dot: 'warn' };
    return { text: 'Offline', dot: '' };
  });
</script>

<aside class="sidebar">
  <a class="brand" href="/"><span class="brand-mark"><Icon name="door" size={17} /></span>Hallway</a>

  <nav class="nav" aria-label="Main">
    <button class="nav-toggle" aria-expanded={classesOpen} onclick={() => (classesOpen = !classesOpen)}>
      <Icon name="users" />Classes
      <span class="chevron"><Icon name="chevron-down" size={16} /></span>
    </button>
    {#if classesOpen}
      <div class="nav-sub">
        {#each account.classes as cls (cls.id)}
          <a class="nav-link" class:active={path.startsWith(`/classes/${cls.id}`)} href="/classes/{cls.id}">
            <span>{cls.name}</span>
            {#if account.kiosk && account.activeClass?.id === cls.id}
              <span style="margin-left:auto"><KioskBadge compact /></span>
            {/if}
          </a>
        {/each}
        <a class="nav-link add" class:active={path === '/classes/new'} href="/classes/new">
          <Icon name="plus" size={15} />New class
        </a>
      </div>
    {/if}

    <a class="nav-link" class:active={path === '/destinations'} href="/destinations">
      <Icon name="map-pin" />Destinations
    </a>

    <a class="nav-link" class:active={path === '/kiosk'} href="/kiosk">
      <Icon name="tablet" />
      <span>Kiosk<span class="nav-meta">{kioskStatus.text}</span></span>
      <span class="status-dot {kioskStatus.dot}" style="margin-left:auto" aria-hidden="true"></span>
    </a>
  </nav>

  <div class="sidebar-foot">
    <a class="nav-link" class:active={path === '/settings'} href="/settings"><Icon name="settings" />Settings</a>
  </div>
</aside>
