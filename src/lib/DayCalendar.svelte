<script lang="ts">
  import Icon from './Icon.svelte';
  import { newId } from './passes';
  import {
    clockOf,
    formatClock,
    formatRange,
    periodProblem,
    scheduledNoPassTimes,
    toClock,
    toMinutes,
  } from './schedule';
  import type { Class, ClockRange, Schedule } from './types';

  /**
   * One school day as a single calendar column, like a day view in Google
   * Calendar. Periods are blocks; No-Pass Times are striped, beside them. Drag
   * across empty time to add a period or a no-pass time, drag a block's top or
   * bottom edge to change its times, or click a block to change or remove it.
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
  const ruleNoPass = $derived(scheduledNoPassTimes(schedule).filter((time) => 'rule' in time.from));

  // ---------------------------------------------------------------------------
  // Dragging
  // ---------------------------------------------------------------------------

  let grid = $state<HTMLDivElement>();

  /**
   * A stretch being drawn, then waiting for "period or no-pass time?". It may
   * start on a period, since a no-pass time usually sits inside one; a press on
   * a block that never moves just opens that block.
   */
  let drawing = $state<{ anchor: number; at: number; done: boolean; pressed: Block | null } | null>(null);
  type Block = { kind: 'period' | 'no-pass'; id: string };
  /** A block whose edge is being dragged. */
  let resizing = $state<{ kind: 'period' | 'no-pass'; id: string; edge: 'start' | 'end'; at: number } | null>(null);
  /** The block whose details are open. */
  let selected = $state<Block | null>(null);
  let newClassId = $state('');

  function minuteAt(event: PointerEvent) {
    const offset = event.clientY - (grid?.getBoundingClientRect().top ?? 0);
    const minute = range.start + offset / pixelsPerMinute;
    return Math.max(range.start, Math.min(range.end, Math.round(minute / snapMinutes) * snapMinutes));
  }

  function startDrawing(event: PointerEvent, pressed: Block | null = null) {
    if (event.button !== 0 || (!pressed && event.target !== grid)) return;
    event.preventDefault();
    selected = null;
    const at = minuteAt(event);
    drawing = { anchor: at, at, done: false, pressed };
    grid?.setPointerCapture(event.pointerId);
  }

  function startResizing(event: PointerEvent, kind: 'period' | 'no-pass', id: string, edge: 'start' | 'end') {
    if (event.button !== 0) return;
    event.stopPropagation();
    selected = null;
    drawing = null;
    resizing = { kind, id, edge, at: minuteAt(event) };
    grid?.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent) {
    if (drawing && !drawing.done) drawing.at = minuteAt(event);
    if (resizing) resizing.at = minuteAt(event);
  }

  function finish() {
    if (drawing && !drawing.done) {
      const still = Math.abs(drawing.at - drawing.anchor) < snapMinutes;
      if (still && drawing.pressed) {
        selected = drawing.pressed;
        drawing = null;
        return;
      }
      // A click on empty time with no drag draws half an hour.
      if (still) drawing.at = Math.min(range.end, drawing.anchor + 30);
      drawing.done = true;
      newClassId = classes.find((cls) => !schedule.periods.some((period) => period.classId === cls.id))?.id ?? '';
    }
    if (resizing) {
      commitResize(resizing);
      resizing = null;
    }
  }

  const drawn = $derived(
    drawing
      ? { start: toClock(Math.min(drawing.anchor, drawing.at)), end: toClock(Math.max(drawing.anchor, drawing.at)) }
      : null,
  );
  const drawnProblem = $derived(drawn ? periodProblem(schedule, drawn) : null);

  /** A block's times while its edge is being dragged; otherwise as saved. */
  function shown<T extends ClockRange & { id: string }>(each: T, kind: 'period' | 'no-pass'): ClockRange {
    if (resizing?.kind !== kind || resizing.id !== each.id) return each;
    const moved = toClock(resizing.at);
    return resizing.edge === 'start'
      ? { start: moved < each.end ? moved : each.start, end: each.end }
      : { start: each.start, end: moved > each.start ? moved : each.end };
  }

  function commitResize(change: NonNullable<typeof resizing>) {
    const draft = $state.snapshot(schedule) as Schedule;
    const list = change.kind === 'period' ? draft.periods : draft.noPassTimes;
    const target = list.find((each) => each.id === change.id);
    if (!target) return;
    const next = shown(target, change.kind);
    if (next.start === target.start && next.end === target.end) {
      selected = { kind: change.kind, id: change.id };
      return;
    }
    // A period can't be stretched over its neighbour; it stays as it was.
    if (change.kind === 'period' && periodProblem(draft, { ...next, id: target.id })) return;
    Object.assign(target, next);
    onsave(draft);
  }

  function addPeriod() {
    if (!drawn || drawnProblem) return;
    const draft = $state.snapshot(schedule) as Schedule;
    draft.periods.push({ id: newId(), classId: newClassId || null, ...drawn });
    onsave(draft);
    drawing = null;
  }

  function addNoPass() {
    if (!drawn) return;
    const draft = $state.snapshot(schedule) as Schedule;
    draft.noPassTimes.push({ id: newId(), ...drawn });
    onsave(draft);
    drawing = null;
  }

  function setClass(periodId: string, classId: string) {
    const draft = $state.snapshot(schedule) as Schedule;
    const period = draft.periods.find((each) => each.id === periodId);
    if (!period) return;
    period.classId = classId || null;
    onsave(draft);
  }

  function remove(kind: 'period' | 'no-pass', id: string) {
    const draft = $state.snapshot(schedule) as Schedule;
    if (kind === 'period') draft.periods = draft.periods.filter((each) => each.id !== id);
    else draft.noPassTimes = draft.noPassTimes.filter((each) => each.id !== id);
    onsave(draft);
    selected = null;
  }

  const selectedPeriod = $derived(
    selected?.kind === 'period' ? schedule.periods.find((each) => each.id === selected?.id) : undefined,
  );
  const selectedNoPass = $derived(
    selected?.kind === 'no-pass' ? schedule.noPassTimes.find((each) => each.id === selected?.id) : undefined,
  );
  const nowClock = $derived(clockOf(clock));
  const nowShown = $derived(showNow && toMinutes(nowClock) >= range.start && toMinutes(nowClock) < range.end);
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key !== 'Escape') return;
    drawing = null;
    selected = null;
  }}
