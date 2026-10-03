import { expect, test, type Page } from '@playwright/test';

async function createClassWithRoster(page: Page, name: string) {
  await page.goto('/');
  await page.getByLabel('Class name').fill(name);
  await page.getByRole('button', { name: 'Create class' }).click();
  await page.getByLabel('One student per line').fill('Maya Chen\nMaya Carter\nJordan Ellis');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('button', { name: 'Save students' }).click();
  await expect(page.getByText(/3 students/)).toBeVisible();
}

async function setPin(page: Page) {
  await page.getByRole('link', { name: /Kiosk/ }).click();
  await page.getByLabel('PIN (4 to 8 digits)').fill('2468');
  await page.getByRole('button', { name: 'Save PIN' }).click();
}

test('a teacher runs the kiosk on their own computer', async ({ page }) => {
  await createClassWithRoster(page, 'Period 1');
  await page.getByRole('link', { name: 'Students' }).click();
  await expect(page.getByText('Maya Ch.')).toBeVisible();

  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();
  await expect(page.getByRole('heading', { name: 'Tap your name' })).toBeVisible();

  // Sign out; the limit of 1 then refuses a second student.
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: 'Restroom' }).click();
  await expect(page.getByText('Pass approved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Maya Ch\./ }).click();
  await page.getByRole('button', { name: 'Water' }).click();
  await expect(page.getByText('Please wait in class')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // Teacher pages stay locked until the PIN is entered.
  await page.goto('/kiosk');
  await expect(page).toHaveURL(/\/door/);

  await page.getByRole('button', { name: /Jordan E\..*Out/ }).click();
  await expect(page.getByText('Welcome back', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Teacher' }).click();
  await page.getByLabel('PIN').fill('2468');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.getByRole('button', { name: 'Exit kiosk' }).click();
  await expect(page).toHaveURL(/\/kiosk$/);

  await page.getByRole('link', { name: /^Period 1/ }).click();
  await expect(page.getByText('Passes today')).toBeVisible();
  await expect(page.locator('.stat').first()).toContainText('1');
  await page.getByRole('link', { name: 'Students' }).click();
  await expect(page.getByRole('row', { name: /Jordan E\./ })).toContainText('1');
});

test('export and import put the teacher back where they were', async ({ page }) => {
  await createClassWithRoster(page, 'Period 2');
  await page.getByRole('link', { name: 'Settings' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const file = await (await download).path();

  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(page.getByText('Start with your first class')).toBeVisible();
  await page.goto('/settings');
  await page.locator('input[type=file]').setInputFiles(file!);
  await page.getByRole('button', { name: 'Replace everything' }).click();
  await expect(page.getByRole('heading', { name: 'Period 2' })).toBeVisible();
  await expect(page.getByText(/3 students/)).toBeVisible();
});

test('a paired device runs the door and syncs to the laptop', async ({ browser }) => {
  const laptop = await (await browser.newContext()).newPage();
  const tablet = await (await browser.newContext()).newPage();

  await createClassWithRoster(laptop, 'Period 3');
  await setPin(laptop);
  await laptop.getByRole('button', { name: 'Pair a device' }).click();
  await expect(laptop.getByText(/Waiting for the device/)).toBeVisible({ timeout: 20_000 });
  const code = (await laptop.locator('.pair-code').textContent())!.trim();

  await tablet.goto(`/door?code=${code}`);
  await expect(tablet.getByRole('heading', { name: 'Tap your name' })).toBeVisible({ timeout: 30_000 });
  await expect(laptop.getByRole('heading', { name: 'Connected!' })).toBeVisible({ timeout: 30_000 });
  await expect(laptop.getByText('Paired device · Live')).toBeVisible({ timeout: 10_000 });

  await tablet.getByRole('button', { name: /Maya Ca\./ }).click();
  await tablet.getByRole('button', { name: 'Office' }).click();
  await expect(tablet.getByText('Pass approved', { exact: true })).toBeVisible();

  await laptop.getByRole('link', { name: /^Period 3/ }).click();
  await expect(laptop.getByText('1 of 1 out')).toBeVisible({ timeout: 15_000 });

  // The teacher marks the student back from the laptop; the door hears about it.
  await laptop.getByRole('button', { name: 'Mark back' }).click();
  await tablet.getByRole('button', { name: 'Done' }).click();
  await expect(tablet.getByRole('button', { name: /Maya Ca\..*In class/ })).toBeVisible({ timeout: 15_000 });
});

test('students line up when the pass limit is reached', async ({ page }) => {
  await createClassWithRoster(page, 'Period 4');
  await page.getByRole('link', { name: 'Pass Options' }).click();
  await page.getByRole('switch', { name: 'Let students line up' }).check();
  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();

  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: 'Restroom' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // Full: Maya Ch. joins the line instead of being turned away.
  await page.getByRole('button', { name: /Maya Ch\./ }).click();
  await page.getByRole('button', { name: 'Water' }).click();
  await page.getByRole('button', { name: 'Join the line' }).click();
  await expect(page.getByText("You're 1st in line")).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /Maya Ch\..*1st in line/ })).toBeVisible();

  // Someone not in line can't take the spot that opens.
  await page.getByRole('button', { name: /Jordan E\..*Out/ }).click();
  await expect(page.getByText(/it's your turn/)).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Maya Ca\./ }).click();
  await page.getByRole('button', { name: 'Office' }).click();
  await expect(page.getByText('Join the line?')).toBeVisible();
  await page.getByRole('button', { name: 'Not now' }).click();

  // Maya Ch. is up next and goes where she lined up for.
  await page.getByRole('button', { name: /Maya Ch\..*Your turn/ }).click();
  await expect(page.getByText('Maya Ch.: Water')).toBeVisible();
});

test('pop-ups close with Escape or a click outside', async ({ page }) => {
  await createClassWithRoster(page, 'Period 6');
  await page.getByRole('button', { name: 'Add students' }).click();
  await expect(page.getByRole('heading', { name: 'Add students' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Add students' })).toBeHidden();

  await page.getByRole('button', { name: 'Add students' }).click();
  await page.mouse.click(5, 5);
  await expect(page.getByRole('heading', { name: 'Add students' })).toBeHidden();
});
