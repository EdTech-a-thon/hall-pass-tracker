// Writes demo/happy-hallways-demo.json: a backup to restore from Settings, full
// of classes and five weeks of passes, so every chart and table has something
// to show. A whole school day is on the schedule, so whenever you record,
// Home has a class on (or is between two). Dates count back from today, so run
// `bun run demo` again before a demo to keep "today" and "this week" filled in.
// Every popup is marked seen, so nothing interrupts a recording.
//
// Period 2 English is the teacher.dev team (https://teacher.dev, "Our Team").
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { assignPrefixes, displayName } from '../src/lib/roster';
import { news, tips } from '../src/lib/popups';
import type { Account, Class, ClockRange, DeniedRequest, Destination, EndedBy, Pass, Period, Schedule, Student } from '../src/lib/types';

/** The same file every time for the same day, so a re-run doesn't reshuffle the story. */
let seed = 20261002;
function random() {
  seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
  return seed / 2 ** 31;
}
const between = (low: number, high: number) => low + random() * (high - low);
function pick<T>(items: { value: T; weight: number }[]): T {
  let roll = random() * items.reduce((sum, item) => sum + item.weight, 0);
  for (const item of items) if ((roll -= item.weight) < 0) return item.value;
  return items[items.length - 1].value;
}

/** Two bathrooms, each with its own limit and line; the Nurse and the Counselor don't use up the Pass Allowance. */
const destinations: Destination[] = [
  { id: randomUUID(), label: 'Left Hall Bathroom', minutes: 5, color: 'blue', icon: 'toilet', limit: 1 },
  { id: randomUUID(), label: 'Right Hall Bathroom', minutes: 5, color: 'teal', icon: 'toilet', limit: 1 },
  { id: randomUUID(), label: 'Water', minutes: 3, color: 'gray', icon: 'droplet', limit: 1 },
  { id: randomUUID(), label: 'Nurse', minutes: 15, color: 'pink', icon: 'stethoscope', limit: null, countsTowardAllowance: false },
  { id: randomUUID(), label: 'Office', minutes: 10, color: 'orange', icon: 'building', limit: null },
  { id: randomUUID(), label: 'Library', minutes: 10, color: 'purple', icon: 'library', limit: 2 },
  { id: randomUUID(), label: 'Counselor', minutes: null, color: 'green', icon: 'heart-handshake', limit: null, countsTowardAllowance: false },
];
const destinationOdds = [30, 26, 14, 7, 8, 10, 5].map((weight, i) => ({ value: destinations[i], weight }));

