import { expect, test } from '@playwright/test';

const runRealSignup = process.env.REAL_SIGNUP_E2E === '1';
const realSignupTest = runRealSignup ? test : test.skip;

realSignupTest('a new teacher can create a classroom account through the real browser flow', async ({ page }) => {
  const unique = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
  const email = `playwright-signup-${unique}@example.com`;
  const password = `Hallway-${unique}-secure`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Teacher sign in' }).click();
  await page.getByRole('button', { name: 'Create a classroom account' }).click();
  await page.getByLabel('Your name').fill('Playwright Teacher');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create private workspace' }).click();

  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toHaveCount(0);
});
