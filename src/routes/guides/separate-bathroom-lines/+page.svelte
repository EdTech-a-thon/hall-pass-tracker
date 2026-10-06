<script lang="ts">
  import GuideHead from '#lib/GuideHead.svelte';
  import GuideStep from '#lib/GuideStep.svelte';
  import { guideNamed } from '#lib/guides.ts';

  const guide = guideNamed('separate-bathroom-lines');
  const pictures = `/guides/${guide.slug}`;

  // The screenshots come from scripts/guides/separate-bathroom-lines.spec.ts.
  const steps = [
    {
      name: 'Open the Bathroom destination',
      text: 'In Happy Hallways, click Destinations in the sidebar, then click the Bathroom card that every class starts with.',
      image: `${pictures}/1-open-bathroom.png`,
      alt: 'The Destinations page, with the Bathroom card circled',
    },
    {
      name: 'Rename it to Girls’ Bathroom',
      text: 'Change the Name to Girls’ Bathroom. Under Students here at once, choose 1 at a time (or however many students the bathroom holds), then click Save.',
      image: `${pictures}/2-rename-girls.png`,
      alt: 'The Edit Bathroom window, with the Name set to Girls’ Bathroom and Students here at once set to 1 at a time, both circled',
    },
    {
      name: 'Add a second destination',
      text: 'Click Add destination.',
      image: `${pictures}/3-add-destination.png`,
      alt: 'The Destinations page, with the Add destination button circled',
    },
    {
      name: 'Name it Boys’ Bathroom',
      text: 'Name it Boys’ Bathroom and choose 1 at a time under Students here at once. Pick a color and the toilet icon, so students can tell the two apart at a glance, then click Save.',
      image: `${pictures}/4-name-boys.png`,
      alt: 'The New destination window, with the Name set to Boys’ Bathroom and Students here at once set to 1 at a time, both circled',
    },
    {
      name: 'Check that both bathrooms have a limit',
      text: 'Both cards should say “1 at a time”. A destination with no limit never fills up, so it never has a line.',
      image: `${pictures}/5-both-bathrooms.png`,
      alt: 'The Destinations page showing Girls’ Bathroom and Boys’ Bathroom, each 1 at a time, both circled',
    },
    {
      name: 'Turn on lines',
      text: 'Click Pass Options in the sidebar and turn on Let students line up. Now, when a bathroom is full, students can join that bathroom’s line instead of being turned away.',
      image: `${pictures}/6-turn-on-lines.png`,
      alt: 'The Pass Options page, with the Let students line up switch turned on and circled',
    },
  ];
</script>

<GuideHead {guide} image={steps[4].image} {steps} />

<article class="guide">
  <header>
    <p class="eyebrow"><a href="/guides">Guides</a></p>
    <h1>{guide.title}</h1>
    <p class="lede">
      In Happy Hallways, every destination with a limit has its own line. Make the girls’ bathroom and the boys’
      bathroom two separate destinations, and a student waiting for one never holds up a student headed to the other.
    </p>
    <p class="muted small">Takes about 2 minutes · Updated {new Date(guide.updated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</p>
  </header>

  {#each steps as step, index (step.name)}
    <GuideStep number={index + 1} title={step.name} image={step.image} alt={step.alt}>
      <p>{step.text}</p>
    </GuideStep>
  {/each}

  <section class="step-like">
    <h2>What students see at the kiosk</h2>
    <p>
      Both bathrooms show up as choices. When one is full, the kiosk marks it <strong>Full</strong>, and a student who
      taps it can join its line. The other bathroom stays open.
    </p>
    <figure>
      <img
        src="{pictures}/7-kiosk-one-full.png"
        alt="The kiosk asking Mia where she's going: Girls’ Bathroom is marked Full and Boys’ Bathroom is open, both circled"
        width="1280"
        height="800"
        loading="lazy"
      />
    </figure>
    <p>
      Here, Ava is in the girls’ bathroom and Mia is first in its line, while Liam went straight to the boys’
      bathroom without waiting. When Ava comes back, Mia’s name turns green: it’s her turn.
    </p>
    <figure>
      <img
        src="{pictures}/8-kiosk-line.png"
        alt="The kiosk showing the Girls’ Bathroom line with Mia first, while Ava is out at the girls’ bathroom and Liam at the boys’"
        width="1280"
        height="800"
        loading="lazy"
      />
    </figure>
  </section>

  <section class="step-like">
    <h2>If it isn’t working</h2>
    <dl>
      <dt>Students waiting for one bathroom hold up the other.</dt>
      <dd>
        The kiosk may still be running an older version of Happy Hallways. Reload the kiosk page (or close it and open
        it again). It also updates itself after a minute with nobody touching it.
      </dd>
      <dt>Students are told to wait, but can’t join a line.</dt>
      <dd>Lines are off. Turn on <strong>Let students line up</strong> on the Pass Options page (step 6).</dd>
      <dt>Nobody ever has to wait for a bathroom.</dt>
      <dd>
        That bathroom has no limit. Open it on the Destinations page and choose a number under
        <strong>Students here at once</strong>.
      </dd>
      <dt>Can two students use the same bathroom at once?</dt>
      <dd>Yes. Choose <strong>2 at a time</strong> (or more) under Students here at once.</dd>
    </dl>
    <p>
      The same steps work for any other destinations you want to keep apart, such as an all-gender restroom or the water
      fountain.
    </p>
  </section>
</article>

<style>
  .guide {
    display: grid;
    gap: 44px;
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

  .eyebrow a {
    color: inherit;
    text-decoration: none;
  }

  .lede {
    margin: 0;
    color: var(--muted);
    font-size: 18px;
    line-height: 1.6;
  }

  .step-like {
    display: grid;
    gap: 12px;
  }

  .step-like h2 {
    font-size: 21px;
  }

  .step-like p,
  dd {
    margin: 0;
    font-size: 16px;
    line-height: 1.65;
  }

  figure {
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgb(42 38 31 / 8%);
  }

  figure img {
    display: block;
    width: 100%;
    height: auto;
  }

  dl {
    display: grid;
    gap: 6px;
    margin: 0;
  }

  dt {
    margin-top: 10px;
    font-weight: 800;
  }

  dd {
    margin: 0;
    color: var(--muted);
  }
</style>
