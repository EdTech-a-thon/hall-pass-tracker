import { expect, test, type Page } from '@playwright/test';

const fakeToken = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 }))}.signature`;

async function openKiosk(page: Page) {
  await page.route('**/api/collections/kiosk_devices/auth-refresh', async (route) => {
    await route.fulfill({ json: { token: fakeToken, record: { id: 'kioskdevice001', collectionId: 'kiosk_devices', collectionName: 'kiosk_devices', active: true } } });
  });
  await page.addInitScript((token) => localStorage.setItem('hallpass.kiosk.session', JSON.stringify({ token, record: { id: 'kioskdevice001', collectionName: 'kiosk_devices' } })), fakeToken);
  await page.goto('/');
}

async function openTeacher(page: Page) {
  await page.route('**/api/collections/teachers/auth-with-password', async (route) => {
    await route.fulfill({ json: { token: fakeToken, record: { id: 'teacher1234567', collectionId: 'teachers', collectionName: 'teachers', verified: true } } });
  });
  await page.route('**/api/hallway/vault', async (route) => route.fulfill({ status: 204 }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Teacher sign in' }).click();
  await page.getByLabel('Email address').fill('teacher@school.edu');
  await page.getByLabel('Password').fill('a-secure-teacher-password');
  await page.getByRole('button', { name: 'Open teacher workspace' }).click();
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
}

test('kiosk requires a one-time link code and never asks for teacher credentials', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('One-time link code')).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveCount(0);
  await expect(page.getByText(/Never enter a teacher password/)).toBeVisible();
  await expect(page.getByText('Test environment · no production student data')).toBeVisible();
});

test('kiosk is visually subdued and approval remains high contrast', async ({ page }) => {
  await openKiosk(page);
  await expect(page.locator('.app-shell.kiosk')).toBeVisible();
  await expect(page.locator('.app-shell.kiosk')).toHaveCSS('background-color', 'rgb(16, 24, 20)');
  await page.getByLabel('Student ID').fill('5620');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'Request hall pass' }).click();
  await expect(page.getByRole('status')).toHaveClass(/approved/);
  await expect(page.getByRole('status')).toHaveCSS('background-color', 'rgb(20, 115, 68)');
});

test('public registration creates a separate teacher classroom and signs in', async ({ page }) => {
  let createBody: Record<string, unknown> = {};
  await page.route('**/api/collections/teachers/records', async (route) => {
    createBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: { id: 'newteacher00001', collectionId: 'teachers', collectionName: 'teachers', email: 'new@school.test', displayName: 'Taylor Reed', verified: false } });
  });
  await page.route('**/api/collections/teachers/auth-with-password', async (route) => {
    await route.fulfill({ json: { token: fakeToken, record: { id: 'newteacher00001', collectionId: 'teachers', collectionName: 'teachers', verified: false } } });
  });
  await page.route('**/api/hallway/vault', async (route) => route.fulfill({ status: 204 }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Teacher sign in' }).click();
  await page.getByRole('button', { name: 'Create a classroom account' }).click();
  await page.getByLabel('Your name').fill('Taylor Reed');
  await page.getByLabel('Email address').fill('new@school.test');
  await page.getByLabel('Password', { exact: true }).fill('unique-classroom-password');
  await page.getByLabel('Confirm password').fill('unique-classroom-password');
  await page.getByRole('button', { name: 'Create private workspace' }).click();
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
  expect(createBody).toMatchObject({ email: 'new@school.test', displayName: 'Taylor Reed' });
  expect(createBody).not.toHaveProperty('emailVisibility');
});

test('registration rejects mismatched passwords before contacting PocketBase', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/collections/teachers/records', async (route) => { requests += 1; await route.abort(); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Teacher sign in' }).click();
  await page.getByRole('button', { name: 'Create a classroom account' }).click();
  await page.getByLabel('Your name').fill('Taylor Reed');
  await page.getByLabel('Email address').fill('new@school.test');
  await page.getByLabel('Password', { exact: true }).fill('unique-classroom-password');
  await page.getByLabel('Confirm password').fill('different-classroom-password');
  await page.getByRole('button', { name: 'Create private workspace' }).click();
  await expect(page.getByRole('alert')).toContainText('do not match');
  expect(requests).toBe(0);
});

test('registration shows PocketBase password validation feedback', async ({ page }) => {
  await page.route('**/api/collections/teachers/records', async (route) => {
    await route.fulfill({ status: 400, json: { message: 'Failed to create record.', data: { password: { message: 'Must be at least 8 character(s).' } } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Teacher sign in' }).click();
  await page.getByRole('button', { name: 'Create a classroom account' }).click();
  await page.getByLabel('Your name').fill('Taylor Reed');
  await page.getByLabel('Email address').fill('new@school.test');
  await page.getByLabel('Password', { exact: true }).fill('valid-browser-password');
  await page.getByLabel('Confirm password').fill('valid-browser-password');
  await page.getByRole('button', { name: 'Create private workspace' }).click();
  await expect(page.getByRole('alert')).toContainText('Must be at least 8 character(s).');
});

test('unknown student IDs fail without rendering attacker-controlled HTML', async ({ page }) => {
  await openKiosk(page);
  await page.getByLabel('Student ID').fill('9999');
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByRole('alert')).toContainText('could not find');
  await expect(page.locator('script[src="//evil.invalid"]')).toHaveCount(0);
});

test('student selects a reason and receives a distance-readable approval', async ({ page }) => {
  await openKiosk(page);
  await page.getByLabel('Student ID').fill('5620');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByText('Water', { exact: true }).click();
  await page.getByLabel(/How long/).selectOption('10');
  await page.getByRole('button', { name: 'Request hall pass' }).click();
  const notice = page.getByRole('status');
  await expect(notice).toHaveClass(/approved/);
  await expect(notice.getByRole('heading')).toHaveText('Avery Brooks');
  await expect(notice).toContainText('Return in 10 minutes');
});

test('capacity denial names currently-out students and explains the next action', async ({ page }) => {
  await openKiosk(page);
  await page.getByLabel('Student ID').fill('5620');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'Request hall pass' }).click();
  await page.waitForTimeout(4700);
  await page.getByLabel('Student ID').fill('3077');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'Request hall pass' }).click();
  const notice = page.getByRole('status');
  await expect(notice).toHaveClass(/denied/);
  await expect(notice).toContainText('hallway limit has been reached');
  await expect(notice).toContainText('Noah Williams');
  await expect(notice).toContainText('Avery Brooks');
});

test('student can sign themselves back in with the same ID', async ({ page }) => {
  await openKiosk(page);
  await page.getByLabel('Student ID').fill('4419');
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByRole('status')).toContainText('WELCOME BACK');
  await expect(page.getByRole('status').getByRole('heading')).toHaveText('Noah Williams');
});

test('teacher workspace exposes limits, analytics, and third-party check-in markers', async ({ page }) => {
  await openTeacher(page);
  await page.getByLabel('Maximum out at once').selectOption('3');
  await page.getByRole('button', { name: 'Analytics' }).click();
  await expect(page.getByRole('heading', { name: 'Hall pass analytics' })).toBeVisible();
  await expect(page.getByText('Signed in by Maya Chen')).toBeVisible();
  await page.getByRole('button', { name: 'Export to Google Sheets' }).click();
  await expect(page.getByRole('heading', { name: 'Hallway analytics exported' })).toBeVisible();
});

test('teacher authentication is held in memory and is lost on refresh', async ({ page }) => {
  await openTeacher(page);
  await page.reload();
  await expect(page.getByLabel('One-time link code')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Good morning/ })).toHaveCount(0);
});

test('local storage cannot be used to forge a teacher session', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('hallpass.teacher.session', 'forged');
    sessionStorage.setItem('hallpass.teacher.session', 'forged');
  });
  await page.goto('/');
  await expect(page.getByLabel('One-time link code')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Good morning/ })).toHaveCount(0);
});

test('a forged or expired kiosk token is rejected before showing student data', async ({ page }) => {
  await page.route('**/api/collections/kiosk_devices/auth-refresh', async (route) => route.fulfill({ status: 401, json: { message: 'invalid token' } }));
  await page.addInitScript(() => localStorage.setItem('hallpass.kiosk.session', JSON.stringify({ token: 'forged', record: { id: 'admin' } })));
  await page.goto('/');
  await expect(page.getByLabel('One-time link code')).toBeVisible();
  await expect(page.getByLabel('Student ID')).toHaveCount(0);
});
