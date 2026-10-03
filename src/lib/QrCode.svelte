<script lang="ts">
  import qrcode from 'qrcode-generator';

  let { text, label }: { text: string; label: string } = $props();

  const svg = $derived.by(() => {
    const code = qrcode(0, 'M');
    code.addData(text);
    code.make();
    return code.createSvgTag({ margin: 0, scalable: true });
  });
</script>

<div class="qr" role="img" aria-label={label}>{@html svg}</div>
