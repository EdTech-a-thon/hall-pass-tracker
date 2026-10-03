<script lang="ts">
  /** The Happy Hallways logo: a sun. The favicon in app.html is the same drawing. */
  let { size = 30 }: { size?: number } = $props();
</script>

<svg
  class="brand-sun"
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 32 32"
  aria-hidden="true"
  focusable="false"
>
  <g stroke="var(--sun-ray)" stroke-width="2.4" stroke-linecap="round">
    <path d="M16 2.5v3.5M16 26v3.5M2.5 16H6M26 16h3.5M6.5 6.5l2.5 2.5M23 23l2.5 2.5M6.5 25.5 9 23M23 9l2.5-2.5" />
  </g>
  <circle cx="16" cy="16" r="8.5" fill="var(--sun)" />
</svg>

<style>
  .brand-sun {
    display: block;
    flex: 0 0 auto;
  }
</style>
