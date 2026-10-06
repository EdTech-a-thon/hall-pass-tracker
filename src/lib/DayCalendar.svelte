<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import { newId } from './passes';
  import { clockOf, formatClock, formatRange, periodNoPass, periodProblem, toClock, toMinutes } from './schedule';
  import type { Class, ClockRange, Period, Schedule } from './types';

  /**
   * One school day as a single calendar column, like a day view in Google
   * Calendar. Periods are blocks, with their first and last no-pass minutes
   * striped inside them; No-Pass Times drawn on the schedule are striped
   * blocks of their own. A tool decides what dragging does: Period draws a
   * period on empty time, No-pass draws a no-pass time anywhere, even across
   * periods. Periods never overlap, so pressing on one with the Period tool can
   * only mean "open it" (a click) or "move it" (a drag); a block's top or
   * bottom edge resizes it in either tool.
   * The list beside the calendar does everything this does, by keyboard.
   */
  let {
    schedule,
    classes,
    showNow,
    onsave,
  }: { schedule: Schedule; classes: Class[]; showNow: boolean; onsave: (schedule: Schedule) => void } = $props();

  const pixelsPerMinute = 1.5;
  const snapMinutes = 5;

  type Tool = 'period' | 'no-pass';
  const tools: { id: Tool; label: string; key: string; icon: IconName; hint: string }[] = [
    {
      id: 'period',
      label: 'Period',
      key: 'p',
      icon: 'plus',
      hint: 'Drag across empty time to add a period. Click a period to change it, or drag it to move it.',
    },
    {
      id: 'no-pass',
      label: 'No-pass',
      key: 'n',
      icon: 'ban',
      hint: 'Drag across any time, even during a period, to stop passes then.',
    },
  ];
  let tool = $state<Tool>('period');

  let clock = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (clock = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  /** The hours shown: the school day, stretched to fit anything set outside it. */
  const range = $derived.by(() => {
    const times = [...schedule.periods, ...schedule.noPassTimes].flatMap((each) => [
      toMinutes(each.start),
      toMinutes(each.end),
    ]);
    const first = Math.min(7 * 60, ...times);
    const last = Math.max(16 * 60, ...times);
    return { start: Math.floor(first / 60) * 60, end: Math.min(24 * 60, Math.ceil(last / 60) * 60) };
  });
  const hours = $derived(
    Array.from({ length: (range.end - range.start) / 60 }, (_, index) => range.start + index * 60),
  );

  const top = (clock: string) => (toMinutes(clock) - range.start) * pixelsPerMinute;
  const height = (each: ClockRange) => (toMinutes(each.end) - toMinutes(each.start)) * pixelsPerMinute;
  const className = (id: string | null) => classes.find((cls) => cls.id === id)?.name ?? 'No class';

  // ---------------------------------------------------------------------------
  // Dragging
  // ---------------------------------------------------------------------------

  let grid = $state<HTMLDivElement>();

  type Kind = 'period' | 'no-pass';
  type Block = { kind: Kind; id: string };
  /** A new period or no-pass time being drawn. It is added as soon as the mouse is let go. */
  let drawing = $state<{ kind: Kind; anchor: number; at: number } | null>(null);
  /** A block being pressed: let go without moving to open it, drag to move it, or drag an edge to resize it. */
  let dragging = $state<(Block & { grab: 'start' | 'end' | 'body'; anchor: number; at: number }) | null>(null);
  /** The block whose card is open. */
  let selected = $state<Block | null>(null);

  function minuteAt(event: PointerEvent) {
    const offset = event.clientY - (grid?.getBoundingClientRect().top ?? 0);
    const minute = range.start + offset / pixelsPerMinute;
    return Math.max(range.start, Math.min(range.end, Math.round(minute / snapMinutes) * snapMinutes));
  }

  function pressGrid(event: PointerEvent) {
    if (event.button !== 0 || event.target !== grid) return;
    event.preventDefault();
    selected = null;
    const at = minuteAt(event);
    drawing = { kind: tool, anchor: at, at };
    grid?.setPointerCapture(event.pointerId);
  }

  function pressBlock(event: PointerEvent, block: Block, grab: 'start' | 'end' | 'body') {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const at = minuteAt(event);
    // A no-pass time usually sits inside a period, so with that tool a period is somewhere to draw.
    if (tool === 'no-pass' && block.kind === 'period' && grab === 'body') {
      selected = null;
      drawing = { kind: 'no-pass', anchor: at, at };
    } else {
      dragging = { ...block, grab, anchor: at, at };
    }
    grid?.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent) {
    if (drawing) drawing.at = minuteAt(event);
    if (dragging) dragging.at = minuteAt(event);
  }

  function letGo() {
    if (drawing) {
      if (drawn && toMinutes(drawn.end) - toMinutes(drawn.start) >= snapMinutes) add(drawing.kind, drawn);
      drawing = null;
    }
    if (dragging) {
      const block = dragging;
      dragging = null;
      if (block.at === block.anchor) selected = { kind: block.kind, id: block.id };
      else commitDrag(block);
    }
  }

  const drawn = $derived(
    drawing
      ? { start: toClock(Math.min(drawing.anchor, drawing.at)), end: toClock(Math.max(drawing.anchor, drawing.at)) }
      : null,
  );
  /** A period drawn over another can't be added; it shows in red until it's moved clear. */
  const drawnClash = $derived(drawing?.kind === 'period' && drawn ? !!periodProblem(schedule, drawn) : false);

  /** A block's times while it's being dragged; otherwise as saved. */
  function shown(each: ClockRange & { id: string }, drag = dragging): ClockRange {
    if (drag?.id !== each.id) return each;
    const start = toMinutes(each.start);
    const end = toMinutes(each.end);
    const by = drag.at - drag.anchor;
    if (drag.grab === 'start') return { start: toClock(Math.min(start + by, end - snapMinutes)), end: each.end };
    if (drag.grab === 'end') return { start: each.start, end: toClock(Math.max(end + by, start + snapMinutes)) };
    const moved = Math.max(range.start - start, Math.min(range.end - end, by));
    return { start: toClock(start + moved), end: toClock(end + moved) };
  }

  /** Whether a period being dragged has landed on another one, and so will go back. */
  function clashes(period: Period) {
    return dragging?.id === period.id && !!periodProblem(schedule, { ...shown(period), id: period.id });
  }

  function commitDrag(block: NonNullable<typeof dragging>) {
    const draft = $state.snapshot(schedule) as Schedule;
    const list: (ClockRange & { id: string })[] = block.kind === 'period' ? draft.periods : draft.noPassTimes;
    const target = list.find((each) => each.id === block.id);
    if (!target) return;
    const next = shown(target, block);
    // A period can't land on its neighbour; it stays where it was.
    if (block.kind === 'period' && periodProblem(draft, { ...next, id: target.id })) return;
    Object.assign(target, next);
    onsave(draft);
  }

  function add(kind: Kind, times: ClockRange) {
    const draft = $state.snapshot(schedule) as Schedule;
    const id = newId();
    if (kind === 'period') {
      if (periodProblem(draft, times)) return;
      const unused = classes.find((cls) => !schedule.periods.some((period) => period.classId === cls.id));
      draft.periods.push({ id, classId: unused?.id ?? null, ...times, noPass: { first: 0, last: 0 } });
    } else {
      draft.noPassTimes.push({ id, ...times });
    }
    onsave(draft);
    selected = { kind, id };
  }

  // ---------------------------------------------------------------------------
  // The open card
  // ---------------------------------------------------------------------------

  const selectedPeriod = $derived(
    selected?.kind === 'period' ? schedule.periods.find((each) => each.id === selected?.id) : undefined,
  );
  const selectedNoPass = $derived(
    selected?.kind === 'no-pass' ? schedule.noPassTimes.find((each) => each.id === selected?.id) : undefined,
  );
  /** Why the open card's last change was refused. */
  let cardProblem = $state('');
  $effect(() => {
    void selected;
    cardProblem = '';
  });

  function edit(change: (draft: Schedule) => string | void) {
    const draft = $state.snapshot(schedule) as Schedule;
    const problem = change(draft);
    cardProblem = problem ?? '';
    if (!problem) onsave(draft);
  }

  function setTime(input: HTMLInputElement, block: Block, field: 'start' | 'end') {
    edit((draft) => {
      const list: (ClockRange & { id: string })[] = block.kind === 'period' ? draft.periods : draft.noPassTimes;
      const target = list.find((each) => each.id === block.id);
      if (!target) return;
      const next = { ...target, [field]: input.value };
      const problem =
        block.kind === 'period'
          ? periodProblem(draft, next)
          : !next.start || !next.end || next.start >= next.end
            ? 'A no-pass time needs to start before it ends.'
            : null;
      if (problem) {
        input.value = target[field];
        return problem;
      }
      target[field] = input.value;
    });
  }

  function setNoPass(input: HTMLInputElement, periodId: string, edge: 'first' | 'last') {
    const minutes = Math.round(Number(input.value || 0));
    edit((draft) => {
      const period = draft.periods.find((each) => each.id === periodId);
      if (!period) return;
      if (!(minutes >= 0 && minutes <= 120)) {
        input.value = String(period.noPass?.[edge] ?? 0);
        return 'Pick between 0 and 120 minutes.';
      }
      period.noPass = { first: 0, last: 0, ...period.noPass, [edge]: minutes };
    });
  }

  /** Copies one period's first and last no-pass minutes onto every period with a class. */
  function applyToEvery(periodId: string) {
    edit((draft) => {
      const noPass = draft.periods.find((each) => each.id === periodId)?.noPass ?? { first: 0, last: 0 };
      for (const period of draft.periods) if (period.classId) period.noPass = { ...noPass };
    });
  }

  function setClass(periodId: string, classId: string) {
    edit((draft) => {
      const period = draft.periods.find((each) => each.id === periodId);
      if (period) period.classId = classId || null;
    });
  }

  function remove(block: Block) {
    edit((draft) => {
      if (block.kind === 'period') draft.periods = draft.periods.filter((each) => each.id !== block.id);
      else draft.noPassTimes = draft.noPassTimes.filter((each) => each.id !== block.id);
    });
    selected = null;
  }

  const otherClassPeriods = $derived(
    schedule.periods.filter((each) => each.classId && each.id !== selectedPeriod?.id).length,
  );
  const nowClock = $derived(clockOf(clock));
  const nowShown = $derived(showNow && toMinutes(nowClock) >= range.start && toMinutes(nowClock) < range.end);

  function shortcut(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      drawing = null;
      dragging = null;
      selected = null;
      return;
    }
    const typing = event.target instanceof HTMLElement && event.target.closest('input, select, textarea');
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
    const picked = tools.find((each) => each.key === event.key.toLowerCase());
    if (picked) tool = picked.id;
  }
