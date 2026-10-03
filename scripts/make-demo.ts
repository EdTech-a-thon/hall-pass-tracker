// Writes demo/happy-hallways-demo.json: a backup to restore from Settings, full
// of classes and five weeks of passes, so every chart and table has something
// to show. Dates count back from today, so run `bun run demo` again before a
// demo to keep "today" and "this week" filled in.
//
// Period 2 English is the teacher.dev team (https://teacher.dev, "Our Team").
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { assignPrefixes, displayName } from '../src/lib/roster';
import type { Account, Class, Destination, EndedBy, Pass, Student } from '../src/lib/types';

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

const destinations: Destination[] = [
  { id: randomUUID(), label: 'Bathroom', minutes: 5, color: 'blue', icon: 'toilet' },
  { id: randomUUID(), label: 'Water', minutes: 3, color: 'teal', icon: 'droplet' },
  { id: randomUUID(), label: 'Nurse', minutes: 15, color: 'pink', icon: 'stethoscope' },
  { id: randomUUID(), label: 'Office', minutes: 10, color: 'orange', icon: 'building' },
  { id: randomUUID(), label: 'Library', minutes: 10, color: 'purple', icon: 'library' },
  { id: randomUUID(), label: 'Counselor', minutes: null, color: 'green', icon: 'heart-handshake' },
];
const destinationOdds = [55, 18, 7, 8, 8, 4].map((weight, i) => ({ value: destinations[i], weight }));

type Roster = { name: string; periodStart: string; periodEnd: string; noPassTimes: Class['noPassTimes']; names: string[] };
const rosters: Roster[] = [
  {
    name: 'Period 1 · Algebra',
    periodStart: '08:00',
    periodEnd: '08:50',
    noPassTimes: [{ start: '08:00', end: '08:10' }],
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
    noPassTimes: [],
    names: [
      'Elliot Roe', 'Duncan Johnson', 'Josh Pullen', 'Jessika Golab', 'Sam Barans', 'Sam Brooks', 'Amara Okafor',
      'Theo Bailey', 'Grace Liu', 'Miles Turner', 'Hazel Kowalski', 'Ezra Cohen', 'Layla Haddad', 'Wyatt Reed',
      'Stella Park', 'Felix Romero', 'Aria Desai', 'Henry Walsh', 'Luna Castillo', 'Jack Sullivan', 'Mila Novak',
      'Isaac Grant', 'Violet Hayes', 'Dylan Foster',
    ],
  },
  {
    name: 'Period 4 · Biology',
    periodStart: '10:50',
    periodEnd: '11:40',
    noPassTimes: [{ start: '11:30', end: '11:40' }],
    names: [
      'Riley Park', 'Aaliyah Brown', 'Benjamin Clark', 'Camila Torres', 'Daniel Moore', 'Emily Davis', 'Finn Murphy',
      'Gianna Russo', 'Hudson Bell', 'Ivy Chen', 'Jonah Weiss', 'Kayla Jackson', 'Liam Walker', 'Madison Young',
      'Nathan Scott', 'Olivia Green', 'Parker Evans', 'Quinn Baker', 'Rosa Medina', 'Samuel Ward', 'Talia Stone',
      'Uriel Vega', 'Willow Ford',
    ],
  },
];

/** Some students go far more often than others, which is what the per-student table is for. */
const frequentFlyers = new Set(['Josh Pullen', 'Leo Martinez', 'Daniel Moore', 'Zoe Nguyen']);
/** Riley Park moved to another class two weeks ago, but keeps every trip. */
const leftClass = 'Riley Park';

const today = new Date();
const minutesOf = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
function at(day: Date, minuteOfDay: number) {
  const moment = new Date(day);
  moment.setHours(0, minuteOfDay, Math.floor(between(0, 20)), 0);
  return moment;
}

/**
 * School days, Monday to Friday, for the last five weeks, plus today even on a
 * weekend, so a demo always has something under "Passes today".
 */
const schoolDays: Date[] = [];
for (let back = 34; back >= 0; back--) {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
  if ((day.getDay() !== 0 && day.getDay() !== 6) || back === 0) schoolDays.push(day);
}
const twoWeeksAgo = new Date(today.getTime() - 14 * 86_400_000);

const classes: Class[] = [];
const passes: Pass[] = [];

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
  const cls: Class = {
    id: randomUUID(),
    name: roster.name,
    students: students.map(({ fullName, ...student }) => student),
    noPassTimes: roster.noPassTimes,
    createdAt: at(schoolDays[0], minutesOf('07:30')).toISOString(),
  };
  classes.push(cls);

  const start = minutesOf(roster.periodStart);
  const end = minutesOf(roster.periodEnd);
  const blocked = roster.noPassTimes.map((range) => [minutesOf(range.start), minutesOf(range.end)]);

  for (const day of schoolDays) {
    const present = students.filter((student) => student.status === 'current' || (student.fullName === leftClass && day < twoWeeksAgo));
    // Fridays run a little busier.
    const count = Math.round(between(2, 5) + (day.getDay() === 5 ? 1 : 0));
    let free = start;
    for (let n = 0; n < count; n++) {
      // One at a time: the Pass Limit is 1, so a trip starts after the last one ends.
      let leaveAt = Math.max(free + between(1, 8), start + between(0, 30));
      for (const [from, until] of blocked) if (leaveAt >= from && leaveAt < until) leaveAt = until + between(0, 4);
      if (leaveAt > end - 6) break;

      const student = pick(present.map((each) => ({ value: each, weight: frequentFlyers.has(each.fullName) ? 6 : 1 })));
      const destination = pick(destinationOdds);
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
      if (endedBy === 'switch') {
        endedBy = 'switch';
        length = Math.max(1, Math.round(end - leaveAt));
      }

      const outAt = at(day, leaveAt);
      const inAt = new Date(outAt.getTime() + length * 60_000 + Math.floor(between(0, 20)) * 1000);
      // Today only has what has already happened.
      if (inAt > today) break;
      const corrected = endedBy === 'student' && random() < 0.02;
      passes.push({
        id: randomUUID(),
        classId: cls.id,
        studentId: student.id,
        studentName: displayName(student),
        destination: destination.label,
        minutes: destination.minutes ?? 0,
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

const account: Account = {
  version: 1,
  laptopPeerId: `hallway-${randomUUID()}`,
  classes,
  destinations,
  passes: passes.sort((a, b) => a.outAt.localeCompare(b.outAt)),
  passLimit: 1,
  lineEnabled: true,
  line: [],
  pin: '1234',
  kiosk: null,
  activeClass: null,
  replacedKiosks: [],
  networkBlocked: false,
  lastExportedAt: today.toISOString(),
};

mkdirSync('demo', { recursive: true });
writeFileSync('demo/happy-hallways-demo.json', JSON.stringify({ app: 'hallway', ...account }, null, 2) + '\n');
console.log(`Wrote demo/happy-hallways-demo.json: ${classes.length} classes, ${passes.length} passes, PIN 1234`);
