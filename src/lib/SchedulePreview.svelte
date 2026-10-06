<script lang="ts">
  import { formatClock, formatRange, periodNoPass, sortedPeriods, toClock, toMinutes } from './schedule';
  import type { Class, ClockRange, Schedule } from './types';

  /**
   * A schedule at a glance, for its card on the Schedule page: its day as one
   * bar, periods in green and no-pass time striped, then the periods in order.
   */
  let { schedule, classes }: { schedule: Schedule; classes: Class[] } = $props();

  const periods = $derived(sortedPeriods(schedule));
  const range = $derived.by(() => {
    const times = [...schedule.periods, ...schedule.noPassTimes].flatMap((each) => [
      toMinutes(each.start),
      toMinutes(each.end),
    ]);
    const first = Math.min(7 * 60, ...times);
    const last = Math.max(16 * 60, ...times);
    return { start: Math.floor(first / 60) * 60, end: Math.ceil(last / 60) * 60 };
  });
  const left = (each: ClockRange) => ((toMinutes(each.start) - range.start) / (range.end - range.start)) * 100;
  const width = (each: ClockRange) => ((toMinutes(each.end) - toMinutes(each.start)) / (range.end - range.start)) * 100;
  const noPass = $derived([...schedule.periods.flatMap((period) => periodNoPass(period)), ...schedule.noPassTimes]);
  const className = (id: string | null) => classes.find((cls) => cls.id === id)?.name ?? 'No class';
</script>

<div class="preview">
  <div class="day" aria-hidden="true">
    {#each periods as period (period.id)}
      <span class="period" class:empty={!period.classId} style:left="{left(period)}%" style:width="{width(period)}%"></span>
    {/each}
    {#each noPass as time, index (index)}
      <span class="no-pass" style:left="{left(time)}%" style:width="{width(time)}%"></span>
    {/each}
  </div>
  <div class="ends muted" aria-hidden="true">
    <span>{formatClock(toClock(range.start))}</span><span>{formatClock(toClock(range.end))}</span>
  </div>
  {#if periods.length}
    <ul>
      {#each periods.slice(0, 6) as period (period.id)}
        <li><strong>{className(period.classId)}</strong><span class="muted">{formatRange(period)}</span></li>
      {/each}
      {#if periods.length > 6}<li class="muted">and {periods.length - 6} more</li>{/if}
    </ul>
  {:else}
    <p class="muted small">No periods yet.</p>
  {/if}
</div>

<style>
  .preview {
    display: grid;
    gap: 6px;
  }

  .day {
    position: relative;
    height: 22px;
    border-radius: 6px;
    background: var(--surface-sunk);
    overflow: hidden;
  }

  .day span {
    position: absolute;
    top: 0;
    bottom: 0;
  }

  .period {
    border-right: 2px solid var(--surface);
    background: #b9d6c3;
  }

  .period.empty {
    background: var(--border);
  }

  .no-pass {
    background: repeating-linear-gradient(-45deg, #e9b76a 0 3px, #f7e3bd 3px 6px);
  }

  .ends {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 700;
  }

  ul {
    display: grid;
    gap: 3px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
    font-size: 13px;
  }

  li {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }
</style>
