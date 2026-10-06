<script lang="ts">
  import { guideUrl, siteUrl, type Guide } from './guides';

  /**
   * What search engines and link previews read about a guide: its title,
   * description, address, a picture, and its steps as structured data.
   */
  let { guide, image, steps }: { guide: Guide; image: string; steps: { name: string; text: string; image: string }[] } =
    $props();

  const url = $derived(guideUrl(guide));
  const title = $derived(`${guide.search.title} · Happy Hallways`);

  // Search engines read the steps from this. "<" is escaped so the text can't end the script tag early.
  const structuredData = $derived(
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: guide.search.title,
      description: guide.search.description,
      image: `${siteUrl}${image}`,
      dateModified: guide.updated,
      step: steps.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: step.name,
        text: step.text,
        image: `${siteUrl}${step.image}`,
        url: `${url}#step-${index + 1}`,
      })),
    }).replaceAll('<', '\\u003c'),
  );
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={guide.search.description} />
  <link rel="canonical" href={url} />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Happy Hallways" />
  <meta property="og:title" content={guide.search.title} />
  <meta property="og:description" content={guide.search.description} />
  <meta property="og:url" content={url} />
  <meta property="og:image" content={`${siteUrl}${image}`} />
  <meta name="twitter:card" content="summary_large_image" />
  {@html `<script type="application/ld+json">${structuredData}</script>`}
</svelte:head>
