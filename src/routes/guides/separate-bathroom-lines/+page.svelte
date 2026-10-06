<script lang="ts">
  import GuideHead from '#lib/GuideHead.svelte';
  import GuideStep from '#lib/GuideStep.svelte';
  import { guideNamed } from '#lib/guides.ts';

  const guide = guideNamed('separate-bathroom-lines');
  const pictures = `/guides/${guide.slug}`;

  // The screenshots come from scripts/guides/separate-bathroom-lines.spec.ts.
  const steps = [
    {
      name: 'Add a destination for the first bathroom',
      text: 'In Happy Hallways, click Destinations in the sidebar, then click Add destination.',
      tip: 'Already have a bathroom destination? You can use it as one of the two: click its card and give it a new name and a limit, as in the next step.',
      image: `${pictures}/1-add-destination.png`,
      alt: 'The Destinations page, with the Add destination button circled',
    },
    {
      name: 'Name it and give it a limit',
      text: 'Give the bathroom a name students will recognize, like Left Hall Bathroom. Under Students here at once, choose 1 at a time (or however many students it holds). Pick a color and an icon, then click Save.',
      image: `${pictures}/2-first-bathroom.png`,
      alt: 'The New destination window, with the Name set to Left Hall Bathroom and Students here at once set to 1 at a time, both circled',
    },
    {
      name: 'Add the second bathroom the same way',
      text: 'Click Add destination again and set up the other bathroom, like Right Hall Bathroom, with its own limit. A different color helps students tell the two apart at a glance.',
      image: `${pictures}/3-second-bathroom.png`,
      alt: 'The New destination window, with the Name set to Right Hall Bathroom and Students here at once set to 1 at a time, both circled',
    },
    {
      name: 'Check that both bathrooms have a limit',
      text: 'Both cards should show a limit, like “1 at a time”. A destination with no limit never fills up, so it never has a line.',
      image: `${pictures}/4-both-bathrooms.png`,
      alt: 'The Destinations page showing Left Hall Bathroom and Right Hall Bathroom, each 1 at a time, both circled',
    },
    {
      name: 'Turn on lines',
      text: 'Click Pass Options in the sidebar and turn on Let students line up. Now, when a bathroom is full, students can join that bathroom’s line instead of being turned away.',
      image: `${pictures}/5-turn-on-lines.png`,
      alt: 'The Pass Options page, with the Let students line up switch turned on and circled',
    },
  ];
</script>

<GuideHead {guide} image={steps[3].image} {steps} />

<article class="guide">
  <header class="guide-header">
    <p class="eyebrow"><a href="/guides">Guides</a></p>
    <h1>{guide.title}</h1>
    <p class="lede">
      In Happy Hallways, every destination with a limit has its own line. Make each bathroom its own destination, and a
      student waiting for one never holds up a student headed to another.
    </p>
    <p class="lede">
      Name them however your school divides its bathrooms: Left Hall and Right Hall, First Floor Girls’, First Floor
      Private, and so on. You can set up as many as you need.
    </p>
    <p class="muted small">Takes about 2 minutes · Updated {new Date(guide.updated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</p>
  </header>

  {#each steps as step, index (step.name)}
    <GuideStep number={index + 1} title={step.name} image={step.image} alt={step.alt} tip={step.tip}>
      <p>{step.text}</p>
    </GuideStep>
  {/each}

  <section class="guide-section">
    <h2>What students see at the kiosk</h2>
    <p>
      Each bathroom shows up as its own choice. When one is full, the kiosk marks it <strong>Full</strong>, and a
      student who taps it can join its line. The other bathroom stays open.
    </p>
    <figure>
      <img
        src="{pictures}/6-kiosk-one-full.png"
        alt="The kiosk asking where Mia is going: Left Hall Bathroom is marked Full and Right Hall Bathroom is open, both circled"
        width="1280"
        height="800"
        loading="lazy"
      />
    </figure>
    <p>
      Here, Ava is at the Left Hall Bathroom and Mia is first in its line, while Liam went straight to the Right Hall
      Bathroom without waiting. When Ava comes back, Mia’s name turns green: it’s Mia’s turn.
    </p>
    <figure>
      <img
        src="{pictures}/7-kiosk-line.png"
        alt="The kiosk showing the Left Hall Bathroom line with Mia first, while Ava is out at the Left Hall Bathroom and Liam at the Right Hall Bathroom"
        width="1280"
        height="800"
        loading="lazy"
      />
    </figure>
  </section>

  <section class="guide-section">
    <h2>If it isn’t working</h2>
    <dl>
      <dt>Students waiting for one bathroom hold up the other.</dt>
      <dd>
        The kiosk may still be running an older version of Happy Hallways. Reload the kiosk page (or close it and open
        it again). It also updates itself after a minute with nobody touching it.
      </dd>
      <dt>Students are told to wait, but can’t join a line.</dt>
      <dd>Lines are off. Turn on <strong>Let students line up</strong> on the Pass Options page (step 5).</dd>
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

