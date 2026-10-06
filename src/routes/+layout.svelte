<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import { startAnalytics } from '#lib/analytics.ts';

  let { children } = $props();

  onMount(startAnalytics);
</script>

{@render children()}
