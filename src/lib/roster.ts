import type { Student } from './types';

/** A name as it arrived from a paste, before any of it is thrown away. */
export type ParsedName = { firstName: string; lastName: string };

/** What an import would do, shown to the teacher before anything is saved. */
export type ImportPlan = {
  added: { firstName: string; lastPrefix: string }[];
  /** Students already on the roster. Their prefix may change to keep names apart. */
  matched: { student: Student; lastPrefix: string }[];
  /** On the roster, but not in the pasted list. The teacher decides. */
  missing: Student[];
  /** Set when two students cannot be told apart. Nothing is saved when this is set. */
  error: string;
};

/** The longest last-name prefix we will ever store. A privacy limit, not a technical one. */
export const maxPrefix = 3;

/** "Maya C." — the only form of a student's name this app keeps. */
export function displayName(student: { firstName: string; lastPrefix: string }) {
  return student.lastPrefix ? `${student.firstName} ${student.lastPrefix}.` : student.firstName;
}

/** A first line naming its columns rather than a student. */
function looksLikeHeading(line: string) {
  return /\b(first|last|surname|name|student|pupil)\b/i.test(line);
}

/**
 * Reads one line of a pasted roster. Teachers paste whatever their school's
 * system exported, so this accepts the shapes those systems actually produce
 * rather than asking the teacher which one is correct. Where a line is
 * genuinely ambiguous the preview is what saves us, not a cleverer rule.
 */
function readLine(line: string): ParsedName | null {
  const trimmed = line.trim().replace(/^["']|["']$/g, '');
  if (!trimmed) return null;

  const separator = trimmed.includes('\t') ? '\t' : trimmed.includes(',') ? ',' : '';
  if (!separator) {
    const words = trimmed.split(/\s+/);
    return { firstName: words[0], lastName: words.slice(1).join(' ') };
  }

  const [left, right = ''] = trimmed.split(separator).map((part) => part.trim());
  if (!left) return null;
  if (!right) return { firstName: left, lastName: '' };
  // A spreadsheet's two columns are First then Last. A comma is the ambiguous
  // one: "Chen, Maya" is a surname first, while "Maya,C" is already shortened.
  if (separator === '\t') return { firstName: left, lastName: right };
  return right.length <= maxPrefix ? { firstName: left, lastName: right } : { firstName: right, lastName: left };
}

export function parseRoster(text: string): ParsedName[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length > 1 && looksLikeHeading(lines[0])) lines.shift();
  return lines.map(readLine).filter((name): name is ParsedName => name !== null);
}

/**
 * Hands every student the shortest last-name prefix that tells them apart from
 * everyone sharing their first name in the same Class. Students who share a
 * first name all get the same width, so the roster reads consistently.
 */
export function assignPrefixes(names: ParsedName[]) {
  const groups = new Map<string, ParsedName[]>();
  for (const name of names) {
    const key = name.firstName.toLowerCase();
    const group = groups.get(key);
    if (group) group.push(name);
    else groups.set(key, [name]);
  }

  const widths = new Map<string, number>();
  let error = '';
  for (const [key, members] of groups) {
    let width = 1;
    for (; width <= maxPrefix; width += 1) {
      const seen = new Set(members.map((member) => member.lastName.slice(0, width).toLowerCase()));
      if (seen.size === members.length) break;
    }
    if (width > maxPrefix && !error) {
      // We have run out of letters we are willing to store. Refusing is
      // deliberate: two identical names on the door screen means students sign
      // out as each other, and the day's log is wrong beyond untangling.
      const shown = members
        .map((member) => displayName({ firstName: member.firstName, lastPrefix: member.lastName.slice(0, maxPrefix) }))
        .join('" and "');
      error = `Two students would both show as "${shown}". Please give one of them a nickname or a different name.`;
    }
    widths.set(key, Math.min(width, maxPrefix));
  }

  const entries = names.map((name) => ({
    firstName: name.firstName,
    lastPrefix: name.lastName.slice(0, widths.get(name.firstName.toLowerCase()) ?? 1),
  }));
  return { entries, error };
}

/**
 * Works out what a paste would do to a Class that already has a roster. Names
 * already there are matched and kept, new ones are added, and names that have
 * disappeared are reported rather than quietly removed — a silent replace would
 * archive a third of a class without the teacher noticing.
 */
export function planImport(text: string, existing: Student[]): ImportPlan {
  const parsed = parseRoster(text);
  const current = existing.filter((student) => student.status === 'current');

  const claimed = new Set<string>();
  const pairs: { parsed: ParsedName; student?: Student }[] = [];
  for (const name of parsed) {
    const hit = current.find(
      (student) =>
        !claimed.has(student.recordId) &&
        student.firstName.toLowerCase() === name.firstName.toLowerCase() &&
        name.lastName.toLowerCase().startsWith(student.lastPrefix.toLowerCase()),
    );
    if (hit) claimed.add(hit.recordId);
    pairs.push({ parsed: name, student: hit });
  }

  const missing = current.filter((student) => !claimed.has(student.recordId));

  // Students being kept but absent from the paste still occupy a name, so they
  // take part in working out the prefixes. All we know of them is the prefix we
  // already stored, which is the price of never having kept the rest.
  const union: ParsedName[] = [
    ...pairs.map((pair) => pair.parsed),
    ...missing.map((student) => ({ firstName: student.firstName, lastName: student.lastPrefix })),
  ];
  const { entries, error } = assignPrefixes(union);

  const added: ImportPlan['added'] = [];
  const matched: ImportPlan['matched'] = [];
  pairs.forEach((pair, index) => {
    const entry = entries[index];
    if (pair.student) matched.push({ student: pair.student, lastPrefix: entry.lastPrefix });
    else added.push(entry);
  });

  return { added, matched, missing, error };
}
