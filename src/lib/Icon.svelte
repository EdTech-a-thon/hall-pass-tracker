<script lang="ts">
  import { icons, type IconName } from './icons';

  let { name, size = 18, stroke = 2 }: { name: IconName; size?: number; stroke?: number } = $props();
</script>

<svg
  class="ui-icon"
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false">{@html icons[name]}</svg
>

<style>
  .ui-icon {
    display: inline-block;
    flex: 0 0 auto;
  }
</style>
