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
