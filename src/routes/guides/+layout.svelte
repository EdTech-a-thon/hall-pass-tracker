<script lang="ts">
  import Icon from '#lib/Icon.svelte';
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
</style>
