<script lang="ts">
  import { page } from '$app/state';
  import { account, activeClassLabel, currentSchedule, liveSchedule, waitingRequests } from './account.svelte';
  import Icon from './Icon.svelte';
  import { kioskState } from './link.svelte';

  /**
   * The status box at the top of the sidebar: the day at a glance, on every
   * page. Clicking it goes to Home, where all of it can be changed.
   */
  const kiosk = $derived(kioskState());
  const schedule = $derived.by(() => {
    if (liveSchedule()) return liveSchedule()!.name;
    return currentSchedule() ? 'Off schedule' : 'No schedule';
  });
  const requests = $derived(waitingRequests().length);
</script>

<a class="status-box" class:active={page.url.pathname === '/'} href="/" data-tip="tip-status">
  <span class="eyebrow-row"><Icon name="home" size={14} />Home</span>
  <strong class="class-name">{activeClassLabel()}</strong>
  <span class="row-line"><span class="status-dot {kiosk.dot}" aria-hidden="true"></span>{kiosk.text}</span>
  <span class="row-line"><Icon name="calendar" size={14} />{schedule}</span>
  {#if account.kiosk?.kind === 'device'}
    <span class="row-line requests" class:waiting={requests}>
      <Icon name="hand" size={14} />{requests ? `${requests} ${requests === 1 ? 'request' : 'requests'}` : 'No requests'}
    </span>
  {/if}
</a>

<style>
  .status-box {
    display: grid;
    gap: 4px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--text);
    text-decoration: none;
  }

  .status-box:hover {
    border-color: var(--border-strong);
  }

  .status-box.active {
    border-color: #a9c9b2;
    background: var(--accent-wash);
  }

  .eyebrow-row {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--accent);
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .class-name {
    font-size: 16px;
    line-height: 1.3;
  }

  .row-line {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
  }

  .row-line .status-dot {
    margin: 0 3px;
  }

  .requests.waiting {
    color: #6a4cbb;
    font-weight: 800;
  }
</style>
