import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Helpers for taking the screenshots in the Guides. Each guide's script drives
 * the real app, circles what to click, and saves a picture into
 * static/guides/<guide>/, where the guide's page shows it.
 */

type Box = { x: number; y: number; width: number; height: number };

/** What the next picture zooms in on: everything circled since the last one. */
let marked: Box[] = [];

/** A class with a few students, as a teacher would set it up. */
export async function createClass(page: Page, name: string, students: string[]) {
  await page.goto('/classes/new');
  await page.getByLabel('Class name').fill(name);
  await page.getByRole('button', { name: 'Create class' }).click();
  await page.getByLabel('One student per line').fill(students.join('\n'));
  await page.getByRole('dialog').getByRole('button', { name: 'Add students' }).click();
  await expect(page.getByText(`${students.length} students`)).toBeVisible();
}

/**
 * Draws a red ring around something on the page, the way you'd mark up a
 * screenshot by hand. It hugs the element, so it never covers what's beside it.
 */
export async function circle(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error('Nothing to circle: the element is not on screen.');
  marked.push(box);
  await target.page().evaluate((box) => {
    const gap = 7;
    const ring = document.createElement('div');
    ring.className = 'guide-circle';
    Object.assign(ring.style, {
      position: 'fixed',
      left: `${box.x - gap}px`,
      top: `${box.y - gap}px`,
      width: `${box.width + gap * 2}px`,
      height: `${box.height + gap * 2}px`,
      border: '4px solid #e11d48',
      borderRadius: `${Math.min(18, box.height / 2 + gap)}px`,
      boxShadow: '0 0 0 3px rgb(255 255 255 / 70%)',
      pointerEvents: 'none',
      zIndex: '2147483647',
    });
    document.body.append(ring);
  }, box);
}

/**
 * Saves one step's picture, then takes the circles away. The picture zooms in
 * on what's circled, plus anything in `alsoShow` (a heading, say), keeping the screen's
 * shape so every picture in a guide is the same size. With nothing circled,
 * it shows the whole screen.
 */
export async function snap(page: Page, guide: string, name: string, alsoShow: Locator | Locator[] = []) {
  // No blinking cursor or focus ring in the picture.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  // Let pop-ups finish opening before the picture is taken.
  await page.waitForTimeout(300);
  const context = await Promise.all([alsoShow].flat().map((each) => each.boundingBox()));
  const clip = zoomOn([...marked, ...context.filter((box) => box !== null)], page.viewportSize()!);
  await page.screenshot({ path: `static/guides/${guide}/${name}.png`, clip });
  await page.evaluate(() => document.querySelectorAll('.guide-circle').forEach((ring) => ring.remove()));
  marked = [];
}

/** A 16:10 window, at least 800 by 500, around all the boxes, kept on the screen. */
function zoomOn(boxes: Box[], screen: { width: number; height: number }): Box | undefined {
  if (!boxes.length) return undefined;
  const padding = 48;
  const left = Math.min(...boxes.map((box) => box.x)) - padding;
  const top = Math.min(...boxes.map((box) => box.y)) - padding;
  const right = Math.max(...boxes.map((box) => box.x + box.width)) + padding;
  const bottom = Math.max(...boxes.map((box) => box.y + box.height)) + padding;
  const ratio = screen.width / screen.height;
  let width = Math.max(800, right - left, (bottom - top) * ratio);
  width = Math.min(width, screen.width);
  const height = width / ratio;
  const x = Math.min(Math.max((left + right) / 2 - width / 2, 0), screen.width - width);
  const y = Math.min(Math.max((top + bottom) / 2 - height / 2, 0), screen.height - height);
  return { x, y, width, height };
}