/>

<div class="calendar" style:--hour="{60 * pixelsPerMinute}px">
  <div class="hours" aria-hidden="true">
    {#each hours as hour (hour)}
      <span style:top="{(hour - range.start) * pixelsPerMinute}px">{formatClock(toClock(hour))}</span>
    {/each}
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="grid"
    bind:this={grid}
    style:height="{(range.end - range.start) * pixelsPerMinute}px"
    onpointerdown={startDrawing}
    onpointermove={move}
    onpointerup={finish}
    onpointercancel={() => {
      drawing = null;
      resizing = null;
    }}
    aria-label="{schedule.name}, drag across empty time to add a period or a no-pass time"
  >
    {#each schedule.periods as period (period.id)}
      {@const times = shown(period, 'period')}
      <div
        class="block period"
        class:empty-period={!period.classId}
        class:chosen={selected?.id === period.id}
        style:top="{top(times.start)}px"
        style:height="{height(times)}px"
      >
        <!-- A mouse press goes through startDrawing; the click here is for the keyboard. -->
        <button
          class="block-body"
          onpointerdown={(event) => startDrawing(event, { kind: 'period', id: period.id })}
          onclick={(event) => {
            if (event.detail === 0) selected = { kind: 'period', id: period.id };
          }}
        >
          <strong>{className(period.classId)}</strong>
          <span>{formatRange(times)}</span>
        </button>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span class="handle start" onpointerdown={(event) => startResizing(event, 'period', period.id, 'start')}></span>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span class="handle end" onpointerdown={(event) => startResizing(event, 'period', period.id, 'end')}></span>
      </div>
    {/each}

    {#each ruleNoPass as time, index (index)}
      <div
        class="no-pass from-rule"
        style:top="{top(time.start)}px"
        style:height="{height(time)}px"
        title="No passes {formatRange(time)}, from a rule on the left"
      >
        <span>No passes</span>
      </div>
    {/each}

    {#each schedule.noPassTimes as time (time.id)}
      {@const times = shown(time, 'no-pass')}
      <div
        class="no-pass drawn"
        class:chosen={selected?.id === time.id}
        style:top="{top(times.start)}px"
        style:height="{height(times)}px"
      >
        <button
          class="block-body"
          onpointerdown={(event) => startDrawing(event, { kind: 'no-pass', id: time.id })}
          onclick={(event) => {
            if (event.detail === 0) selected = { kind: 'no-pass', id: time.id };
          }}
        >
          <span>No passes · {formatRange(times)}</span>
        </button>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span class="handle start" onpointerdown={(event) => startResizing(event, 'no-pass', time.id, 'start')}></span>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span class="handle end" onpointerdown={(event) => startResizing(event, 'no-pass', time.id, 'end')}></span>
      </div>
    {/each}

    {#if drawn}
      <div class="ghost" style:top="{top(drawn.start)}px" style:height="{height(drawn)}px">
        {formatRange(drawn)}
      </div>
    {/if}

    {#if nowShown}
      <div class="now" style:top="{top(nowClock)}px" aria-label="Now, {formatClock(nowClock)}"></div>
    {/if}

    {#if drawing?.done && drawn}
      <div class="popover" style:top="{top(drawn.end) + 8}px" role="dialog" aria-label="Add {formatRange(drawn)}">
        <p class="eyebrow">{formatRange(drawn)}</p>
        {#if drawnProblem}
          <button class="btn btn-primary btn-small" onclick={addNoPass}><Icon name="ban" size={14} />Make it a no-pass time</button>
          <p class="muted small">It overlaps a period, so it can only be a no-pass time.</p>
        {:else}
        <div class="choice">
          <label class="field">
            A period for
            <select bind:value={newClassId}>
              <option value="">No class (lunch, planning…)</option>
              {#each classes as cls (cls.id)}<option value={cls.id}>{cls.name}</option>{/each}
            </select>
          </label>
          <button class="btn btn-primary btn-small" onclick={addPeriod}>Add period</button>
        </div>
        <div class="or"><span>or</span></div>
        <button class="btn btn-small" onclick={addNoPass}><Icon name="ban" size={14} />Make it a no-pass time</button>
        {/if}
        <button class="btn btn-quiet btn-small" onclick={() => (drawing = null)}>Cancel</button>
      </div>
    {/if}

    {#if selectedPeriod}
      <div class="popover" style:top="{top(selectedPeriod.end) + 8}px" role="dialog" aria-label="Period">
        <p class="eyebrow">Period · {formatRange(selectedPeriod)}</p>
        <label class="field">
          Class
          <select value={selectedPeriod.classId ?? ''} onchange={(event) => setClass(selectedPeriod.id, event.currentTarget.value)}>
            <option value="">No class (lunch, planning…)</option>
            {#each classes as cls (cls.id)}<option value={cls.id}>{cls.name}</option>{/each}
          </select>
        </label>
        <p class="muted small">Drag the top or bottom edge to change its times.</p>
        <div class="row">
          <button class="btn btn-danger btn-small" onclick={() => remove('period', selectedPeriod.id)}>
            <Icon name="trash" size={14} />Remove
          </button>
          <button class="btn btn-quiet btn-small" onclick={() => (selected = null)}>Done</button>
        </div>
      </div>
    {:else if selectedNoPass}
      <div class="popover" style:top="{top(selectedNoPass.end) + 8}px" role="dialog" aria-label="No-pass time">
        <p class="eyebrow">No-pass time · {formatRange(selectedNoPass)}</p>
        <p class="muted small">Applies to whichever class is on the kiosk. Drag an edge to change its times.</p>
        <div class="row">
          <button class="btn btn-danger btn-small" onclick={() => remove('no-pass', selectedNoPass.id)}>
            <Icon name="trash" size={14} />Remove
          </button>
          <button class="btn btn-quiet btn-small" onclick={() => (selected = null)}>Done</button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
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
  .no-pass,
  .ghost {
    position: absolute;
    border-radius: 7px;
  }

  .block {
    left: 6px;
    right: 6px;
    overflow: hidden;
    border: 1px solid #b9d6c3;
    background: #e3f1e9;
    cursor: default;
  }

  .block.empty-period {
    border-style: dashed;
    border-color: var(--border-strong);
    background: var(--surface-sunk);
  }

  .block-body {
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
    cursor: pointer;
  }

  .block-body span {
    color: var(--muted);
  }

  .chosen {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .no-pass {
    left: 62%;
    right: 10px;
    border: 1px solid #ecd3ac;
    background: repeating-linear-gradient(-45deg, #f7ecd9 0 6px, #fbf4e7 6px 12px);
    color: var(--warn);
    font-size: 11.5px;
    font-weight: 800;
    overflow: hidden;
  }

  .no-pass > span {
    padding: 2px 8px;
  }

  .no-pass.from-rule {
    pointer-events: none;
    opacity: 0.85;
  }

  .no-pass.drawn {
    left: 50%;
    border-color: #e0b878;
  }

  .no-pass.drawn .block-body span {
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

  .ghost {
    left: 6px;
    right: 6px;
    padding: 4px 10px;
    border: 2px dashed var(--accent);
    background: color-mix(in srgb, var(--accent-wash) 70%, transparent);
    color: var(--accent);
    font-size: 12.5px;
    font-weight: 800;
    pointer-events: none;
  }

  .now {
    position: absolute;
    left: -5px;
    right: 0;
    height: 2px;
    background: #c2412d;
    pointer-events: none;
    z-index: 2;
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
    z-index: 3;
    display: grid;
    gap: 10px;
    width: min(320px, calc(100% - 32px));
    padding: 14px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: 0 12px 30px rgb(60 45 20 / 0.16);
    cursor: default;
    user-select: text;
  }

  .choice {
    display: grid;
    gap: 8px;
  }

  .or {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--faint);
    font-size: 12px;
    font-weight: 700;
  }

  .or::before,
  .or::after {
    content: '';
    flex: 1;
    border-top: 1px solid var(--border);
  }
</style>
