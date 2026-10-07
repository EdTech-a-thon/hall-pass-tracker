<script lang="ts">
  import { page } from '$app/state';
  import Icon from '#lib/Icon.svelte';
  import { supportEmail, supportMailto } from '#lib/support.ts';
  import SiteFooter from '#lib/SiteFooter.svelte';
  import WelcomeHeader from '#lib/welcome/WelcomeHeader.svelte';

  let { children } = $props();
</script>

<div class="guides-site">
  <WelcomeHeader>
    <a href="/guides">Guides</a>
    <a href="/about">About</a>
    <a class="cta small" href="/">Open Happy Hallways <Icon name="arrow-right" size={15} /></a>
  </WelcomeHeader>

  <main>
    {@render children()}

    <!-- Every guide ends with a way to reach a person. -->
    {#if page.url.pathname !== '/guides'}
      <p class="still-stuck">
        Still running into trouble? Feel free to email us at
        <a href={supportMailto('Happy Hallways help')}>{supportEmail}</a>, and we can help.
      </p>
    {/if}
  </main>

  <SiteFooter />
</div>

<style>
  .guides-site {
    min-height: 100vh;
    background: linear-gradient(180deg, #fffdf8 0%, var(--bg) 40rem);
  }

  main {
    width: min(760px, calc(100% - 32px));
    margin: 0 auto;
    padding: 32px 0 64px;
  }

  /* Shared by every guide page. */
  main :global(.guide) {
    display: grid;
    gap: 44px;
  }

  main :global(.guide-header) {
    display: grid;
    gap: 10px;
  }

  main :global(.guide h1) {
    font-size: clamp(30px, 4.4vw, 42px);
    line-height: 1.1;
    letter-spacing: -0.03em;
  }

  main :global(.guide .eyebrow a) {
    color: inherit;
    text-decoration: none;
  }

  main :global(.lede) {
    margin: 0;
    color: var(--muted);
    font-size: 18px;
    line-height: 1.6;
  }

  main :global(.guide-section) {
    display: grid;
    gap: 12px;
  }

  main :global(.guide-section) {
    scroll-margin-top: 20px;
  }

  main :global(.guide-section h2) {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 21px;
  }

  main :global(.guide-section p),
  main :global(.guide dd) {
    margin: 0;
    font-size: 16px;
    line-height: 1.65;
  }

  main :global(.guide figure) {
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgb(42 38 31 / 8%);
  }

  main :global(.guide figure img) {
    display: block;
    width: 100%;
    height: auto;
  }

  main :global(.guide dl) {
    display: grid;
    gap: 6px;
    margin: 0;
  }

  main :global(.guide dt) {
    margin-top: 10px;
    font-weight: 800;
  }

  main :global(.guide dd) {
    color: var(--muted);
  }

  .still-stuck {
    margin: 44px 0 0;
    padding-top: 28px;
    border-top: 1px solid var(--border);
    font-size: 16px;
    line-height: 1.65;
  }

  .still-stuck a {
    font-weight: 700;
    text-underline-offset: 4px;
  }
</style>
