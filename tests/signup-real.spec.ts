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

realSignupTest('a teacher can enter kiosk mode and exit with the PIN', async ({ page }) => {
  await registerTeacher(page);
  await page.getByRole('button', { name: 'Enter kiosk mode' }).first().click();
  await page.getByLabel('Six-digit PIN').fill('123456');
  await page.getByLabel('Confirm PIN').fill('123456');
  await page.getByRole('button', { name: 'Save PIN and enter kiosk mode' }).click();
  await expect(page.getByLabel('Student ID')).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Exit kiosk mode' }).click();
  await page.getByLabel('Six-digit PIN').fill('123456');
  await page.getByRole('dialog').getByRole('button', { name: 'Exit kiosk mode' }).click();
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
});
