<script lang="ts">
  import Modal from './Modal.svelte';
  /** An in-page "are you sure?", used instead of the browser's own pop-up. */
  let {
    title,
    message,
    confirmLabel,
    danger = false,
    onConfirm,
    onCancel,
  }: {
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();
</script>

<Modal onClose={onCancel} labelledby="confirm-title">
  <div class="dialog">
    <h2 id="confirm-title">{title}</h2>
    <p class="muted">{message}</p>
    <div class="dialog-actions">
      <button class="btn" onclick={onCancel}>Cancel</button>
      <button class="btn {danger ? 'btn-danger solid' : 'btn-primary'}" onclick={onConfirm}>{confirmLabel}</button>
    </div>
  </div>
</Modal>