</script>

<svelte:window onkeydown={shortcut} />

<div class="calendar-tools">
  <p class="muted small">{tools.find((each) => each.id === tool)?.hint}</p>
  <div class="tool-tabs" role="radiogroup" aria-label="What dragging on the calendar does">
    {#each tools as each (each.id)}
      <button
        role="radio"
        aria-checked={tool === each.id}
        class:active={tool === each.id}
        title="{each.label} ({each.key.toUpperCase()})"
        onclick={() => (tool = each.id)}
      >
        <Icon name={each.icon} size={14} />{each.label}
      </button>
    {/each}
  </div>
</div>

<div class="calendar" style:--hour="{60 * pixelsPerMinute}px">
  <div class="hours" aria-hidden="true">
    {#each hours as hour (hour)}
      <span style:top="{(hour - range.start) * pixelsPerMinute}px">{formatClock(toClock(hour))}</span>
    {/each}
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="grid tool-{tool}"
    bind:this={grid}
    style:height="{(range.end - range.start) * pixelsPerMinute}px"
    onpointerdown={pressGrid}
    onpointermove={move}
    onpointerup={letGo}
    onpointercancel={() => {
      drawing = null;
      dragging = null;
    }}
    aria-label="{schedule.name} calendar"
  >
    {#each schedule.periods as period (period.id)}
      {@const times = shown(period)}
      {@const length = toMinutes(times.end) - toMinutes(times.start)}
      <div
        class="block period"
        class:empty-period={!period.classId}
        class:chosen={selected?.id === period.id}
        class:clash={clashes(period)}
        class:moving={dragging?.id === period.id}
        style:top="{top(times.start)}px"
        style:height="{height(times)}px"
      >
        {#each periodNoPass({ ...period, ...times }) as band, index (index)}
          <span
            class="band"
            class:at-start={band.start === times.start}
            style:top="{((toMinutes(band.start) - toMinutes(times.start)) / length) * 100}%"
            style:height="{((toMinutes(band.end) - toMinutes(band.start)) / length) * 100}%"
            title="No passes {formatRange(band)}"
          ></span>
        {/each}
        <!-- A mouse press goes through pressBlock; the click here is for the keyboard. -->
        <button
          class="block-body"
          onpointerdown={(event) => pressBlock(event, { kind: 'period', id: period.id }, 'body')}
          onclick={(event) => {
            if (event.detail === 0) selected = { kind: 'period', id: period.id };
          }}
        >
          <span class="label"><strong>{className(period.classId)}</strong><span>{formatRange(times)}</span></span>
        </button>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span class="handle start" onpointerdown={(event) => pressBlock(event, { kind: 'period', id: period.id }, 'start')}
        ></span>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span class="handle end" onpointerdown={(event) => pressBlock(event, { kind: 'period', id: period.id }, 'end')}
        ></span>
      </div>
    {/each}

    {#each schedule.noPassTimes as time (time.id)}
      {@const times = shown(time)}
      <div
        class="no-pass"
        class:chosen={selected?.id === time.id}
        class:moving={dragging?.id === time.id}
        style:top="{top(times.start)}px"
        style:height="{height(times)}px"
      >
        <button
          class="block-body"
          onpointerdown={(event) => pressBlock(event, { kind: 'no-pass', id: time.id }, 'body')}
          onclick={(event) => {
            if (event.detail === 0) selected = { kind: 'no-pass', id: time.id };
          }}
        >
          <span>No passes · {formatRange(times)}</span>
        </button>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span class="handle start" onpointerdown={(event) => pressBlock(event, { kind: 'no-pass', id: time.id }, 'start')}
        ></span>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span class="handle end" onpointerdown={(event) => pressBlock(event, { kind: 'no-pass', id: time.id }, 'end')}
        ></span>
      </div>
    {/each}

    {#if drawing && drawn}
      {#if drawing.kind === 'period'}
        <div
          class="block period drawing"
          class:clash={drawnClash}
          style:top="{top(drawn.start)}px"
          style:height="{height(drawn)}px"
        >
          <span class="block-body"><strong>{drawnClash ? 'Overlaps a period' : 'New period'}</strong><span>{formatRange(drawn)}</span></span>
        </div>
      {:else}
        <div class="no-pass drawing" style:top="{top(drawn.start)}px" style:height="{height(drawn)}px">
          <span class="block-body"><span>No passes · {formatRange(drawn)}</span></span>
        </div>
      {/if}
    {/if}

    {#if nowShown}
      <div class="now" style:top="{top(nowClock)}px" aria-label="Now, {formatClock(nowClock)}"></div>
    {/if}

    {#if selectedPeriod}
      {@const period = selectedPeriod}
      <div class="popover" style:top="{top(period.end) + 8}px" role="dialog" aria-label="Period">
        <div class="popover-head">
          <p class="eyebrow">Period</p>
          <button class="btn btn-quiet btn-small" aria-label="Close" onclick={() => (selected = null)}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <label class="field">
          Class
          <select value={period.classId ?? ''} onchange={(event) => setClass(period.id, event.currentTarget.value)}>
            <option value="">No class (lunch, planning…)</option>
            {#each classes as cls (cls.id)}<option value={cls.id}>{cls.name}</option>{/each}
          </select>
        </label>
        <div class="times">
          <label class="field">
            Starts
            <input type="time" value={period.start} onchange={(event) => setTime(event.currentTarget, selected!, 'start')} />
          </label>
          <label class="field">
            Ends
            <input type="time" value={period.end} onchange={(event) => setTime(event.currentTarget, selected!, 'end')} />
          </label>
        </div>
        {#if period.classId}
          <div class="times">
            <label class="field">
              No passes, first
              <span class="minutes">
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={period.noPass?.first ?? 0}
                  onchange={(event) => setNoPass(event.currentTarget, period.id, 'first')}
                />min
              </span>
            </label>
            <label class="field">
              No passes, last
              <span class="minutes">
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={period.noPass?.last ?? 0}
                  onchange={(event) => setNoPass(event.currentTarget, period.id, 'last')}
                />min
              </span>
            </label>
          </div>
          {#if otherClassPeriods}
            <button class="btn btn-small" onclick={() => applyToEvery(period.id)}>
              <Icon name="copy" size={14} />Use these no-pass minutes in every period
            </button>
          {/if}
        {/if}
        {#if cardProblem}<p class="form-error" role="alert">{cardProblem}</p>{/if}
        <div class="row">
          <button class="btn btn-danger btn-small" onclick={() => remove(selected!)}>
            <Icon name="trash" size={14} />Remove
          </button>
          <button class="btn btn-quiet btn-small" onclick={() => (selected = null)}>Done</button>
        </div>
      </div>
    {:else if selectedNoPass}
      {@const time = selectedNoPass}
      <div class="popover" style:top="{top(time.end) + 8}px" role="dialog" aria-label="No-pass time">
        <div class="popover-head">
          <p class="eyebrow">No-pass time</p>
          <button class="btn btn-quiet btn-small" aria-label="Close" onclick={() => (selected = null)}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <p class="muted small">Applies to whichever class is on the kiosk.</p>
        <div class="times">
          <label class="field">
            From
            <input type="time" value={time.start} onchange={(event) => setTime(event.currentTarget, selected!, 'start')} />
          </label>
          <label class="field">
            Until
            <input type="time" value={time.end} onchange={(event) => setTime(event.currentTarget, selected!, 'end')} />
          </label>
        </div>
        {#if cardProblem}<p class="form-error" role="alert">{cardProblem}</p>{/if}
        <div class="row">
          <button class="btn btn-danger btn-small" onclick={() => remove(selected!)}>
            <Icon name="trash" size={14} />Remove
          </button>
          <button class="btn btn-quiet btn-small" onclick={() => (selected = null)}>Done</button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .calendar-tools {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .calendar-tools p {
    flex: 1 1 0;
    min-width: 0;
  }

  .tool-tabs {
    display: inline-flex;
    flex: none;
    margin-left: auto;
    padding: 3px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--surface-sunk);
  }

  .tool-tabs button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 0;
    border-radius: 7px;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .tool-tabs button.active {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 3px rgb(60 45 20 / 0.14);
  }

  .calendar {
    position: relative;
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    padding: 10px 12px 10px 0;
    user-select: none;
  }

  .hours {
    position: relative;
  }

  .hours span {
    position: absolute;
    right: 10px;
    transform: translateY(-50%);
    color: var(--faint);
    font-size: 11.5px;
    font-weight: 700;
    white-space: nowrap;
  }

  .grid {
    position: relative;
    border-left: 1px solid var(--border);
    background: repeating-linear-gradient(
      to bottom,
      var(--border) 0,
      var(--border) 1px,
      transparent 1px,
      transparent var(--hour)
    );
    cursor: crosshair;
    touch-action: none;
  }

  .block,
  .no-pass {
    position: absolute;
    border-radius: 7px;
  }

  .block {
    left: 6px;
    right: 6px;
    overflow: hidden;
    border: 1px solid #b9d6c3;
    background: #e3f1e9;
  }

  .block.empty-period {
    border-style: dashed;
    border-color: var(--border-strong);
    background: var(--surface-sunk);
  }

  .block.drawing,
  .no-pass.drawing,
  .moving {
    z-index: 2;
    box-shadow: 0 6px 18px rgb(60 45 20 / 0.18);
    pointer-events: none;
  }

  .block.clash {
    border-color: var(--danger);
    background: var(--danger-wash);
  }

  /* A period's first or last no-pass minutes: construction stripes across the whole card, edged by a dashed line. */
  .band {
    position: absolute;
    left: 0;
    right: 0;
    background: repeating-linear-gradient(-45deg, #f7e3bd 0 6px, #fbf1dc 6px 12px);
    border-top: 2px dashed #d39b45;
    pointer-events: none;
  }

  .band.at-start {
    border-top: 0;
    border-bottom: 2px dashed #d39b45;
  }

  .block-body {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 0 8px;
    width: 100%;
    height: 100%;
    padding: 4px 10px;
    border: 0;
    background: none;
    text-align: left;
    font-size: 12.5px;
    cursor: grab;
  }

  .tool-no-pass .period .block-body {
    cursor: crosshair;
  }

  .block-body span {
    color: var(--muted);
  }

  /* The name sits on the card's own color, so a no-pass band's dashed line passes behind it. */
  .label {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0 8px;
    padding: 0 4px;
    margin-left: -4px;
    border-radius: 4px;
    background: #e3f1e9;
  }

  .empty-period .label {
    background: var(--surface-sunk);
  }

  .clash .label {
    background: var(--danger-wash);
  }

  .chosen {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .no-pass {
    left: 50%;
    right: 10px;
    overflow: hidden;
    border: 1px solid #e0b878;
    background: repeating-linear-gradient(-45deg, #f7ecd9 0 6px, #fbf4e7 6px 12px);
    font-size: 11.5px;
  }

  .no-pass .block-body span {
    color: var(--warn);
    font-weight: 800;
  }

  .handle {
    position: absolute;
    left: 0;
    right: 0;
    height: 8px;
    cursor: ns-resize;
  }

  .handle.start {
    top: -2px;
  }

  .handle.end {
    bottom: -2px;
  }

  .now {
    position: absolute;
    left: -5px;
    right: 0;
    height: 2px;
    background: #c2412d;
    pointer-events: none;
    z-index: 3;
  }

  .now::before {
    content: '';
    position: absolute;
    left: 0;
    top: -4px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #c2412d;
  }

  .popover {
    position: absolute;
    left: 16px;
    z-index: 4;
    display: grid;
    gap: 10px;
    width: min(340px, calc(100% - 32px));
    padding: 14px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: 0 12px 30px rgb(60 45 20 / 0.16);
    cursor: default;
    user-select: text;
  }

  .popover-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .times {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .minutes {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .minutes input {
    width: 100%;
  }
</style>
