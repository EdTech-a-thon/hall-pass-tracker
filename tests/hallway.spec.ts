import { expect, test, type Page } from '@playwright/test';

const fakeToken = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 }))}.signature`;
const teacherId = 'teacher1234567';

/** PocketBase writes timestamps with a space rather than a "T". */
function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString().replace('T', ' ');
}

const periodOne = 'cls000000000001';
const periodTwo = 'cls000000000002';

const sampleClasses = [
  { id: periodOne, teacher: teacherId, name: 'Period 1', position: 0, archived: false },
  { id: periodTwo, teacher: teacherId, name: 'Period 2', position: 1, archived: false },
];

/**
 * Rosters store a first name and a last-name prefix, never a full last name.
 * "Maya C." is the whole of what Hallway knows about her. See docs/adr/0001.
 */
const roster = [
  { id: 'stu000000000001', firstName: 'Maya', lastPrefix: 'C', class: periodOne },
  { id: 'stu000000000002', firstName: 'Jordan', lastPrefix: 'E', class: periodOne },
  { id: 'stu000000000003', firstName: 'Sofia', lastPrefix: 'R', class: periodOne },
  { id: 'stu000000000004', firstName: 'Noah', lastPrefix: 'W', class: periodOne },
  { id: 'stu000000000005', firstName: 'Avery', lastPrefix: 'B', class: periodOne },
  { id: 'stu000000000006', firstName: 'Riley', lastPrefix: 'O', class: periodTwo },
];

/** The teacher's own Destination list, each with the minutes a trip should take. */
const sampleDestinations = [
  { label: 'Restroom', minutes: 8 },
  { label: 'Water', minutes: 5 },
  { label: 'Main office', minutes: 10 },
  { label: 'Counselor', minutes: 20 },
];

function shown(student: { firstName: string; lastPrefix: string }) {
  return student.lastPrefix ? `${student.firstName} ${student.lastPrefix}.` : student.firstName;
}

type Event = { id: string; student: string; studentName: string; kind: 'out' | 'in' | 'fix'; corrects?: string; newStudent?: string; newAt?: string; destination: string; minutes: number; source: string; signedInBy: string; class: string; at: string };

/** The same class the old demo data described, written as a log of exits and returns. */
function sampleLog(): Event[] {
  const entry = (id: string, student: string, kind: 'out' | 'in', at: number, extra: Partial<Event> = {}): Event => ({
    id, student, studentName: shown(roster.find((item) => item.id === student)!),
    kind, destination: '', minutes: 0, source: 'kiosk', signedInBy: '', class: periodOne, at: minutesAgo(at), ...extra,
  });
  return [
    entry('e3', 'stu000000000003', 'out', 70, { destination: 'Counselor', minutes: 15 }),
    entry('e4', 'stu000000000003', 'in', 52, { source: 'teacher', signedInBy: 'Ms. Rivera' }),
    entry('e5', 'stu000000000001', 'out', 25, { destination: 'Water', minutes: 5 }),
    entry('e6', 'stu000000000001', 'in', 21, {}),
    entry('e1', 'stu000000000002', 'out', 18, { destination: 'Restroom', minutes: 8 }),
    entry('e2', 'stu000000000002', 'in', 10, {}),
    entry('e7', 'stu000000000004', 'out', 6, { destination: 'Main office', minutes: 10 }),
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
async function stubKioskBackend(
  page: Page,
  options: {
    limit?: number; log?: Event[]; activeClass?: string;
    activeClassOf?: () => string;
    destinations?: () => { label: string; minutes: number }[];
  } = {},
) {
  const limit = options.limit ?? 2;
  const log = options.log ?? sampleLog();
  const activeClassOf = options.activeClassOf ?? (() => options.activeClass ?? periodOne);
  const currentDestinations = options.destinations ?? (() => sampleDestinations);

  await page.route('**/api/hallway/kiosk/events', async (route) => {
    const body = route.request().postDataJSON() as { student: string; kind: 'out' | 'in'; destination: string; cancel?: boolean };
    // The expected minutes are the teacher's setting, looked up here exactly as
    // the real route does, rather than anything the browser gets to claim.
    const minutes = currentDestinations().find((item) => item.label === body.destination)?.minutes ?? 0;
    const student = roster.find((item) => item.id === body.student && item.class === activeClassOf());
    if (!student) {
      await route.fulfill({ status: 400, json: { message: 'We could not find that student ID. Please try again.' } });
      return;
    }
    const latest: Record<string, string> = {};
    for (const event of log) latest[event.student] = event.kind;
    const outNow = Object.values(latest).filter((kind) => kind === 'out').length;
    if (body.kind === 'out' && outNow >= limit) {
      await route.fulfill({ json: { status: 'denied', name: shown(student), out: outNow, limit } });
      return;
    }
    const at = minutesAgo(0);
    // An undo is a new entry saying the trip was cancelled, never a deletion.
    const source = body.kind === 'in' && body.cancel ? 'cancelled' : 'kiosk';
    log.push({ id: `new${log.length}`, student: student.id, studentName: shown(student), kind: body.kind, destination: body.destination, minutes, source, signedInBy: '', at, class: activeClassOf() });
    await route.fulfill({
      json: {
        status: body.kind === 'out' ? 'approved' : body.cancel ? 'cancelled' : 'returned',
        name: shown(student), destination: body.destination, minutes, outAt: at,
        out: body.kind === 'out' ? outNow + 1 : outNow - 1, limit,
      },
    });
  });
}

/** One student's tile on the door screen. */
function tile(page: Page, name: string) {
  return page.locator('.name-tile', { hasText: name });
}

/** The two taps: your name, then where you are going. */
async function signOut(page: Page, name: string, destination: string) {
  await tile(page, name).click();
  await page.getByRole('button', { name: destination, exact: true }).click();
}

async function openKiosk(page: Page, options: { limit?: number; log?: Event[] } = {}) {
  await openTeacher(page, options);
  await page.getByRole('button', { name: 'Enter kiosk mode' }).first().click();
  await expect(tile(page, 'Avery B.')).toBeVisible();
}

async function stubTeacherBackend(
  page: Page,
  log = sampleLog(),
  options: { classes?: typeof sampleClasses; activeClass?: string; limit?: number } = {},
) {
  const classes = options.classes ? [...options.classes] : [...sampleClasses];
  let activeClass = options.activeClass ?? periodOne;
  let destinations = sampleDestinations.map((item) => ({ ...item }));

  await page.route('**/api/collections/classes/records*', async (route) => {
    if (route.request().method() === 'POST') {
      const created = { id: `cls00000000000${classes.length + 1}`, teacher: teacherId, archived: false, ...(route.request().postDataJSON() as object) };
      classes.push(created as (typeof sampleClasses)[number]);
      await route.fulfill({ json: created });
      return;
    }
    await route.fulfill({ json: list(classes.filter((item) => !item.archived)) });
  });

  // A separate route because Playwright's "*" does not cross a "/", so the
  // listing pattern above never sees a request aimed at one record.
  await page.route('**/api/collections/classes/records/*', async (route) => {
    const id = route.request().url().split('/').pop()!.split('?')[0];
    const target = classes.find((item) => item.id === id);
    if (!target) {
      await route.fulfill({ status: 404, json: { message: 'No such class.' } });
      return;
    }
    Object.assign(target, route.request().postDataJSON() as object);
    await route.fulfill({ json: target });
  });

  await page.route('**/api/collections/teachers/auth-with-password', async (route) => {
    await route.fulfill({ json: { token: fakeToken, record: { id: teacherId, collectionId: 'teachers', collectionName: 'teachers', verified: true, displayName: 'Ms. Rivera', passLimit: 2, activeClass, destinations: sampleDestinations } } });
  });
  const students = roster.map((student) => ({
    id: student.id, teacher: teacherId,
    class: student.class, firstName: student.firstName, lastPrefix: student.lastPrefix, status: 'current',
  }));
  let issued = 0;

  await page.route('**/api/collections/students/records*', async (route) => {
    if (route.request().method() === 'POST') {
      issued += 1;
      const created = { id: `recnew${issued}`, teacher: teacherId, status: 'current', ...(route.request().postDataJSON() as object) };
      students.push(created as (typeof students)[number]);
      await route.fulfill({ json: created });
      return;
    }
    const url = decodeURIComponent(route.request().url());
    const wanted = url.includes(periodTwo) ? periodTwo : periodOne;
    await route.fulfill({ json: list(students.filter((student) => student.class === wanted)) });
  });

  await page.route('**/api/collections/students/records/*', async (route) => {
    const id = route.request().url().split('/').pop()!.split('?')[0];
    const index = students.findIndex((student) => student.id === id);
    if (index < 0) {
      await route.fulfill({ status: 404, json: { message: 'No such student.' } });
      return;
    }
    if (route.request().method() === 'DELETE') {
      students.splice(index, 1);
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    Object.assign(students[index], route.request().postDataJSON() as object);
    await route.fulfill({ json: students[index] });
  });
  await page.route('**/api/collections/pass_events/records*', async (route) => {
    if (route.request().method() === 'POST') {
      const created = { id: `t${log.length}`, ...(route.request().postDataJSON() as object), at: minutesAgo(0) } as Event;
      log.push(created);
      await route.fulfill({ json: created });
      return;
    }
    const url = decodeURIComponent(route.request().url());
    const wanted = url.includes(periodTwo) ? periodTwo : periodOne;
    await route.fulfill({ json: list(log.filter((event) => event.class === wanted)) });
  });
  await page.route('**/api/collections/teachers/records/*', async (route) => {
    if (route.request().method() === 'PATCH') {
      const patch = route.request().postDataJSON() as { activeClass?: string; destinations?: typeof destinations };
      if (patch.activeClass) activeClass = patch.activeClass;
      if (patch.destinations) destinations = patch.destinations;
    }
    await route.fulfill({ json: { id: teacherId, collectionName: 'teachers', displayName: 'Ms. Rivera', passLimit: 3, activeClass, destinations } });
  });
  await page.route('**/api/hallway/kiosk/pin/status', async (route) => await route.fulfill({ json: { hasPin: true } }));
  await page.route('**/api/hallway/kiosk/pin/verify', async (route) => {
    const { pin } = route.request().postDataJSON() as { pin: string };
    await route.fulfill(pin === '123456' ? { json: {} } : { status: 400, json: { message: 'That PIN is incorrect.' } });
  });
  await page.route('**/api/hallway/kiosk/pin', async (route) => await route.fulfill({ json: {} }));

  await page.route('**/api/hallway/passes/correct', async (route) => {
    const fix = route.request().postDataJSON() as { event: string; student: string; at: string };
    const target = log.find((event) => event.id === fix.event)!;
    const student = roster.find((item) => item.id === fix.student);
    // A correction is a new entry. Nothing in the log is edited or removed.
    log.push({
      id: `fix${log.length}`, student: target.student, studentName: student ? shown(student) : target.studentName,
      kind: 'fix', destination: '', minutes: 0, source: 'teacher', signedInBy: 'Ms. Rivera',
      class: target.class, at: minutesAgo(0), corrects: fix.event,
      ...(fix.student ? { newStudent: fix.student } : {}),
      ...(fix.at ? { newAt: fix.at } : {}),
    });
    await route.fulfill({ json: { id: `fix${log.length}` } });
  });

  await page.route('**/api/hallway/class/switch', async (route) => {
    const wanted = (route.request().postDataJSON() as { class: string }).class;
    const latest: Record<string, string> = {};
    const names: Record<string, string> = {};
    for (const event of log) {
      if (event.class !== activeClass) continue;
      latest[event.student] = event.kind;
      names[event.student] = event.studentName;
    }
    const closed: string[] = [];
    for (const student of Object.keys(latest)) {
      if (latest[student] !== 'out') continue;
      closed.push(names[student]);
      log.push({
        id: `switch${log.length}`, student, studentName: names[student], kind: 'in',
        destination: '', minutes: 0, source: 'switch', signedInBy: '', class: activeClass, at: minutesAgo(0),
      });
    }
    activeClass = wanted;
    await route.fulfill({ json: { class: wanted, closed } });
  });

  await stubKioskBackend(page, { ...options, log, activeClassOf: () => activeClass, destinations: () => destinations });
}

async function openTeacher(page: Page, options: { limit?: number; log?: Event[] } = {}) {
  await stubTeacherBackend(page, options.log, options);
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
  await expect(tile(page, 'Avery B.')).toBeVisible();
});

test('the kiosk never asks the database for the pass log', async ({ page }) => {
  // The door screen greets students by name and says who is out, so it does
  // read its own roster and its own Class's log -- see docs/adr/0003. What it
  // must never do is reach any further than that, and nothing it sends may
  // change a record: the only write is through the kiosk route.
  await openKiosk(page);
  const reads: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/collections/')) reads.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  await signOut(page, 'Avery B.', 'Water');
  await expect(page.getByRole('status')).toHaveClass(/approved/);

  const allowed = ['/api/collections/students/records', '/api/collections/pass_events/records', '/api/collections/classes/records'];
  for (const read of reads) {
    const [method, path] = read.split(' ');
    expect(method, `kiosk mode may only read, but sent ${read}`).toBe('GET');
    expect(allowed, `kiosk mode reached ${path}`).toContain(path);
  }
});

test('kiosk is visually subdued and approval remains high contrast', async ({ page }) => {
  await openKiosk(page);
  await expect(page.locator('.app-shell.kiosk')).toBeVisible();
  await expect(page.locator('.app-shell.kiosk')).toHaveCSS('background-color', 'rgb(16, 24, 20)');
  await signOut(page, 'Avery B.', 'Water');
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

test('a roster name is shown as text, never as markup', async ({ page }) => {
  await openRoster(page);
  await page.getByLabel('Paste your class list').fill('<script src="//evil.invalid"></script> Zed');
  await page.getByRole('button', { name: 'Preview import' }).click();
  await expect(page.locator('script[src="//evil.invalid"]')).toHaveCount(0);
});

test('student selects a destination and receives a distance-readable approval', async ({ page }) => {
  await openKiosk(page);
  await tile(page, 'Avery B.').click();
  // Two taps and no typing: the student is never asked how long they will be.
  await expect(page.getByLabel(/How long/)).toBeHidden();
  await page.getByRole('button', { name: 'Water', exact: true }).click();
  const notice = page.getByRole('status');
  await expect(notice).toHaveClass(/approved/);
  await expect(notice.getByRole('heading')).toHaveText('Avery B.');
  await expect(notice).toContainText('Water');
  await expect(notice).toContainText('Back by');
});

test('the server refuses a pass over the limit and the kiosk explains without naming anyone', async ({ page }) => {
  await openKiosk(page);
  await signOut(page, 'Avery B.', 'Water');
  await expect(page.getByRole('status')).toHaveClass(/approved/);
  await page.waitForTimeout(6200);
  await signOut(page, 'Sofia R.', 'Water');
  const notice = page.getByRole('status');
  await expect(notice).toHaveClass(/denied/);
  await expect(notice).toContainText('hallway limit has been reached');
  await expect(notice).toContainText('2 of 2 students are out right now');
  await expect(notice).not.toContainText('Noah W.');
  await expect(notice).not.toContainText('Avery B.');
});

test('a student who is out is marked so, and comes back in one tap', async ({ page }) => {
  await openKiosk(page);
  // Noah is in the hallway. The tile says where he went and, deliberately, not
  // for how long.
  await expect(tile(page, 'Noah W.')).toContainText('Out — Main office');
  await expect(tile(page, 'Noah W.')).not.toContainText('min');
  await tile(page, 'Noah W.').click();
  await expect(page.getByRole('status')).toContainText('WELCOME BACK');
  await expect(page.getByRole('status').getByRole('heading')).toHaveText('Noah W.');
});

test('teacher workspace exposes limits, analytics, and third-party check-in markers', async ({ page }) => {
  await openTeacher(page);
  await page.getByLabel('Maximum out at once').selectOption('3');
  await page.getByRole('button', { name: 'Analytics' }).click();
  await expect(page.getByRole('heading', { name: 'Hall pass analytics' })).toBeVisible();
  await expect(page.getByText('Signed in by Ms. Rivera')).toBeVisible();
  // Exporting is covered by its own tests now that it produces a real file.
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

test('a teacher can create, rename and archive a Class', async ({ page }) => {
  await openTeacher(page);
  await page.getByRole('button', { name: 'Classes' }).click();
  await expect(page.getByRole('heading', { name: 'Period 1' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Period 2' })).toBeVisible();

  await page.getByLabel('Name of the new class').fill('Period 5');
  await page.getByRole('button', { name: 'Add class' }).click();
  await expect(page.getByRole('heading', { name: 'Period 5' })).toBeVisible();

  await page.getByRole('button', { name: 'Rename Period 5' }).click();
  await page.getByLabel('Class name').fill('AP Bio B');
  await page.getByRole('button', { name: 'Save class name' }).click();
  await expect(page.getByRole('heading', { name: 'AP Bio B' })).toBeVisible();

  await page.getByRole('button', { name: 'Archive AP Bio B' }).click();
  await expect(page.getByRole('heading', { name: 'AP Bio B' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Period 1' })).toBeVisible();
});

test('exactly one Class is marked as the one the door screen is showing', async ({ page }) => {
  await openTeacher(page);
  await page.getByRole('button', { name: 'Classes' }).click();
  await expect(page.getByText('Showing on the door screen')).toHaveCount(1);
});

test('the kiosk offers only students in the Active Class', async ({ page }) => {
  await openKiosk(page);
  // Riley O. is on the Period 2 roster; the door screen is showing Period 1.
  await expect(tile(page, 'Riley O.')).toHaveCount(0);
  await expect(tile(page, 'Avery B.')).toBeVisible();
});

async function openRoster(page: Page, className = 'Period 1') {
  await openTeacher(page);
  await page.getByRole('button', { name: 'Classes' }).click();
  await page.getByRole('button', { name: `Roster for ${className}` }).click();
  await expect(page.getByRole('heading', { name: className, level: 1 })).toBeVisible();
}

test('pasted names are shortened, and two Mayas are told apart automatically', async ({ page }) => {
  await openRoster(page);
  await page.getByLabel('Paste your class list').fill('Maya Chen\nMaya Chavez');
  await page.getByRole('button', { name: 'Preview import' }).click();
  // One letter is not enough to separate Chen from Chavez, so both grow to three.
  await expect(page.getByText('Maya Che.')).toBeVisible();
  await expect(page.getByText('Maya Cha.')).toBeVisible();
  await page.getByRole('button', { name: 'Save roster' }).click();
  await expect(page.getByRole('heading', { name: 'Maya Cha.' })).toBeVisible();
});

test('an import that cannot separate two students is refused and saves nothing', async ({ page }) => {
  await openRoster(page);
  await page.getByLabel('Paste your class list').fill('Priya Chenoweth\nPriya Chennai');
  await page.getByRole('button', { name: 'Preview import' }).click();
  await expect(page.getByRole('alert')).toContainText('Priya Che.');
  await expect(page.getByRole('alert')).toContainText('nickname');
  // Refusing means refusing everything: no half-saved roster.
  await expect(page.getByRole('button', { name: 'Save roster' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Priya Che.' })).toBeHidden();
});

test('a roster paste is understood however the school system exported it', async ({ page }) => {
  await openRoster(page, 'Period 2');
  await page.getByLabel('Paste your class list').fill('First,Last\nHana Suzuki\nOkonkwo, Chidi\nTomas,K\n\n');
  await page.getByRole('button', { name: 'Preview import' }).click();
  await expect(page.getByText('Hana S.')).toBeVisible();
  await expect(page.getByText('Chidi O.')).toBeVisible();
  await expect(page.getByText('Tomas K.')).toBeVisible();
  // The heading row and the blank line are not students.
  await expect(page.getByText('First F.')).toBeHidden();
});

test('re-importing merges, and names that have gone are offered rather than removed', async ({ page }) => {
  await openRoster(page);
  await page.getByLabel('Paste your class list').fill('Maya Chen');
  await page.getByRole('button', { name: 'Preview import' }).click();
  await expect(page.getByText('NO LONGER ON YOUR LIST')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Remove Jordan E.' })).toBeVisible();
  // Left unticked, so nobody is removed by simply pasting a shorter list.
  await page.getByRole('button', { name: 'Save roster' }).click();
  await expect(page.getByRole('heading', { name: 'Jordan E.' })).toBeVisible();
});

test('a student who leaves keeps their history instead of being deleted', async ({ page }) => {
  await openRoster(page);
  await page.getByRole('button', { name: 'Remove Sofia R.' }).click();
  await expect(page.getByText('NO LONGER IN THIS CLASS')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sofia R.' })).toBeVisible();
  await expect(page.getByText('History kept')).toBeVisible();
});

test('the kiosk offers exactly the destinations the teacher set', async ({ page }) => {
  await openTeacher(page);
  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByLabel('Name of the new destination').fill('Nurse');
  await page.getByLabel('Expected minutes', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Add destination' }).click();
  await expect(page.getByRole('heading', { name: 'Nurse' })).toBeVisible();

  await page.getByRole('button', { name: 'Remove Counselor' }).click();
  await expect(page.getByRole('heading', { name: 'Counselor' })).toBeHidden();

  await page.getByRole('button', { name: 'Enter kiosk mode' }).first().click();
  await tile(page, 'Avery B.').click();
  await expect(page.getByRole('button', { name: 'Nurse', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Counselor', exact: true })).toBeHidden();
});

test('a destination carries its own expected minutes to the confirmation', async ({ page }) => {
  await openTeacher(page);
  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByLabel('Minutes for Water').fill('3');
  await page.getByLabel('Minutes for Water').blur();
  await page.getByRole('button', { name: 'Enter kiosk mode' }).first().click();
  await signOut(page, 'Avery B.', 'Water');
  // Three minutes from now, because that is what the teacher just set for Water.
  await expect(page.getByRole('status')).toContainText('Back by');
});

test('the destination breakdown comes from real trips, not a fixed list', async ({ page }) => {
  await openTeacher(page);
  await page.getByRole('button', { name: 'Analytics' }).click();
  const breakdown = page.locator('.destinations');
  // The sample log has one trip each to Counselor, Water, Restroom and Main office.
  await expect(breakdown).toContainText('Restroom');
  await expect(breakdown).toContainText('25%');
  // The old hardcoded shares are gone.
  await expect(breakdown).not.toContainText('42%');
});

/** A log with one student well past their expected time, and one comfortably inside it. */
function overdueLog(): Event[] {
  const base = { destination: '', minutes: 0, source: 'kiosk', signedInBy: '', class: periodOne };
  return [
    { ...base, id: 'o1', student: 'stu000000000001', studentName: 'Maya C.', kind: 'out', destination: 'Restroom', minutes: 8, at: minutesAgo(20) },
    { ...base, id: 'o2', student: 'stu000000000002', studentName: 'Jordan E.', kind: 'out', destination: 'Counselor', minutes: 20, at: minutesAgo(4) },
  ];
}

test('a student past their expected time is flagged overdue on the dashboard', async ({ page }) => {
  await openTeacher(page, { log: overdueLog(), limit: 5 });
  const cards = page.locator('.student-cards');
  await expect(cards).toContainText('Maya C.');
  await expect(cards.locator('article', { hasText: 'Maya C.' })).toContainText('Overdue');
  // Jordan is four minutes into a twenty minute trip; nothing is wrong yet.
  await expect(cards.locator('article', { hasText: 'Jordan E.' })).not.toContainText('Overdue');
});

test('a finished pass that ran over keeps its overdue flag in history', async ({ page }) => {
  await openTeacher(page);
  await page.getByRole('button', { name: 'Analytics' }).click();
  // Sofia was out eighteen minutes on a trip the teacher expected to take fifteen.
  const row = page.locator('tr', { hasText: 'Sofia R.' });
  await expect(row).toContainText('Overdue');
  // Jordan's eight minute restroom trip took eight minutes.
  await expect(page.locator('tr', { hasText: 'Jordan E.' })).not.toContainText('Overdue');
});

test('the door screen never shows a clock or an overdue flag against a student', async ({ page }) => {
  await openKiosk(page, { log: overdueLog(), limit: 5 });
  const kiosk = page.locator('.app-shell.kiosk');
  // Maya is twelve minutes past her expected time. The teacher's dashboard says
  // so in as many words; the screen at the front of the room says only where
  // she went. See docs/adr/0003.
  await expect(tile(page, 'Maya C.')).toContainText('Out — Restroom');
  await expect(kiosk).not.toContainText('Overdue');
  await expect(kiosk).not.toContainText('min');
});

test('a mis-tap can be undone at the door, by adding to the log rather than erasing', async ({ page }) => {
  await openKiosk(page);
  await signOut(page, 'Avery B.', 'Water');
  await expect(page.getByRole('status')).toHaveClass(/approved/);
  await page.getByRole('button', { name: "That's not me" }).click();
  await expect(page.getByRole('status')).toContainText('cancelled');
  // Avery is back in class rather than stranded holding a pass they cannot
  // sign back in from.
  await expect(tile(page, 'Avery B.')).toContainText('In class');
});

test('browsing a class in the dashboard leaves the door screen where it was', async ({ page }) => {
  await openTeacher(page);
  await expect(page.getByRole('button', { name: 'Showing on the door screen' })).toBeVisible();
  await page.getByLabel('Class', { exact: true }).selectOption(periodTwo);
  await expect(page.getByRole('button', { name: 'Show this class on the door' })).toBeEnabled();
  // Looking at Period 2's records must not change what Period 2's predecessors see.
  await page.getByRole('button', { name: 'Enter kiosk mode' }).first().click();
  await expect(tile(page, 'Avery B.')).toBeVisible();
  await expect(tile(page, 'Riley O.')).toHaveCount(0);
});

test('moving the door screen warns and names the students still out', async ({ page }) => {
  await openTeacher(page);
  await page.getByLabel('Class', { exact: true }).selectOption(periodTwo);
  await page.getByRole('button', { name: 'Show this class on the door' }).click();
  await page.getByRole('button', { name: 'Show Period 2' }).click();
  // Noah is in the hallway on a Period 1 pass. He is named, not counted.
  const warning = page.getByRole('alert');
  await expect(warning).toContainText('Noah W.');
  await expect(warning).toContainText('will not be recorded');

  await page.getByRole('button', { name: 'Change class anyway' }).click();
  await expect(page.getByRole('button', { name: 'Showing on the door screen' })).toBeVisible();
});

test('a class switch closes open passes without inventing a return time', async ({ page }) => {
  await openTeacher(page);
  await page.getByLabel('Class', { exact: true }).selectOption(periodTwo);
  await page.getByRole('button', { name: 'Show this class on the door' }).click();
  await page.getByRole('button', { name: 'Show Period 2' }).click();
  await page.getByRole('button', { name: 'Change class anyway' }).click();

  // Back on Period 1: Noah is no longer out, and his trip is marked as ended by
  // the class change rather than by him walking back in.
  await page.getByLabel('Class', { exact: true }).selectOption(periodOne);
  await expect(page.locator('.student-cards')).toContainText('Everyone is back in class');
});

test('changing class at the door needs the teacher PIN', async ({ page }) => {
  await openKiosk(page);
  await page.getByRole('button', { name: 'Switch class' }).click();
  await expect(page.getByRole('heading', { name: 'Enter your PIN to change class' })).toBeVisible();
  await page.getByLabel('Six-digit PIN').fill('000000');
  await page.getByRole('button', { name: 'Choose a class' }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect');

  await page.getByLabel('Six-digit PIN').fill('123456');
  await page.getByRole('button', { name: 'Choose a class' }).click();
  await page.getByRole('button', { name: 'Show Period 2' }).click();
  await page.getByRole('button', { name: 'Change class anyway' }).click();
  await expect(tile(page, 'Riley O.')).toBeVisible();
});

test('a trip can be given to the student it really belonged to, without erasing anything', async ({ page }) => {
  await openTeacher(page);
  await page.getByRole('button', { name: 'Analytics' }).click();
  // Sofia's counsellor trip was really Jordan's.
  await page.getByRole('button', { name: 'Correct Sofia R.' }).click();
  await page.getByLabel('This trip really belonged to').selectOption({ label: 'Jordan E.' });
  await page.getByRole('button', { name: 'Save correction' }).click();

  const row = page.locator('tr', { hasText: 'Counselor' });
  await expect(row).toContainText('Jordan E.');
  await expect(row).toContainText('Corrected');
});

test('every correction is reviewable over a date range', async ({ page }) => {
  await openTeacher(page);
  await page.getByRole('button', { name: 'Analytics' }).click();
  await page.getByRole('button', { name: 'Correct Sofia R.' }).click();
  await page.getByLabel('This trip really belonged to').selectOption({ label: 'Jordan E.' });
  await page.getByRole('button', { name: 'Save correction' }).click();

  await page.getByRole('button', { name: 'Show corrections' }).click();
  const review = page.locator('section', { hasText: 'WHAT HAS BEEN CHANGED' });
  await expect(review).toContainText('Jordan E.');
  await expect(review).toContainText('reassigned');
  await expect(review).toContainText('Ms. Rivera');
});

test('a trip ended by a class change is excluded rather than given a made-up duration', async ({ page }) => {
  await openTeacher(page);
  await page.getByLabel('Class', { exact: true }).selectOption(periodTwo);
  await page.getByRole('button', { name: 'Show this class on the door' }).click();
  await page.getByRole('button', { name: 'Show Period 2' }).click();
  await page.getByRole('button', { name: 'Change class anyway' }).click();

  await page.getByLabel('Class', { exact: true }).selectOption(periodOne);
  await page.getByRole('button', { name: 'Analytics' }).click();
  const row = page.locator('tr', { hasText: 'Main office' });
  await expect(row).toContainText('Ended by class change');
  await expect(row).toContainText('return time unknown');
  await expect(row).not.toContainText('Overdue');
});

test('the teacher downloads a real spreadsheet, not a mock one', async ({ page }) => {
  await openTeacher(page);
  await page.getByRole('button', { name: 'Analytics' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^hallway-period-1-\d{4}-\d{2}-\d{2}\.csv$/);

  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const csv = Buffer.concat(chunks).toString('utf8');

  expect(csv.split('\n')[0]).toBe('Date,Student,Destination,Left,Returned,Minutes out,Expected,Overdue,Ended by,Corrected');
  expect(csv).toContain('Sofia R.');
  expect(csv).toContain('Counselor');
  // Sofia was out eighteen minutes against an expected fifteen.
  expect(csv).toMatch(/Sofia R\.,Counselor,[^,]*,[^,]*,18,15,yes/);
  // The old prop is gone.
  await expect(page.getByText('DEMO GOOGLE WORKSPACE')).toBeHidden();
});

test('the CSV reflects corrections rather than the original reading', async ({ page }) => {
  await openTeacher(page);
  await page.getByRole('button', { name: 'Analytics' }).click();
  await page.getByRole('button', { name: 'Correct Sofia R.' }).click();
  await page.getByLabel('This trip really belonged to').selectOption({ label: 'Jordan E.' });
  await page.getByRole('button', { name: 'Save correction' }).click();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const csv = Buffer.concat(chunks).toString('utf8');

  // The counsellor trip now belongs to Jordan, and is marked as corrected.
  expect(csv).toMatch(/Jordan E\.,Counselor,.*,yes\s*$/m);
  expect(csv).not.toMatch(/Sofia R\.,Counselor/);
});

test('the weekly chart says when there is not enough history rather than drawing one', async ({ page }) => {
  await openTeacher(page, { log: [] });
  await page.getByRole('button', { name: 'Analytics' }).click();
  await expect(page.getByText('Not enough history yet')).toBeVisible();
  await expect(page.locator('.bar-chart')).toHaveCount(0);
  // And no invented total.
  await expect(page.locator('.chart-card')).toContainText('0 total');
});
