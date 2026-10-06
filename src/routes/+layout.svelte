<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import { startAnalytics } from '#lib/analytics.ts';

  let { children } = $props();

  onMount(startAnalytics);
</script>

<!-- A page that names itself replaces this. -->
<svelte:head><title>Happy Hallways</title></svelte:head>

{@render children()}
