<script lang="ts">
  import type { Filter, FilterField } from './history';
  import Icon from './Icon.svelte';
  import Popover from './Popover.svelte';

  /**
   * Notion-style filters: each is a chip ("Class is Period 1 or Period 2")
   * that opens a checklist of its choices. "+ Filter" adds one. Filters
   * combine with "and"; the choices inside one combine with "or". A filter
   * with nothing ticked yet doesn't filter.
   */
  let { fields, filters, onchange }: { fields: FilterField[]; filters: Filter[]; onchange: (filters: Filter[]) => void } =
    $props();

  let openIndex = $state<number | null>(null);
  let adding = $state(false);
  let search = $state('');

  const fieldNamed = (key: string) => fields.find((field) => field.key === key);
  const unused = $derived(fields.filter((field) => !filters.some((filter) => filter.field === field.key)));

  function describe(filter: Filter) {
    const field = fieldNamed(filter.field);
    if (!filter.values.length) return `${field?.label} is …`;
    const names = filter.values.map((value) => field?.options.find((option) => option.value === value)?.label ?? value);
    return `${field?.label} is ${names.length > 2 ? `${names.length} choices` : names.join(' or ')}`;
  }

  function add(key: string) {
    // Take the index first: once onchange returns, `filters` already includes the new one.
    const index = filters.length;
    onchange([...filters, { field: key, values: [] }]);
    adding = false;
    search = '';
    openIndex = index;
  }

  function toggleValue(index: number, value: string) {
    onchange(
      filters.map((filter, each) =>
        each !== index
          ? filter
          : {
              ...filter,
              values: filter.values.includes(value)
                ? filter.values.filter((existing) => existing !== value)
                : [...filter.values, value],
            },
      ),
    );
  }

  function remove(index: number) {
    onchange(filters.filter((_, each) => each !== index));
    openIndex = null;
  }

  function focusOnShow(input: HTMLInputElement) {
    input.focus();
  }
</script>

<div class="chips">
  {#each filters as filter, index (filter.field)}
    {@const field = fieldNamed(filter.field)}
    <Popover bind:open={() => openIndex === index, (value) => (openIndex = value ? index : null)}>
      {#snippet trigger({ toggle })}
        <button
          class="chip"
          class:empty={!filter.values.length}
          onclick={() => {
            search = '';
            toggle();
          }}>{describe(filter)}</button
        >
      {/snippet}
      {#snippet children()}
        {#if (field?.options.length ?? 0) > 6}
          <input class="search" placeholder="Search…" bind:value={search} {@attach focusOnShow} />
        {/if}
        <div class="options">
          {#each field?.options.filter((option) => option.label.toLowerCase().includes(search.trim().toLowerCase())) ?? [] as option (option.value)}
            <label class="option">
              <input type="checkbox" checked={filter.values.includes(option.value)} onchange={() => toggleValue(index, option.value)} />
              {option.label}
            </label>
          {:else}
            <p class="none">No matches.</p>
          {/each}
        </div>
        <button class="remove" onclick={() => remove(index)}><Icon name="x" size={14} />Remove filter</button>
      {/snippet}
    </Popover>
  {/each}

  {#if unused.length}
    <Popover bind:open={adding} minWidth={180}>
      {#snippet trigger({ toggle })}
        <button class="add" onclick={toggle}><Icon name="plus" size={14} />Filter</button>
      {/snippet}
      {#snippet children()}
        <div class="options">
          {#each unused as field (field.key)}
            <button class="option" onclick={() => add(field.key)}>{field.label}</button>
          {/each}
        </div>
      {/snippet}
    </Popover>
  {/if}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .chip,
  .add {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 11px;
    border: 1px solid transparent;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .chip {
    background: var(--accent-wash);
    color: var(--accent-hover);
  }

  .chip.empty {
    background: var(--warn-wash);
    color: var(--warn);
  }

  .add {
    border: 1px dashed var(--border-strong);
    background: none;
    color: var(--muted);
  }

  .search {
    width: 100%;
    margin-bottom: 4px;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 13px;
  }

  .options {
    display: flex;
    flex-direction: column;
    max-height: 260px;
    overflow: auto;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 0;
    border-radius: 5px;
    background: none;
    font-size: 13.5px;
    text-align: left;
    cursor: pointer;
  }

  .option:hover {
    background: var(--surface-sunk);
  }

  .none {
    padding: 6px 8px;
    color: var(--muted);
    font-size: 13px;
  }

  .remove {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    margin-top: 4px;
    padding: 8px;
    border: 0;
    border-top: 1px solid var(--border);
    background: none;
    color: var(--danger);
    font-size: 13px;
    cursor: pointer;
  }
</style>
