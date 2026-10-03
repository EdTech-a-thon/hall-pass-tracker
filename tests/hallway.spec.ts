import { expect, test, type Page } from '@playwright/test';

async function createClassWithRoster(page: Page, name: string) {
  await page.goto('/classes/new');
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
  await page.getByRole('button', { name: 'Bathroom', exact: true }).click();
  await expect(page.getByText('Pass approved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Maya Ch\./ }).click();
  await page.getByRole('button', { name: 'Bathroom', exact: true }).click();
  await expect(page.getByText('Please wait in class')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // Leaving the kiosk asks first; teacher pages stay locked until the PIN is entered.
  const asked = new Promise<string>((resolve) =>
    page.once('dialog', async (dialog) => {
      resolve(dialog.type());
      await dialog.accept();
    }),
  );
  await page.goto('/kiosk');
  expect(await asked).toBe('beforeunload');
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
  await expect(page).toHaveURL(/\/welcome$/);
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
  await tablet.getByRole('button', { name: 'Bathroom', exact: true }).click();
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
  await page.getByRole('button', { name: 'Bathroom', exact: true }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // Full: Maya Ch. joins the line instead of being turned away.
  await page.getByRole('button', { name: /Maya Ch\./ }).click();
  await page.getByRole('button', { name: 'Bathroom', exact: true }).click();
  await page.getByRole('button', { name: 'Join the line' }).click();
  await expect(page.getByText("You're 1st in line")).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /Maya Ch\..*1st in line/ })).toBeVisible();

  // Someone not in line can't take the spot that opens.
  await page.getByRole('button', { name: /Jordan E\..*Out/ }).click();
  await expect(page.getByText(/it's your turn/)).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Maya Ca\./ }).click();
  await page.getByRole('button', { name: 'Bathroom', exact: true }).click();
  await expect(page.getByText('Join the line?')).toBeVisible();
  await page.getByRole('button', { name: 'Not now' }).click();

  // Maya Ch. is up next and goes where she lined up for.
  await page.getByRole('button', { name: /Maya Ch\..*Your turn/ }).click();
  await expect(page.getByText('Maya Ch.: Bathroom')).toBeVisible();
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

test('no-pass times hold everyone back, but students can line up', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-05T09:10:00') });
  await createClassWithRoster(page, 'Period 1');
  await page.getByRole('button', { name: 'Class settings' }).click();
  await page.getByRole('button', { name: 'Add a no-pass time' }).click();
  await page.getByLabel('No passes from').fill('09:00');
  await page.getByLabel('No passes until').fill('09:30');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/No passes 9:00/)).toBeVisible();

  await page.getByRole('link', { name: 'Pass Options' }).click();
  await page.getByRole('switch', { name: 'Let students line up' }).check();
  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();

  await expect(page.getByText('No passes right now.')).toBeVisible();
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: 'Bathroom', exact: true }).click();
  await expect(page.getByText(/Passes open at 9:30 AM. Join the line/)).toBeVisible();
  await page.getByRole('button', { name: 'Join the line' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /Jordan E\..*1st in line/ })).toBeVisible();

  // Once the no-pass time ends, the first in line is called.
  await page.clock.runFor('21:00');
  await expect(page.getByText('No passes right now.')).toBeHidden();
  await page.getByRole('button', { name: /Jordan E\..*Your turn/ }).click();
  await expect(page.getByText('Jordan E.: Bathroom')).toBeVisible();
});

test('a first visit gets the welcome page, a tour and a checklist', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { name: /Know who’s out/ })).toBeVisible();
  await page.getByRole('link', { name: /Get started, it’s free/ }).click();

  await expect(page.getByRole('heading', { name: 'Add your class' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Set your destinations' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Start the kiosk' })).toBeVisible();
  await expect(page.getByRole('note')).toContainText('Keep both screens open');
  await page.getByRole('button', { name: 'Add your class' }).click();

  await expect(page.getByText('Start with your first class')).toBeVisible();
  const checklist = page.getByRole('complementary', { name: 'Getting started' });
  await expect(checklist).toContainText('0 of 3');
  await page.getByLabel('Class name').fill('Period 5');
  await page.getByRole('button', { name: 'Create class' }).click();
  await page.getByLabel('One student per line').fill('Elliot Roe\nDuncan Johnson');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('button', { name: 'Save students' }).click();
  await expect(checklist).toContainText('1 of 3');
  await checklist.getByRole('link', { name: 'Set your destinations' }).click();
  await expect(checklist).toContainText('2 of 3');

  // Once welcomed, the app opens straight away.
  await page.goto('/');
  await expect(page).toHaveURL(/\/classes\//);
});

test('a destination can have a time limit', async ({ page }) => {
  await page.goto('/destinations');
  await page.getByRole('button', { name: /New destination|Add/ }).first().click();
  await page.getByLabel('Name').fill('Nurse');
  await page.getByLabel(/Minutes the trip should take/).fill('15');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'New destination' })).toBeHidden();
  await expect(page.getByText('15 minutes')).toBeVisible();

  await page.getByRole('button', { name: /Nurse/ }).click();
  await page.getByLabel(/Minutes the trip should take/).fill('');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Edit Nurse' })).toBeHidden();
});
