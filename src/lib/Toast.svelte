<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  /**
   * One message in the corner of every teacher page. Toasts float over the
   * page, so one arriving or leaving never moves anything under it. Each
   * stays for as long as what it's about is true (a student still overdue, an
   * update waiting); the corner they sit in is in the teacher layout.
   */
  let {
    icon,
    tone = 'info',
    role = 'status',
    class: extra = '',
    children,
  }: {
    icon: IconName;
    tone?: 'info' | 'warn';
    role?: 'status' | 'alert';
    class?: string;
    children: Snippet;
  } = $props();
</script>

<div class="toast {tone} {extra}" {role}>
  <span class="toast-icon"><Icon name={icon} size={18} /></span>
  <div class="toast-body">{@render children()}</div>
</div>

<style>
  .toast {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    width: 100%;
    max-height: 50vh;
    overflow-y: auto;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-left-width: 4px;
    border-radius: 12px;
    background: var(--surface);
    box-shadow:
      0 12px 32px rgb(42 34 22 / 14%),
      0 2px 6px rgb(42 34 22 / 6%);
    font-size: 14px;
    font-weight: 600;
    pointer-events: auto;
    animation: arrive 220ms both;
  }

  .toast.info {
    border-left-color: var(--accent);
  }

  .toast.warn {
    border-left-color: var(--warn);
  }

  .toast-icon {
    display: inline-flex;
    margin-top: 1px;
    color: var(--accent);
  }

  .warn .toast-icon {
    color: var(--warn);
  }

  .toast-body {
    flex: 1;
    min-width: 0;
  }

  @keyframes arrive {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
