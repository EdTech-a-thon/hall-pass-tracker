<script lang="ts">
  import Icon from './Icon.svelte';
  import { supportMailto } from './support';

  /** An invitation to email the team, like the "Need a different figure?" box on Math Figures. */
  let { title, text, subject }: { title: string; text: string; subject: string } = $props();

  const href = $derived(supportMailto(subject));
</script>

<a class="request" {href}>
  <span class="icon-tile"><Icon name="plus" size={20} /></span>
  <span class="request-title">{title}</span>
  <span class="request-text">{text}</span>
</a>

<style>
  .request {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 22px 20px;
    border: 2px dashed var(--border-strong);
    border-radius: var(--radius);
    background: rgb(255 255 255 / 60%);
    color: var(--text);
    text-align: center;
    text-decoration: none;
  }

  .request:hover {
    border-color: #a9c9b2;
    background: var(--accent-wash);
  }

  .icon-tile {
    margin-bottom: 6px;
  }

  .request-title {
    font-size: 15px;
    font-weight: 800;
  }

  .request-text {
    color: var(--muted);
    font-size: 13.5px;
  }
</style>
