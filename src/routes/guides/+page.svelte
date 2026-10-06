<script lang="ts">
  import { guides, siteUrl } from '#lib/guides.ts';
  import Icon from '#lib/Icon.svelte';

  const description = 'Step-by-step guides for setting up Happy Hallways, the free digital hall pass for teachers.';
</script>

<svelte:head>
  <title>Guides · Happy Hallways</title>
  <meta name="description" content={description} />
  <link rel="canonical" href="{siteUrl}/guides" />
  <meta property="og:title" content="Happy Hallways Guides" />
  <meta property="og:description" content={description} />
  <meta property="og:url" content="{siteUrl}/guides" />
</svelte:head>

<div class="index">
  <header>
    <p class="eyebrow">Guides</p>
    <h1>How to do things in Happy Hallways</h1>
    <p class="lede">Short, step-by-step guides with screenshots. Each one takes a couple of minutes.</p>
  </header>

  <ul>
    {#each guides as guide (guide.slug)}
      <li>
        <a class="card guide-card" href="/guides/{guide.slug}">
          <div>
            <h2>{guide.title}</h2>
            <p class="muted">{guide.description}</p>
          </div>
          <Icon name="arrow-right" size={20} />
        </a>
      </li>
    {/each}
  </ul>
</div>

<style>
  .index {
    display: grid;
    gap: 28px;
  }

  header {
    display: grid;
    gap: 10px;
  }

  h1 {
    font-size: clamp(30px, 4.4vw, 42px);
    line-height: 1.1;
    letter-spacing: -0.03em;
  }

  .lede {
    margin: 0;
    color: var(--muted);
    font-size: 18px;
  }

  ul {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .guide-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    color: var(--text);
    text-decoration: none;
  }

  .guide-card:hover {
    border-color: var(--accent);
  }

  .guide-card div {
    display: grid;
    gap: 4px;
  }

  .guide-card p {
    margin: 0;
  }
</style>
