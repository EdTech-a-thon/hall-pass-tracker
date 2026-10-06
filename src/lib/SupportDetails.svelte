<script lang="ts">
  import Icon from './Icon.svelte';
  import { supportEmail, supportMailto } from './support';

  /**
   * "Still stuck?" under a connection error: the technical details, folded away,
   * with one button to copy them and one to email them to support.
   */
  let { code, text }: { code: string; text: string } = $props();

  let copied = $state(false);
  let details: HTMLPreElement;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // Some browsers only allow copying on secure pages; select the text so it can be copied by hand.
      getSelection()?.selectAllChildren(details);
    }
  }

  const intro = 'What I was trying to do:\n\n\n--- Details for support (please leave these in) ---\n';
</script>

<div class="support">
  <p class="muted small">
    Still stuck? <a href={supportMailto(`Connection problem (${code})`, intro + text)}>Email {supportEmail}</a> with
    the details below, and we'll help.
  </p>
  <details>
    <summary>Details for support · {code}</summary>
    <pre bind:this={details}>{text}</pre>
  </details>
  <button class="btn btn-small" onclick={copy}>
    <Icon name={copied ? 'check' : 'copy'} size={14} />{copied ? 'Copied' : 'Copy details'}
  </button>
</div>

<style>
  .support {
    display: grid;
    justify-items: center;
    gap: 8px;
    width: min(560px, 100%);
    margin-top: 8px;
  }

  details {
    width: 100%;
    text-align: left;
  }

  summary {
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    text-align: center;
  }

  pre {
    max-height: 200px;
    margin: 8px 0 0;
    padding: 10px 12px;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-sunk);
    color: var(--text);
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
