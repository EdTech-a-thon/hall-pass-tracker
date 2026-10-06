<script lang="ts">
  import type { Snippet } from 'svelte';

  /** One numbered step of a guide, with its screenshot and an optional tip. Clicking the picture opens it full size. */
  let {
    number,
    title,
    image,
    alt,
    tip,
    children,
  }: { number: number; title: string; image: string; alt: string; tip?: string; children: Snippet } = $props();
</script>

<section class="step" id="step-{number}">
  <h2><span class="number" aria-hidden="true">{number}</span>{title}</h2>
  <div class="text">
    {@render children()}
    {#if tip}<p class="tip"><strong>Tip:</strong> {tip}</p>{/if}
  </div>
  <a class="shot" href={image} target="_blank" rel="noopener">
    <img src={image} {alt} width="1280" height="800" loading={number === 1 ? 'eager' : 'lazy'} />
  </a>
</section>

<style>
  .step {
    display: grid;
    gap: 12px;
    scroll-margin-top: 20px;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 21px;
  }

  .number {
    display: inline-grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    font-size: 16px;
  }

  .text :global(p) {
    margin: 0;
    font-size: 16px;
    line-height: 1.65;
  }

  .text {
    display: grid;
    gap: 10px;
  }

  .tip {
    padding: 12px 14px;
    border-radius: var(--radius);
    background: var(--accent-wash);
  }

  .shot {
    display: block;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgb(42 38 31 / 8%);
  }

  img {
    display: block;
    width: 100%;
    height: auto;
  }
</style>
