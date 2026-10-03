<script lang="ts">
  /** The Happy Hallways logo: a smiling sun. The favicon in app.html is the same drawing. */
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
  <g fill="var(--sun-face)">
    <circle cx="13" cy="14.5" r="1.2" />
    <circle cx="19" cy="14.5" r="1.2" />
  </g>
  <path d="M12.3 17.8q3.7 3.6 7.4 0" fill="none" stroke="var(--sun-face)" stroke-width="1.6" stroke-linecap="round" />
</svg>

<style>
  .brand-sun {
    display: block;
    flex: 0 0 auto;
  }
</style>