/** Each class's period on a regular day, and the minutes at its start and end when passes are closed. */
type Roster = { name: string; periodStart: string; periodEnd: string; noPass: { first: number; last: number }; names: string[] };
const rosters: Roster[] = [
  {
    name: 'Period 1 · Algebra',
    periodStart: '08:00',
    periodEnd: '08:50',
    noPass: { first: 10, last: 5 },
    names: [
      'Maya Chen', 'Maya Carter', 'Jordan Ellis', 'Priya Shah', 'Leo Martinez', 'Ava Thompson', 'Noah Kim',
      'Isabella Rossi', 'Ethan Brooks', 'Zoe Nguyen', 'Lucas Ortiz', 'Chloe Adams', 'Mateo Alvarez', 'Harper Lee',
      'Aiden Patel', 'Lily Morgan', 'Caleb Wright', 'Nora Fischer', 'Owen Hughes', 'Ella Ramirez', 'Gabriel Silva',
      'Ruby Collins', 'Jayden Price', 'Sofia Bennett',
    ],
  },
  {
    name: 'Period 2 · English',
    periodStart: '08:55',
    periodEnd: '09:45',
    noPass: { first: 10, last: 5 },
    names: [
      'Elliot Roe', 'Duncan Johnson', 'Josh Pullen', 'Jessika Golab', 'Sam Barans', 'Sam Brooks', 'Amara Okafor',
      'Theo Bailey', 'Grace Liu', 'Miles Turner', 'Hazel Kowalski', 'Ezra Cohen', 'Layla Haddad', 'Wyatt Reed',
      'Stella Park', 'Felix Romero', 'Aria Desai', 'Henry Walsh', 'Luna Castillo', 'Jack Sullivan', 'Mila Novak',
      'Isaac Grant', 'Violet Hayes', 'Dylan Foster',
    ],
  },
  {
    name: 'Period 3 · Chemistry',
    periodStart: '09:50',
    periodEnd: '10:40',
    noPass: { first: 10, last: 5 },
    names: [
      'Aditi Rao', 'Bennett Shaw', 'Carmen Diaz', 'Declan Burke', 'Esme Laurent', 'Frankie Moss', 'Gideon Hart',
      'Hana Suzuki', 'Idris Bello', 'June Whitaker', 'Kai Morales', 'Lena Petrova', 'Marcus Reid', 'Nadia Farah',
      'Oscar Lindqvist', 'Paige Donovan', 'Rafael Costa', 'Simone Archer', 'Tobias Kerr', 'Uma Iyer', 'Vince Delgado',
      'Wren Abbott',
    ],
  },
  {
    name: 'Period 4 · Biology',
    periodStart: '10:45',
    periodEnd: '11:35',
    noPass: { first: 10, last: 10 },
    names: [
      'Riley Park', 'Aaliyah Brown', 'Benjamin Clark', 'Camila Torres', 'Daniel Moore', 'Emily Davis', 'Finn Murphy',
      'Gianna Russo', 'Hudson Bell', 'Ivy Chen', 'Jonah Weiss', 'Kayla Jackson', 'Liam Walker', 'Madison Young',
      'Nathan Scott', 'Olivia Green', 'Parker Evans', 'Quinn Baker', 'Rosa Medina', 'Samuel Ward', 'Talia Stone',
      'Uriel Vega', 'Willow Ford',
    ],
  },
  {
    name: 'Period 5 · World History',
    periodStart: '12:15',
    periodEnd: '13:05',
    noPass: { first: 10, last: 5 },
    names: [
      'Abigail Fox', 'Bryce Holland', 'Cora Jennings', 'Dante Rivera', 'Eliza Monroe', 'Gavin Pierce', 'Hailey Sato',
      'Ian McAllister', 'Jade Okoro', 'Kieran Doyle', 'Lucia Ferreira', 'Malik Hassan', 'Naomi Brandt', 'Omar Siddiqui',
      'Phoebe Lang', 'Reid Calloway', 'Sienna Marsh', 'Tristan Boyd', 'Vera Klein', 'Xavier Bloom', 'Yara Mansour',
      'Zane Whitfield', 'Clara Voss', 'Emmett Rhodes',
    ],
  },
  {
    name: 'Period 6 · Art',
    periodStart: '13:10',
    periodEnd: '14:00',
    noPass: { first: 5, last: 5 },
    names: [
      'Adele Grimes', 'Bodhi Lennox', 'Celeste Ward', 'Dex Navarro', 'Elodie Frost', 'Gus Abernathy', 'Holly Quinn',
      'Iris Delacroix', 'Jasper Lowell', 'Kenji Mori', 'Margo Ellison', 'Nico Ferraro', 'Opal Henley', 'Rory Kincaid',
      'Saoirse Byrne', 'Tate Holloway', 'Vivian Cho', 'Wes Galloway', 'Zara Kapoor', 'Arlo Pemberton',
    ],
  },
];

/** Some students go far more often than others, which is what the roster's numbers and History are for. */
const frequentFlyers = new Set(['Josh Pullen', 'Leo Martinez', 'Daniel Moore', 'Zoe Nguyen', 'Kai Morales', 'Dante Rivera']);
/** Riley Park moved to another class two weeks ago, but keeps every trip. */
const leftClass = 'Riley Park';
/** The Pass Allowance in the demo: three passes a week. Past that, the teacher approved the request (or used the PIN). */
const allowance = 3;

const today = new Date();
const minutesOf = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
function at(day: Date, minuteOfDay: number) {
  const moment = new Date(day);
  moment.setHours(0, minuteOfDay, Math.floor(between(0, 20)), 0);
  return moment;
}
function mondayOf(day: Date) {
  const monday = new Date(day);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday.toDateString();
}

/**
 * School days, Monday to Friday, for the last five weeks, plus today even on a
 * weekend, so a demo always has something under "today".
 */
const schoolDays: Date[] = [];
for (let back = 34; back >= 0; back--) {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
  if ((day.getDay() !== 0 && day.getDay() !== 6) || back === 0) schoolDays.push(day);
}
const twoWeeksAgo = new Date(today.getTime() - 14 * 86_400_000);

