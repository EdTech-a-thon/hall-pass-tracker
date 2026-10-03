<script lang="ts">
  import { goto } from '$app/navigation';
  import Icon from '#lib/Icon.svelte';
  import { updateOnboarding } from '#lib/onboarding.svelte.ts';
  import StepArt from '#lib/welcome/StepArt.svelte';
  import { keepOpen, steps } from '#lib/welcome/steps.ts';
  import WelcomeHeader from '#lib/welcome/WelcomeHeader.svelte';

  // Reaching the tour counts as being welcomed, so the app opens next time.
  updateOnboarding({ welcomed: true });

  let index = $state(0);
  const step = $derived(steps[index]);
  const last = $derived(index === steps.length - 1);

  function finish() {
    updateOnboarding({ showChecklist: true });
    goto('/');
  }

  function next() {
    if (last) finish();
    else index++;
  }
</script>

<svelte:head><title>Get started · Happy Hallways</title></svelte:head>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'ArrowRight' && !last) index++;
    if (event.key === 'ArrowLeft' && index > 0) index--;
  }}
/>

<div class="tour">
  <WelcomeHeader>
    <a href="/" onclick={() => updateOnboarding({ showChecklist: true })}>Skip the tour</a>
  </WelcomeHeader>

  <main>
    <div class="copy">
      {#key index}
        <div class="heading">
          <p class="welcome-eyebrow">Step {index + 1} of {steps.length}</p>
          <h1>{step.title}</h1>
        </div>
        <p class="lede">{step.text}</p>
      {/key}

      {#if last}
        <div class="keep-open" role="note">
          <Icon name="alert-triangle" size={20} />
          <p><strong>{keepOpen.title}.</strong> {keepOpen.text}</p>
        </div>
      {/if}

      <div class="actions">
        {#if index > 0}
          <button class="btn back" onclick={() => index--}><Icon name="arrow-left" size={16} />Back</button>
        {/if}
        <button class="cta" onclick={next}>
          {last ? 'Add your class' : 'Next'}
          <Icon name="arrow-right" size={17} />
        </button>
      </div>

      <div class="dots" role="tablist" aria-label="Steps">
        {#each steps as each, i (each.key)}
          <button
            role="tab"
            aria-selected={i === index}
            aria-label="Step {i + 1}: {each.title}"
            class:on={i === index}
            onclick={() => (index = i)}
          ></button>
        {/each}
      </div>
    </div>

    <div class="picture">
      {#key index}<StepArt step={step.key} />{/key}
    </div>
  </main>
</div>

<style>
  .tour {
    min-height: 100vh;
    background:
      radial-gradient(circle at 88% 6%, rgb(251 191 36 / 16%), transparent 26rem),
      linear-gradient(180deg, #fffdf8, var(--bg) 70%);
  }

  main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 56px;
    width: min(1120px, calc(100% - 32px));
    /* Fill the window below the header, so the step sits in the middle. */
    min-height: calc(100vh - 76px);
    margin: 0 auto;
    padding-bottom: 68px;
  }

  /* Room for a two-line title on every step, so the buttons don't jump. */
  .heading {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    min-height: calc(2.2 * clamp(32px, 3.8vw, 46px) + 40px);
  }

  h1 {
    margin-bottom: 16px;
    font-size: clamp(32px, 3.8vw, 46px);
    line-height: 1.06;
    letter-spacing: -0.03em;
    animation: fade 300ms both;
  }

  .lede {
    max-width: 480px;
    min-height: 6.4em;
    margin-bottom: 24px;
    color: var(--muted);
    font-size: 17px;
    line-height: 1.6;
    animation: fade 300ms both 60ms;
  }

  @keyframes fade {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  .keep-open {
    display: flex;
    gap: 12px;
    max-width: 500px;
    margin-bottom: 24px;
    padding: 14px 16px;
    border: 1px solid #ecd3ac;
    border-radius: 12px;
    background: #fff8ea;
    color: #8a5210;
    line-height: 1.55;
  }

  .keep-open :global(svg) {
    margin-top: 2px;
  }

  .keep-open p {
    color: var(--text);
  }

  .actions {
    display: flex;
    gap: 10px;
  }

  .back {
    min-height: 52px;
    padding-inline: 18px;
    border-radius: 12px;
  }

  .dots {
    display: flex;
    gap: 8px;
    margin-top: 32px;
  }

  .dots button {
    width: 28px;
    height: 6px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: var(--border-strong);
    cursor: pointer;
  }

  .dots button.on {
    background: var(--accent);
  }

  .picture {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 360px;
  }

  @media (prefers-reduced-motion: reduce) {
    h1,
    .lede {
      animation: none;
    }
  }

  @media (max-width: 860px) {
    main {
      grid-template-columns: 1fr;
      gap: 24px;
      padding-top: 16px;
    }

    .heading {
      min-height: 0;
    }

    .picture {
      min-height: 0;
      order: -1;
    }
  }
</style>
