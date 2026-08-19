import { expect, test, type Page } from '@playwright/test';

const runRealSignup = process.env.REAL_SIGNUP_E2E === '1';
const realSignupTest = runRealSignup ? test : test.skip;

async function registerTeacher(page: Page) {
  const unique = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
  const email = `playwright-signup-${unique}@example.com`;
  const password = `Hallway-${unique}-secure`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Create a classroom account' }).click();
  await page.getByLabel('Your name').fill('Playwright Teacher');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create private workspace' }).click();
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
}

realSignupTest('a new teacher can create a classroom account through the real browser flow', async ({ page }) => {
  await registerTeacher(page);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toHaveCount(0);
});

realSignupTest('a real kiosk link signs a student out and the teacher sees it', async ({ page, browser }) => {
  await registerTeacher(page);

  await page.getByRole('button', { name: 'Security' }).click();
  await page.getByLabel('Name this device').fill('Room 214 door');
  await page.getByRole('button', { name: 'Create a kiosk link' }).click();
  const kioskUrl = await page.getByLabel('Kiosk link').inputValue();
  await page.getByRole('button', { name: 'Close' }).click();

  // A separate browser context is the device by the door: it has never signed in.
  const doorDevice = await browser.newContext();
  const door = await doorDevice.newPage();
  await door.goto(kioskUrl);
  await expect(door.getByText('ROOM 214 DOOR')).toBeVisible();
  await door.getByLabel('Student ID').fill('5620');
  await door.getByRole('button', { name: /Continue/ }).click();
  await expect(door.getByRole('heading', { name: 'Avery Brooks' })).toBeVisible();
  await door.getByText('Water', { exact: true }).click();
  await door.getByRole('button', { name: 'Request hall pass' }).click();
  await expect(door.getByRole('status')).toHaveClass(/approved/);

  // The teacher workspace refreshes the log on its own.
  await page.getByRole('button', { name: 'Live class' }).click();
  await expect(page.getByRole('heading', { name: 'Avery Brooks' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Water · out 1 min')).toBeVisible();

  await page.getByRole('button', { name: 'Analytics' }).click();
  await expect(page.getByText('Still out')).toBeVisible();
  await doorDevice.close();
});