const classes: Class[] = [];
const passes: Pass[] = [];
const deniedRequests: DeniedRequest[] = [];

for (const roster of rosters) {
  const parsed = roster.names.map((name) => {
    const [firstName, ...rest] = name.split(' ');
    return { firstName, lastName: rest.join(' ') };
  });
  const { entries } = assignPrefixes(parsed);
  const students: (Student & { fullName: string })[] = entries.map((entry, i) => ({
    id: randomUUID(),
    ...entry,
    status: roster.names[i] === leftClass ? 'former' : 'current',
    fullName: roster.names[i],
  }));
  // One student per class has an IEP or 504 plan, so the allowance never applies to them.
  students[3].exempt = true;
  const cls: Class = {
    id: randomUUID(),
    name: roster.name,
    students: students.map(({ fullName, ...student }) => student),
    createdAt: at(schoolDays[0], minutesOf('07:30')).toISOString(),
  };
  classes.push(cls);

  const start = minutesOf(roster.periodStart);
  const end = minutesOf(roster.periodEnd);
  const closed = [
    [start, start + roster.noPass.first],
    [end - roster.noPass.last, end],
  ];
  /** Passes each student has used this week, for the allowance. */
  const used = new Map<string, number>();
  let week = '';

  for (const day of schoolDays) {
    if (mondayOf(day) !== week) {
      week = mondayOf(day);
      used.clear();
    }
    const present = students.filter((student) => student.status === 'current' || (student.fullName === leftClass && day < twoWeeksAgo));
    // Fridays run a little busier.
    const count = Math.round(between(4, 7) + (day.getDay() === 5 ? 1 : 0));
    let free = start;
    for (let n = 0; n < count; n++) {
      let leaveAt = Math.max(free + between(1, 8), start + between(0, 30));
      // Now and then the teacher lets someone go during a no-pass time; otherwise they wait for it to end.
      const duringNoPass = closed.some(([from, until]) => leaveAt >= from && leaveAt < until);
      const letGo = duringNoPass && random() < 0.15;
      if (duringNoPass && !letGo) for (const [from, until] of closed) if (leaveAt >= from && leaveAt < until) leaveAt = until + between(0, 4);
      if (leaveAt > end - 6 && !letGo) break;
      if (leaveAt > end - 1) break;

      const student = pick(present.map((each) => ({ value: each, weight: frequentFlyers.has(each.fullName) ? 6 : 1 })));
      const destination = pick(destinationOdds);
      const counts = destination.countsTowardAllowance !== false && !student.exempt;
      const usedUp = counts && (used.get(student.id) ?? 0) >= allowance;

      // Asking past the allowance: usually approved, sometimes not.
      if ((usedUp || letGo) && random() < 0.3) {
        const askedAt = at(day, leaveAt);
        if (askedAt > today) break;
        deniedRequests.push({
          id: randomUUID(),
          classId: cls.id,
          studentId: student.id,
          studentName: displayName(student),
          destination: destination.label,
          blocks: [...(usedUp ? ['allowance' as const] : []), ...(letGo ? ['no-pass' as const] : [])],
          askedAt: askedAt.toISOString(),
          deniedAt: new Date(askedAt.getTime() + between(20, 90) * 1000).toISOString(),
        });
        free = leaveAt + 2;
        continue;
      }

      const expected = destination.minutes ?? 12;
      const overdue = random() < 0.13;
      let length = Math.max(1, Math.round(expected * (overdue ? between(1.3, 2.4) : between(0.4, 0.85))));

      let endedBy: EndedBy = pick([
        { value: 'student' as const, weight: 86 },
        { value: 'teacher' as const, weight: 9 },
        { value: 'switch' as const, weight: 3 },
        { value: 'cancelled' as const, weight: 2 },
      ]);
      if (endedBy === 'cancelled') length = 1;
      if (leaveAt + length > end) length = Math.max(1, Math.round(end - leaveAt - 1));
      if (endedBy === 'switch') length = Math.max(1, Math.round(end - leaveAt));

      const outAt = at(day, leaveAt);
      const inAt = new Date(outAt.getTime() + length * 60_000 + Math.floor(between(0, 20)) * 1000);
      // Today only has what has already happened.
      if (inAt > today) break;
      const corrected = endedBy === 'student' && random() < 0.02;
      const approved = usedUp || letGo;
      if (counts && endedBy !== 'cancelled') used.set(student.id, (used.get(student.id) ?? 0) + 1);
      passes.push({
        id: randomUUID(),
        classId: cls.id,
        studentId: student.id,
        studentName: displayName(student),
        destination: destination.label,
        minutes: destination.minutes ?? 0,
        ...(destination.countsTowardAllowance === false ? { counts: false } : {}),
        ...(usedUp ? { extra: true } : {}),
        ...(letGo ? { noPassException: true } : {}),
        ...(approved ? { approvedBy: random() < 0.75 ? ('home' as const) : ('pin' as const) } : {}),
        outAt: outAt.toISOString(),
        inAt: inAt.toISOString(),
        ...(endedBy === 'student' ? {} : { endedBy }),
        ...(corrected ? { corrected } : {}),
        updatedAt: inAt.toISOString(),
      });
      free = leaveAt + length;
    }
  }
}

