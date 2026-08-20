import { expect, test, type Page } from '@playwright/test';

const fakeToken = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 }))}.signature`;
const teacherId = 'teacher1234567';

/** PocketBase writes timestamps with a space rather than a "T". */
function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString().replace('T', ' ');
}

const roster = [
  { id: '1042', name: 'Maya Chen' },
  { id: '2381', name: 'Jordan Ellis' },
  { id: '3077', name: 'Sofia Ramirez' },
  { id: '4419', name: 'Noah Williams' },
  { id: '5620', name: 'Avery Brooks' },
];

type Event = { id: string; studentId: string; studentName: string; kind: 'out' | 'in'; destination: string; minutes: number; source: string; signedInBy: string; at: string };

/** The same class the old demo data described, written as a log of exits and returns. */
function sampleLog(): Event[] {
  const entry = (id: string, studentId: string, kind: 'out' | 'in', at: number, extra: Partial<Event> = {}): Event => ({
    id, studentId, studentName: roster.find((student) => student.id === studentId)!.name,
    kind, destination: '', minutes: 0, source: 'kiosk', signedInBy: '', at: minutesAgo(at), ...extra,
  });
  return [
    entry('e3', '3077', 'out', 70, { destination: 'Counselor', minutes: 15 }),
    entry('e4', '3077', 'in', 52, { source: 'teacher', signedInBy: 'Ms. Rivera' }),
    entry('e5', '1042', 'out', 25, { destination: 'Water', minutes: 5 }),
    entry('e6', '1042', 'in', 21, {}),
    entry('e1', '2381', 'out', 18, { destination: 'Restroom', minutes: 8 }),
    entry('e2', '2381', 'in', 10, {}),
    entry('e7', '4419', 'out', 6, { destination: 'Main office', minutes: 10 }),
  ];
}

function list(items: unknown[]) {
  return { page: 1, perPage: 500, totalItems: items.length, totalPages: 1, items };
}

/**
 * Stands in for the kiosk half of PocketBase. It enforces the same rules the
 * real route does, so these tests exercise a kiosk that genuinely cannot read
 * the log it writes to.
 */
async function stubKioskBackend(page: Page, options: { limit?: number; log?: Event[] } = {}) {
  const limit = options.limit ?? 2;
  const log = options.log ?? sampleLog();

  await page.route('**/api/hallway/kiosk/events', async (route) => {
    const body = route.request().postDataJSON() as { studentId: string; kind: 'out' | 'in'; destination: string; minutes: number };
    const student = roster.find((item) => item.id === body.studentId);
    if (!student) {
      await route.fulfill({ status: 400, json: { message: 'We could not find that student ID. Please try again.' } });
      return;
    }
    const latest: Record<string, string> = {};
    for (const event of log) latest[event.studentId] = event.kind;
    const outNow = Object.values(latest).filter((kind) => kind === 'out').length;
    if (body.kind === 'out' && outNow >= limit) {
      await route.fulfill({ json: { status: 'denied', name: student.name, out: outNow, limit } });
      return;
    }
    const at = minutesAgo(0);
    log.push({ id: `new${log.length}`, studentId: student.id, studentName: student.name, kind: body.kind, destination: body.destination, minutes: body.minutes, source: 'kiosk', signedInBy: '', at });
    await route.fulfill({
      json: {
        status: body.kind === 'out' ? 'approved' : 'returned',
        name: student.name, destination: body.destination, minutes: body.minutes, outAt: at,
        out: body.kind === 'out' ? outNow + 1 : outNow - 1, limit,
      },
    });
  });
}

async function openKiosk(page: Page, options: { limit?: number; log?: Event[] } = {}) {
  await stubKioskBackend(page, options);
  await openTeacher(page);
  await page.getByRole('button', { name: 'Enter kiosk mode' }).first().click();
  await expect(page.getByLabel('Student ID')).toBeVisible();
}

async function stubTeacherBackend(page: Page, log = sampleLog()) {
  await page.route('**/api/collections/teachers/auth-with-password', async (route) => {
    await route.fulfill({ json: { token: fakeToken, record: { id: teacherId, collectionId: 'teachers', collectionName: 'teachers', verified: true, displayName: 'Ms. Rivera', passLimit: 2 } } });
  });
  await page.route('**/api/collections/students/records*', async (route) => {
    await route.fulfill({ json: list(roster.map((student) => ({ id: `rec${student.id}`, studentId: student.id, name: student.name, teacher: teacherId }))) });
  });
  await page.route('**/api/collections/pass_events/records*', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { id: 'created', ...(route.request().postDataJSON() as object), at: minutesAgo(0) } });
      return;
    }
    await route.fulfill({ json: list(log) });
  });
  await page.route('**/api/collections/teachers/records/*', async (route) => await route.fulfill({ json: { id: teacherId, collectionName: 'teachers', displayName: 'Ms. Rivera', passLimit: 3 } }));
  await page.route('**/api/hallway/kiosk/pin/status', async (route) => await route.fulfill({ json: { hasPin: true } }));
  await page.route('**/api/hallway/kiosk/pin/verify', async (route) => {
    const { pin } = route.request().postDataJSON() as { pin: string };
    await route.fulfill(pin === '123456' ? { json: {} } : { status: 400, json: { message: 'That PIN is incorrect.' } });
  });
  await page.route('**/api/hallway/kiosk/pin', async (route) => await route.fulfill({ json: {} }));
}

async function openTeacher(page: Page) {
  await stubTeacherBackend(page);
  await page.goto('/');
  await page.getByLabel('Email address').fill('teacher@school.edu');
  await page.getByLabel('Password').fill('a-secure-teacher-password');
  await page.getByRole('button', { name: 'Open teacher workspace' }).click();
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
}

test('a classroom device opens on teacher sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByText(/Sign in here, then choose Enter kiosk mode/i)).toBeVisible();
  await expect(page.getByText('Test environment · no production student data')).toBeVisible();
});

test('the first kiosk session asks the teacher to create a six-digit PIN', async ({ page }) => {
  await openTeacher(page);
  await page.route('**/api/hallway/kiosk/pin/status', async (route) => await route.fulfill({ json: { hasPin: false } }));
  await page.getByRole('button', { name: 'Enter kiosk mode' }).first().click();
  await expect(page.getByRole('heading', { name: 'Create your kiosk PIN' })).toBeVisible();
  await page.getByLabel('Six-digit PIN').fill('123456');
  await page.getByLabel('Confirm PIN').fill('123456');
  await page.getByRole('button', { name: 'Save PIN and enter kiosk mode' }).click();
  await expect(page.getByLabel('Student ID')).toBeVisible();
});

test('the kiosk never asks the database for the pass log', async ({ page }) => {
  // A kiosk reaches PocketBase only through its two custom routes. Any direct
  // collection request from this screen would mean it can read the database.
  await openKiosk(page);
  const reads: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/collections/')) reads.push(`${request.method()} ${request.url()}`);
  });
  await page.getByLabel('Student ID').fill('5620');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'Request hall pass' }).click();
  await expect(page.getByRole('status')).toHaveClass(/approved/);
  expect(reads).toEqual([]);
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
  await stubTeacherBackend(page, []);
  await page.route('**/api/collections/teachers/records', async (route) => {
    createBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: { id: 'newteacher00001', collectionId: 'teachers', collectionName: 'teachers', email: 'new@school.test', displayName: 'Taylor Reed', verified: false } });
  });
  await page.goto('/');
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

test('student selects a destination and receives a distance-readable approval', async ({ page }) => {
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

test('the server refuses a pass over the limit and the kiosk explains without naming anyone', async ({ page }) => {
  await openKiosk(page);
  await page.getByLabel('Student ID').fill('5620');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'Request hall pass' }).click();
  await expect(page.getByRole('status')).toHaveClass(/approved/);
  await page.waitForTimeout(4700);
  await page.getByLabel('Student ID').fill('3077');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'Request hall pass' }).click();
  const notice = page.getByRole('status');
  await expect(notice).toHaveClass(/denied/);
  await expect(notice).toContainText('hallway limit has been reached');
  await expect(notice).toContainText('2 of 2 students are out right now');
  await expect(notice).not.toContainText('Noah Williams');
  await expect(notice).not.toContainText('Avery Brooks');
});

test('student can sign themselves back in with the same ID', async ({ page }) => {
  await openKiosk(page);
  await page.getByLabel('Student ID').fill('4419');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'I am back in class' }).click();
  await expect(page.getByRole('status')).toContainText('WELCOME BACK');
  await expect(page.getByRole('status').getByRole('heading')).toHaveText('Noah Williams');
});

test('teacher workspace exposes limits, analytics, and third-party check-in markers', async ({ page }) => {
  await openTeacher(page);
  await page.getByLabel('Maximum out at once').selectOption('3');
  await page.getByRole('button', { name: 'Analytics' }).click();
  await expect(page.getByRole('heading', { name: 'Hall pass analytics' })).toBeVisible();
  await expect(page.getByText('Signed in by Ms. Rivera')).toBeVisible();
  await page.getByRole('button', { name: 'Export to Google Sheets' }).click();
  await expect(page.getByRole('heading', { name: 'Hallway analytics exported' })).toBeVisible();
});

test('teacher can set a new kiosk PIN from Profile', async ({ page }) => {
  await openTeacher(page);
  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Set a new PIN' }).click();
  await page.getByLabel('Six-digit PIN').fill('654321');
  await page.getByLabel('Confirm PIN').fill('654321');
  await page.getByRole('button', { name: 'Save new PIN' }).click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
});

test('teacher authentication is held in memory and is lost on refresh', async ({ page }) => {
  await openTeacher(page);
  await page.reload();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Good morning/ })).toHaveCount(0);
});

test('local storage cannot be used to forge a teacher session', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('hallpass.teacher.session', 'forged');
    sessionStorage.setItem('hallpass.teacher.session', 'forged');
  });
  await page.goto('/');
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Good morning/ })).toHaveCount(0);
});

test('the kiosk PIN is required to return to the teacher workspace', async ({ page }) => {
  await openKiosk(page);
  await page.getByRole('main').getByRole('button', { name: 'Exit kiosk mode' }).click();
  await page.getByLabel('Six-digit PIN').fill('000000');
  await page.getByRole('dialog').getByRole('button', { name: 'Exit kiosk mode' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('incorrect');
  await page.getByLabel('Six-digit PIN').fill('123456');
  await page.getByRole('dialog').getByRole('button', { name: 'Exit kiosk mode' }).click();
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
});
