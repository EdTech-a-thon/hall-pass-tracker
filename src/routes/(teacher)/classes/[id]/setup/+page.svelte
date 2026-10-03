<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { classPasses, deleteClass, findClass, updateClass } from '#lib/account.svelte.ts';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import type { Destination } from '#lib/types.ts';

  const cls = $derived(findClass(page.params.id ?? '')!);

  // The form edits copies; the class only changes on Save.
  let name = $state('');
  let limit = $state(1);
  let destinations = $state([] as Destination[]);
  let loadedFor = $state('');
  let saved = $state(false);
  let deleting = $state(false);

  $effect(() => {
    if (loadedFor === cls.id) return;
    loadedFor = cls.id;
    name = cls.name;
    limit = cls.limit;
    destinations = cls.destinations.map((each) => ({ ...each }));
  });

  const valid = $derived(name.trim() && destinations.every((each) => each.label.trim() && each.minutes > 0));

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!valid) return;
    updateClass(cls.id, {
      name: name.trim(),
      limit,
      destinations: destinations.map((each) => ({ label: each.label.trim(), minutes: Math.round(each.minutes) })),
    });
    saved = true;
    setTimeout(() => (saved = false), 2000);
  }

  function remove() {
    deleteClass(cls.id);
    goto('/', { replace: true });
  }
</script>

<form class="card" onsubmit={save}>
  <div>
    <p class="eyebrow">Setup</p>
    <h2>How this class uses the kiosk</h2>
  </div>

  <label class="field">Class name <input bind:value={name} /></label>

  <label class="field" style="max-width:260px">
    Pass limit: how many may be out at once
    <select bind:value={limit}>
      {#each [1, 2, 3, 4, 5, 6] as option (option)}<option value={option}>{option}</option>{/each}
    </select>
  </label>

  <div class="stack" style="gap:8px">
    <p class="field" style="font-size:13px;font-weight:700">Destinations, and the minutes each trip should take</p>
    {#each destinations as destination, index (index)}
      <div class="row" style="flex-wrap:nowrap">
        <input aria-label="Destination name" bind:value={destination.label} placeholder="Restroom" />
        <input aria-label="Expected minutes" type="number" min="1" max="60" bind:value={destination.minutes} style="width:90px" />
        <span class="muted small">min</span>
        <button
          type="button"
          class="btn btn-small btn-quiet"
          aria-label="Remove {destination.label || 'destination'}"
          onclick={() => (destinations = destinations.filter((_, other) => other !== index))}
        >
          <Icon name="x" size={15} />
        </button>
      </div>
    {/each}
    <div>
      <button type="button" class="btn btn-small" onclick={() => destinations.push({ label: '', minutes: 5 })}>
        <Icon name="plus" size={14} />Add destination
      </button>
    </div>
    {#if !destinations.length}
      <p class="form-error">Students can't sign out until there is at least one destination.</p>
    {/if}
  </div>

  <div class="row">
    <button class="btn btn-primary" disabled={!valid}>Save changes</button>
    {#if saved}<span class="badge ok"><Icon name="check" size={13} />Saved</span>{/if}
  </div>
</form>

<section class="card">
  <div>
    <p class="eyebrow">Danger zone</p>
    <h2>Delete this class</h2>
    <p class="muted small">This deletes the roster and every pass. Export your account first if you might need them.</p>
  </div>
  <div><button class="btn btn-danger" onclick={() => (deleting = true)}><Icon name="trash" size={15} />Delete class</button></div>
</section>

{#if deleting}
  <ConfirmDialog
    title="Delete {cls.name}?"
    message="Its {cls.students.length} students and {classPasses(cls.id).length} passes will be gone for good."
    confirmLabel="Delete class"
    danger
    onConfirm={remove}
    onCancel={() => (deleting = false)}
  />
{/if}