function clock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** A full regular day: six classes, lunch, and a planning period, each class with its no-pass minutes. */
const regular: Schedule = {
  id: randomUUID(),
  name: 'Regular Day',
  periods: [
    ...rosters.map(
      (roster, i): Period => ({ id: randomUUID(), classId: classes[i].id, start: roster.periodStart, end: roster.periodEnd, noPass: roster.noPass }),
    ),
    { id: randomUUID(), classId: null, start: '11:40', end: '12:10' },
    { id: randomUUID(), classId: null, start: '14:05', end: '14:55' },
  ],
  rules: [],
  noPassTimes: [],
};
/** Early release: half-hour periods, back to back from 8:00, with the first five minutes closed. */
const shortened = (index: number): ClockRange => {
  const start = minutesOf('08:00') + index * 35;
  return { start: clock(start), end: clock(start + 30) };
};
const earlyRelease: Schedule = {
  id: randomUUID(),
  name: 'Early Release',
  periods: classes.map((cls, i) => ({ id: randomUUID(), classId: cls.id, ...shortened(i), noPass: { first: 5, last: 0 } })),
  rules: [],
  noPassTimes: [],
};
/** An assembly day: the regular periods, with no passes for anyone during the assembly. */
const assembly: Schedule = {
  ...structuredClone(regular),
  id: randomUUID(),
  name: 'Assembly Day',
  noPassTimes: [{ id: randomUUID(), start: '10:45', end: '11:15' }],
};
for (const period of assembly.periods) period.id = randomUUID();

const seenAt = today.toISOString();
const account: Account = {
  version: 1,
  laptopPeerId: `hallway-${randomUUID()}`,
  classes,
  destinations,
  passes: passes.sort((a, b) => a.outAt.localeCompare(b.outAt)),
  lineEnabled: true,
  line: [],
  passAllowance: { enabled: true, passes: allowance, per: 'week', whenUsedUp: 'stop', since: schoolDays[0].toISOString() },
  schedules: [regular, earlyRelease, assembly],
  currentScheduleId: regular.id,
  // On schedule: Home puts whichever class the clock says on the kiosk as soon as it opens.
  activeClass: { id: null, changedAt: new Date(today.getTime() - 60_000).toISOString(), onSchedule: true },
  manualNoPass: null,
  requests: [],
  deniedRequests: deniedRequests.sort((a, b) => a.askedAt.localeCompare(b.askedAt)),
  seenPopups: Object.fromEntries([...news, ...tips].map((popup) => [popup.id, seenAt])),
  pin: '1234',
  kiosk: null,
  replacedKiosks: [],
  networkBlocked: false,
  lastExportedAt: today.toISOString(),
};

mkdirSync('demo', { recursive: true });
writeFileSync('demo/happy-hallways-demo.json', JSON.stringify({ app: 'hallway', ...account }, null, 2) + '\n');
console.log(
  `Wrote demo/happy-hallways-demo.json: ${classes.length} classes, ${classes.reduce((sum, cls) => sum + cls.students.length, 0)} students, ` +
    `${passes.length} passes, ${deniedRequests.length} denied requests, ${account.schedules.length} schedules. Kiosk PIN 1234.`,
);
