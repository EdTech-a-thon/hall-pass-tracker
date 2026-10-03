<script lang="ts">
  import { supportEmail, supportMailto } from '#lib/support.ts';
</script>

<svelte:head><title>Privacy · Happy Hallways</title></svelte:head>

<div class="page site-prose">
  <header>
    <p class="eyebrow">Privacy</p>
    <h1>Privacy</h1>
    <p class="muted">What we collect, what we don't, and why.</p>
  </header>

  <section class="card">
    <h2>Your class stays on your computer</h2>
    <p>
      Happy Hallways has no accounts and no sign-in. Your classes, students and passes are stored by your browser on your own
      computer and are never uploaded to us or to anyone else. A backup is a file you download yourself.
    </p>
    <p>
      For each student, Happy Hallways keeps only a first name and the first few letters of the last name, just enough to
      tell students apart. The rest of the last name is thrown away when you paste your class list.
    </p>
  </section>

  <section class="card">
    <h2>The kiosk by your door</h2>
    <p>
      A paired kiosk talks directly to your computer over an encrypted connection. To find each other, the two devices
      are introduced by a small matchmaking server run by teacher.dev. It sees only a random address for each device,
      stores nothing, and never receives your class or pass data.
    </p>
    <p>
      Some school networks block devices from talking directly. Then the encrypted data is passed along by a relay run
      by <a href="https://peerjs.com" target="_blank" rel="noopener noreferrer">PeerJS</a>, which can't read it.
      Google's public connection service helps each device learn its own network address; it sees no class data.
    </p>
    <p>The kiosk keeps a copy of your students' short names and holds passes only until your computer receives them.</p>
  </section>

  <section class="card">
    <h2>No tracking</h2>
    <p>
      Happy Hallways doesn't use analytics, cookies or ads, and we don't share, sell or otherwise transfer any visitor data. The
      fonts load from Google Fonts, which sees a request from your browser like any website would.
    </p>
    <p>
      Questions or concerns? Email <a href={supportMailto('Happy Hallways privacy')}>{supportEmail}</a>.
    </p>
  </section>
</div>

<style>
  .site-prose {
    max-width: 760px;
  }

  .site-prose header {
    display: grid;
    gap: 6px;
  }

  .card p {
    font-size: 15px;
    line-height: 1.6;
  }

  .card a {
    font-weight: 700;
    text-underline-offset: 4px;
  }
</style>
