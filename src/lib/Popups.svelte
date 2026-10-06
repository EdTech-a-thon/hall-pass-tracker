<script lang="ts">
  import { goto, replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { account, markPopupsSeen } from './account.svelte';
  import Modal from './Modal.svelte';
  import { news, popupNamed, tips, unseenNews, unseenTips, type News, type Tip } from './popups';
  import UpdateArt from './UpdateArt.svelte';

  /**
   * Shows Popups, one at a time: news first, then this page's tips, in order.
   * Closing one in any way counts as having seen it. `?popup=<id>` shows one
   * again, `?popup=news` every piece of news, and `?popup=tour` this page's
   * tips, whether seen or not, as the Help menu offers.
   */
  let asked = $state(page.url.searchParams.get('popup'));
  // Arriving with ?popup= shows it once; drop it from the address so a reload doesn't.
  $effect(() => {
    const wanted = page.url.searchParams.get('popup');
    if (!wanted) return;
    asked = wanted;
    const url = new URL(page.url.href);
    url.searchParams.delete('popup');
    replaceState(url, {});
  });

  const path = $derived(page.url.pathname);

  const shownNews = $derived.by((): News[] => {
    if (asked === 'news') return [...news].reverse();
    const one = asked ? popupNamed(asked) : null;
    if (one && 'items' in one) return [one];
    return [...unseenNews(account.seenPopups)].reverse();
  });

  /** The tour for this page: every tip when asked for, otherwise only those not seen yet. */
  let tourDone = $state<string[]>([]);
  const tour = $derived.by((): Tip[] => {
    const one = asked ? popupNamed(asked) : null;
    if (one && !('items' in one)) return [one];
    const onPage = asked === 'tour' ? unseenTips(path, {}) : unseenTips(path, account.seenPopups);
    return onPage.filter((tip) => !tourDone.includes(tip.id));
  });

  function closeNews() {
    markPopupsSeen(shownNews.map((each) => each.id));
    asked = null;
  }

  function act(href: string) {
    closeNews();
    goto(href);
  }

  // A tip waits until what it points at has settled on the page, so it never
  // flashes up while the teacher is on their way somewhere else, then follows
  // it as the page scrolls.
  let target = $state<DOMRect | null>(null);
  const tip = $derived(shownNews.length ? null : (tour[0] ?? null));
  $effect(() => {
    if (!tip) return;
    const id = tip.id;
    const since = Date.now();
    const find = () => {
      const element = document.querySelector(`[data-tip="${id}"]`);
      target = element && Date.now() - since >= 700 ? element.getBoundingClientRect() : null;
    };
    find();
    const timer = setInterval(find, 400);
    window.addEventListener('scroll', find, true);
    window.addEventListener('resize', find);
    return () => {
      clearInterval(timer);
      window.removeEventListener('scroll', find, true);
      window.removeEventListener('resize', find);
      target = null;
    };
  });

  // Read the ids first: marking one seen moves `tip` on to the next straight away.
  function nextTip() {
    if (!tip) return;
    const id = tip.id;
    const last = tour.length <= 1;
    tourDone = [...tourDone, id];
    markPopupsSeen([id]);
    if (last) asked = null;
  }

  function endTour() {
    const ids = tour.map((each) => each.id);
    tourDone = [...tourDone, ...ids];
    markPopupsSeen(ids);
    asked = null;
  }

  // Leaving the page ends where the tour was; the rest waits for the next visit.
  $effect(() => {
    void path;
    tourDone = [];
  });

  /** Beside its target when there's room, otherwise below it, always on screen. */
  const placement = $derived.by(() => {
    if (!target) return null;
    const width = 300;
    const right = target.right + 16;
    if (right + width < window.innerWidth - 12 && target.width < 400) {
      return { left: right, top: Math.max(12, Math.min(target.top, window.innerHeight - 220)), side: 'left' };
    }
    return {
      left: Math.max(12, Math.min(target.left, window.innerWidth - width - 12)),
      top: Math.min(target.bottom + 12, window.innerHeight - 220),
      side: 'top',
    };
  });
  const tipNumber = $derived(tip ? tips.filter((each) => each.page === tip.page).findIndex((each) => each.id === tip.id) + 1 : 0);
  const tipCount = $derived(tip ? tips.filter((each) => each.page === tip.page).length : 0);
</script>

{#if shownNews.length}
  <Modal onClose={closeNews} labelledby="whats-changed-title">
    <div class="dialog whats-changed">
      <div>
        <p class="eyebrow">What's changed</p>
        <h2 id="whats-changed-title">Thank you for all your feedback</h2>
        <p class="muted">Here's what's new in Happy Hallways.</p>
      </div>

      {#each shownNews as update (update.id)}
        <section class="update">
          {#if shownNews.length > 1}<p class="eyebrow">{update.title}</p>{/if}
          <ol class="changes">
            {#each update.items as item (item.title)}
              <li>
                <div>
                  <h3>{item.title}</h3>
                  <p class="muted">{item.text}</p>
                </div>
                <UpdateArt art={item.art} />
              </li>
            {/each}
          </ol>
          {#if shownNews.length > 1}
            <div><button class="btn" onclick={() => act(update.action.href)}>{update.action.label}</button></div>
          {/if}
        </section>
      {/each}

      <div class="dialog-actions">
        {#if shownNews.length === 1}
          <button class="btn" onclick={() => act(shownNews[0].action.href)}>{shownNews[0].action.label}</button>
        {/if}
        <button class="btn btn-primary" onclick={closeNews}>Got it</button>
      </div>
    </div>
  </Modal>
{:else if tip && placement && target}
  <div class="spotlight" aria-hidden="true" style:left="{target.left - 6}px" style:top="{target.top - 6}px" style:width="{target.width + 12}px" style:height="{target.height + 12}px"></div>
  <div class="tip {placement.side}" role="dialog" aria-labelledby="tip-title" style:left="{placement.left}px" style:top="{placement.top}px">
    <p class="eyebrow">Tip{tipCount > 1 ? ` · ${tipNumber} of ${tipCount}` : ''}</p>
    <h3 id="tip-title">{tip.title}</h3>
    <p class="muted small">{tip.text}</p>
    <div class="row">
      {#if tour.length > 1}
        <button class="btn btn-small btn-quiet" onclick={endTour}>Skip</button>
        <button class="btn btn-small btn-primary" onclick={nextTip}>Next</button>
      {:else}
        <button class="btn btn-small btn-primary" onclick={nextTip}>Got it</button>
      {/if}
    </div>
  </div>
{/if}

<svelte:window onkeydown={(event) => event.key === 'Escape' && tip && !shownNews.length && endTour()} />

<style>
  .whats-changed {
    width: min(860px, 100%);
    max-height: calc(100vh - 32px);
    overflow-y: auto;
  }

  .update {
    display: grid;
    gap: 14px;
  }

  .update + .update {
    padding-top: 22px;
    border-top: 2px solid var(--border-strong);
  }

  .changes {
    display: grid;
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .changes li {
    display: grid;
    grid-template-columns: 1fr minmax(0, 260px);
    align-items: center;
    gap: 28px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  h3 {
    margin-bottom: 6px;
    font-size: 18px;
  }

  /* Below the corner messages (Overdue, the checklist), so a tip never hides them. */
  .spotlight {
    position: fixed;
    z-index: 40;
    border: 3px solid var(--sun-ray);
    border-radius: 14px;
    box-shadow: 0 0 0 4px rgb(251 191 36 / 25%);
    pointer-events: none;
  }

  .tip {
    position: fixed;
    z-index: 41;
    display: grid;
    gap: 6px;
    width: 300px;
    padding: 14px 16px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: 0 12px 32px rgb(42 38 31 / 18%);
  }

  .tip h3 {
    margin: 0;
    font-size: 16px;
  }

  .tip .row {
    justify-content: flex-end;
    margin-top: 4px;
  }

  @media (max-width: 640px) {
    .changes li {
      grid-template-columns: 1fr;
      gap: 12px;
    }
  }
</style>
