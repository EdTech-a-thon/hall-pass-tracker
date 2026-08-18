<script lang="ts">
  import Shell from './Shell.svelte';
  import LivePanel from './LivePanel.svelte';
  import AnalyticsPanel from './AnalyticsPanel.svelte';
  import SecurityPanel from './SecurityPanel.svelte';
  import { app, signOutTeacher } from '../lib/store.svelte';
  import type { TeacherTab } from '../lib/types';

  const tabs: { id: TeacherTab; label: string }[] = [
    { id: 'live', label: 'Live class' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'security', label: 'Security' },
  ];
</script>

<Shell mode="teacher">
  <nav class="teacher-nav" aria-label="Teacher workspace">
    {#each tabs as tab (tab.id)}
      <button class={app.teacherTab === tab.id ? 'active' : ''} onclick={() => (app.teacherTab = tab.id)}>
        {tab.label}
      </button>
    {/each}
  </nav>

  <main class="teacher-main">
    {#if app.teacherTab === 'live'}
      <LivePanel />
    {:else if app.teacherTab === 'analytics'}
      <AnalyticsPanel />
    {:else}
      <SecurityPanel />
    {/if}
  </main>

  <button class="corner-link" onclick={signOutTeacher}>Sign out teacher</button>
</Shell>
