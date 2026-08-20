<script lang="ts">
  import Shell from './Shell.svelte';
  import { app, chooseStudent, passFor, requestKioskExit } from '../lib/store.svelte';

  const students = $derived(app.activeClass.students);
</script>

<Shell mode="kiosk">
  <main class="kiosk-main">
    <section class="kiosk-intro">
      <p class="eyebrow">{app.kioskLabel.toUpperCase()}</p>
      <h1>Tap your name</h1>
      <p>Then tap where you are going. If you are already out, tap your name to come back.</p>
    </section>

    <section class="name-grid" aria-label="Students in this class">
      {#each students as student (student.recordId)}
        {@const pass = passFor(student)}
        <button class="name-tile" class:out={pass} onclick={() => chooseStudent(student)}>
          <span class="tile-name">{student.name}</span>
          <!-- Where they went, but never how long they have been gone: the door
               screen carries no clock and no overdue state. See docs/adr/0003. -->
          <span class="tile-status">{pass ? `Out — ${pass.destination}` : 'In class'}</span>
        </button>
      {:else}
        <p class="empty-chip">No students on this class's roster yet.</p>
      {/each}
    </section>

    <button class="corner-link" onclick={requestKioskExit}>Exit kiosk mode</button>
  </main>
</Shell>
