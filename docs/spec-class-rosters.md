# Class Rosters, Teacher-Set Destinations, and Name-Based Kiosk Mode

## Problem Statement

A teacher who uses Hallway today has one undifferentiated list of students for
their entire day, and every student must type a four-digit number to sign out.
That fails a real classroom in several ways at once.

A teacher does not teach one group — they teach five or six across a day, and
Hallway has no idea which one is in the room. Everyone a teacher has ever taught
appears on the door screen at every hour, so a student must find their own name
in a list of a hundred and fifty, and nothing prevents a Period 2 student from
signing out during Period 5.

The four-digit number is its own obstacle. Students forget it, mistype it, and
share it. A teacher setting up a class has to invent, distribute, and maintain a
number for every child before the product does anything useful at all — which
means Hallway cannot be adopted in the five minutes before a class starts.

The destinations a student may choose are fixed in the code. A teacher who does
not want students walking to the counsellor unaccompanied, or who needs a
"Nurse" or "Front office" option, cannot change the list.

And there is nothing to glance at. A teacher supervising a room needs to confirm
from across it that the right child left for the right place. The current screen
returns a small confirmation that cannot be read at distance, and offers no way
to fix a mis-tap afterwards.

## Solution

Teachers get **Classes**. Each Class owns its own roster, built by pasting names
from a spreadsheet or picking a `.csv` file, and the teacher can move the door
screen from one Class to the next as the day goes on.

Students stop typing anything. Kiosk Mode shows the Active Class's roster as a
grid of names. A student taps their own name, taps where they are going, and a
full-screen confirmation shows their Display Name and Destination in letters
readable from the back of the room. A student already out sees their name marked
"Out" and taps it to sign back in.

The teacher owns the Destination list for their whole account, and each
Destination carries the number of minutes that trip is expected to take. When a
student exceeds it, the teacher's dashboard flags the Pass as Overdue — the door
screen never does, and never shows a clock.

Switching between Classes happens either at the door, behind the teacher's PIN,
or from the dashboard with an explicit button. Either way, any Pass still open in
the Class being left is closed and marked as ended by the switch rather than by a
student returning.

Because a student will sometimes tap the wrong name, teachers can issue
Corrections from the dashboard: give a Pass to the student it really belonged to,
or adjust when it started or ended. Corrections never overwrite the log — they
are new entries laid over it — so the original reading and every change to it
survive, and the teacher can review every Correction made over any date range.

## User Stories

1. As a teacher, I want to create a Class, so that the door screen shows only the students who are actually in my room.
2. As a teacher, I want to name a Class whatever I call it out loud ("Period 2", "AP Bio B"), so that I recognise it under pressure between periods.
3. As a teacher, I want to create several Classes, so that one account covers my whole teaching day.
4. As a teacher, I want to rename a Class, so that a mid-year timetable change does not force me to rebuild a roster.
5. As a teacher, I want to reorder my Classes, so that they appear in the order my day actually runs.
6. As a teacher, I want to paste a column of names copied from a spreadsheet, so that I can build a roster without retyping thirty names.
7. As a teacher, I want to pick a `.csv` file instead of pasting, so that an exported roster works without me opening it first.
8. As a teacher, I want the import to understand "Maya Chen", "Chen, Maya", and "Maya,C" without me knowing which is correct, so that whatever my school's system exports just works.
9. As a teacher, I want to see exactly what the import parsed before it saves, so that I catch a mangled paste before it becomes my roster.
10. As a teacher, I want blank lines and a header row to be ignored, so that a straight copy out of Sheets does not create a student called "Name".
11. As a teacher, I want each student stored as a first name and only as much of the last name as it takes to tell them apart, so that no child's full name sits in a database or on a screen in a corridor.
12. As a teacher, I want two students who would both read "Maya C." separated automatically into "Maya Ch." and "Maya Ca.", so that I do not have to think about collisions.
13. As a teacher, I want to be stopped and told when two students still collide at three letters, so that I can give one of them a nickname rather than discover two identical names on the door screen.
14. As a teacher, I want to edit a single student's Display Name by hand, so that a child who goes by "Nico" is not shown as "Nicolas N.".
15. As a teacher, I want to add one student without re-importing, so that a new arrival in week three takes ten seconds.
16. As a teacher, I want to re-import a changed roster and have it merge rather than replace, so that October's paste does not silently wipe September's history.
17. As a teacher, I want the re-import preview to tell me which names are new, which already exist, and which have disappeared, so that I decide what happens to the ones who left.
18. As a teacher, I want a departed student marked as a Former Student rather than deleted, so that their Passes stay correctly attributed in my records.
19. As a teacher, I want a Former Student to vanish from the door screen immediately, so that nobody signs out as a child who has left.
20. As a teacher, I want to truly delete a student I added by mistake who has no history, so that a typo does not linger as a Former Student forever.
21. As a teacher, I want to archive a whole Class the same way, so that last semester's group stops cluttering my switcher without losing its data.
22. As a teacher, I want to set the list of Destinations for my account, so that students can only choose places I am willing to let them go.
23. As a teacher, I want each Destination to carry an expected number of minutes, so that "Restroom" and "Counsellor" are not held to the same standard.
24. As a teacher, I want to add, rename, reorder, and remove Destinations, so that the list matches how my school actually works.
25. As a teacher, I want changing a Destination's expected minutes to affect only future Passes, so that one edit does not silently rewrite months of Overdue history.
26. As a student, I want to see my own name on the door screen and tap it, so that I do not need to remember a number.
27. As a student, I want to tap where I am going straight after my name, so that signing out takes two taps and no typing.
28. As a student, I want a large confirmation showing my name and where I am going, so that I know it worked without asking the teacher.
29. As a student, I want to be told what time I am expected back, so that I know what is being asked of me.
30. As a student who is already out, I want my name marked "Out" and a single tap to sign back in, so that I do not have to work out which action applies to me.
31. As a student who tapped the wrong name, I want a few seconds to cancel it, so that I am not left holding a Pass I cannot sign back in from.
32. As a student, I want the door screen to show no timer and no colour change against my name, so that being slow back is a matter between me and my teacher rather than a display for the room.
33. As a teacher, I want the hallway limit enforced within the Active Class only, so that another period's records cannot block the students in front of me.
34. As a teacher, I want to keep one limit setting for my whole account, so that I configure the rule once rather than per Class.
35. As a teacher, I want a student turned away when the limit is reached to be told only a count, so that the screen never announces which other students are out.
36. As a teacher, I want to switch the door screen to my next Class using my PIN, so that changing period takes seconds and a student cannot do it.
37. As a teacher, I want to push a different Class to the door screen from my dashboard, so that I can set up for the next period from my desk.
38. As a teacher, I want browsing a Class in my dashboard to leave the door screen alone, so that looking at Period 4's history does not change what my Period 2 students see.
39. As a teacher, I want switching Classes to close any Pass still open in the Class I am leaving, so that a forgotten student does not stay open all day.
40. As a teacher, I want those auto-closed Passes marked as ended by the switch, so that I can tell them apart from a student who actually came back.
41. As a teacher, I want to be warned before switching when students are still out, and to see their names, so that I do not destroy real return times by accident.
42. As a teacher, I want to switch without a prompt when nobody is out, so that the common case stays fast.
43. As a teacher, I want to see who is out right now with how long they have been gone, so that I can act on a student who has been away too long.
44. As a teacher, I want a Pass flagged Overdue the instant it exceeds its Destination's expected minutes, so that I find out while I can still do something.
45. As a teacher, I want the Overdue flag to persist on the finished Pass, so that a pattern is visible later.
46. As a teacher, I want to mark a student returned from my dashboard, so that a student who came back without tapping does not stay out forever.
47. As a teacher, I want to reassign a Pass to a different student in the Class, so that a mis-tap at the door does not leave the wrong child's record wrong.
48. As a teacher, I want to adjust when a Pass started or ended, so that a late tap does not misrepresent how long a student was gone.
49. As a teacher, I want the original log entry preserved underneath every Correction, so that my records remain trustworthy rather than merely editable.
50. As a teacher, I want to correct a Correction, so that a mistaken fix is not permanent.
51. As a teacher, I want to see every Correction made over a date range, so that I can review what was changed and when.
52. As a teacher, I want a Pass that was corrected to be visibly marked as such in my history, so that I am not misled by a number that has moved.
53. As a teacher, I want my analytics computed from the corrected view, so that the figures I act on reflect what really happened.
54. As a teacher, I want Passes ended by a Class switch or cancelled at the door excluded from average-trip and Overdue figures, so that invented durations do not distort my numbers.
55. As a teacher, I want to see which Destinations my students actually use, so that I can tell a restroom problem from a nurse problem.
56. As a teacher, I want a chart of Passes across recent school days, so that I can see whether a pattern is building.
57. As a teacher, I want to be told plainly when there is not yet enough history to chart, so that I am not shown a made-up trend.
58. As a teacher, I want to download my Passes as a CSV, so that I can open them in Sheets or Excel and share them with an administrator or a parent.
59. As a teacher, I want the CSV to reflect Corrections, so that the file I hand over agrees with what my dashboard shows.
60. As a teacher, I want my existing roster to survive this change, so that upgrading does not cost me the setup I already did.

## Implementation Decisions

### Governing decisions already recorded

Four decisions in this area are recorded as ADRs and constrain everything below.
They are summarised here but the ADRs are authoritative.

- **Display Names only.** A Student's full last name is never stored. ADR 0001.
- **A child in two Classes is two Students.** No shared identity, deliberately.
  ADR 0002.
- **Kiosk Mode shows who is out.** Reverses the earlier insert-only stance.
  ADR 0003.
- **Corrections are new entries, never edits.** The Pass Event log stays
  physically immutable. ADR 0004.

### Schema

A new `classes` collection holds a teacher reference, a name, a display order,
and an archived flag. Rules follow the pattern every other collection here
already uses: a teacher sees and writes only their own rows.

`students` gains a Class reference, `firstName`, `lastPrefix`, and a roster
status distinguishing a current Student from a Former Student. It loses
`studentId` entirely — the four-digit number has no remaining purpose once
students tap their names. Uniqueness moves from `(teacher, studentId)` to a
Display Name that is unique within a Class.

`teachers` gains an ordered Destination list, each entry carrying a label and its
expected minutes, and a reference to the Active Class. The existing account-wide
pass limit is unchanged.

`pass_events` keeps its append-only rules untouched — no update rule, no delete
rule, for anyone. It gains a Class reference, widens `source` to include
`switch` and `cancelled` alongside `kiosk` and `teacher`, and gains the fields a
Correction needs: a reference to the Pass Event being amended, and optional
replacement values for the Student and for the exit and return times. The
existing `minutes` field already snapshots the expected duration onto each Pass
Event at the moment of exit, which is exactly the freezing behaviour decision 25
requires; no change is needed there.

The Student reference on a Pass Event moves from the four-digit number to the
roster row. The denormalised Display Name stays, so an archived Student's history
still reads correctly.

### Migration of existing data

Existing teachers get a single Class named "My class" containing their whole
current roster. Existing Pass Events are re-pointed from the four-digit number to
the matching roster row. Any Pass Event with no matching Student is dropped
rather than contorting the schema to preserve it — the affected data is
prototype demo data, and this was confirmed with the developer.

Existing student names are split into `firstName` and `lastPrefix` by the same
rules the importer uses.

### Server routes

The existing kiosk event route is reworked to identify a Student by roster row
rather than by typed number, to scope the hallway limit to the Active Class
rather than the whole teacher, and to record the Class on each Pass Event.

A new route switches the Active Class. It must close every open Pass in the Class
being left and update the Active Class within a single transaction, so a failure
cannot leave the door screen showing one Class while another Class's Passes hang
open. It reports which students were still out so the interface can name them in
its confirmation.

A new route records a Correction. It validates that the Pass Event being amended
belongs to the requesting teacher, and that a reassignment targets a Student in
the same Class.

Cancelling a Pass at the door writes a return Pass Event with source `cancelled`
through the existing kiosk route.

### Reading the log

The existing fold from Pass Events into Passes gains a Correction pass: base
entries are folded first, then Corrections are applied in order, with the most
recent Correction winning per field. Everything that reads Passes — the live
view, history, analytics, and CSV export — reads the corrected result. Passes
whose return was produced by a `switch` or `cancelled` event carry an explicit
"return time unknown" marker and are excluded from average-trip and Overdue
calculations.

Overdue is derived, never stored: a Pass is Overdue when its elapsed time exceeds
the minutes frozen onto it. There is no grace period. It is evaluated live for an
open Pass and remains true once the Pass is finished.

### Display Name derivation

The importer takes a first name and whatever it can find of a last name, and
emits the shortest last-name prefix from one to three characters that is unique
within the Class. Where no full last name was supplied, only what was supplied is
available. If two Students in a Class cannot be separated within three
characters, the import is rejected with both offending names shown; the teacher
resolves it by supplying a nickname. The three-character cap is a privacy limit
from ADR 0001, not a technical one.

### Interface

The teacher workspace gains Class management with roster import and preview, a
Destination editor, a Class picker on the live view that does not move the Active
Class, an explicit control that does, a Correction affordance on the history
table, and a Correction review filtered by date range.

Kiosk Mode is rebuilt as a name grid, then a Destination grid, then a full-screen
confirmation, plus a PIN-gated Class switcher. It displays no elapsed time,
no countdown against a Student, and no Overdue state anywhere.

The fake Google Sheets export modal is removed and replaced with a real CSV
download built from the corrected Passes.

The hardcoded weekly chart and Destination breakdown in analytics are replaced
with figures computed from real data, showing an explicit insufficient-history
state rather than a misleading flat chart.

### Documentation to correct

`SECURITY.md` currently states that the kiosk interface does not request pass
history and that students choose between actions rather than seeing current pass
state. ADR 0003 reverses both. Those paragraphs must be rewritten as part of this
work, along with the README's description of kiosk setup and the four-digit ID.

## Testing Decisions

A good test here asserts what a teacher or a student can observe — what appears
on the screen, what the exported file contains, what the server refuses. It does
not assert the shape of an internal function. This matters especially for
Display Name derivation and Correction folding: both are dense logic, and the
temptation is to pin down their function signatures. ADR 0001 and ADR 0004 are
about the guarantees, not the implementations, so the tests should be too.

Two existing seams are used. **No new seam and no new test runner is added**,
which was confirmed with the developer.

**Seam one — the browser against a stubbed backend.** Playwright drives the real
interface while PocketBase is stubbed at the HTTP boundary. This is the highest
seam available and takes almost everything: roster paste and preview including
prefix disambiguation and the three-character rejection, the two-tap kiosk flow,
the confirmation screen, cancelling a mis-tap, PIN-gated Class switching, the
switch confirmation naming who is out, Corrections appearing in history and
moving analytics, Overdue appearing on the dashboard, the absence of any timing
on the door screen, and CSV contents. Prior art: the existing suite already opens
the workspace, enters kiosk mode, and asserts on a stubbed pass log this way, and
already contains a test asserting the kiosk makes no direct collection requests —
that test must be revised under ADR 0003 rather than deleted, since the kiosk now
legitimately reads the roster and current state.

**Seam two — the SDK against a real PocketBase**, gated on an environment
variable as the existing backend suite is. Reserved for the three guarantees a
stub can only pretend about: that Pass Events still refuse updates and deletions
even for the owning teacher, that a Class switch closes open Passes and moves the
Active Class atomically, and that a Correction aimed at another teacher's log is
rejected. Prior art: the existing backend suite already registers throwaway
teachers, exercises the kiosk route, and asserts cross-teacher isolation, with a
retry helper for the rate limiter.

Full-flow coverage against a real browser and real backend stays in the existing
opt-in suite and is extended to cover creating a Class and importing a roster.

## Out of Scope

- **Scheduled Class switching.** Switching by bell schedule was discussed and
  explicitly deferred; it needs a timetable model of its own. Manual switching,
  by PIN at the door or by button in the dashboard, is what ships.
- **Google Sheets integration.** The real export is a CSV download. OAuth, a
  Google Cloud project, and a consent screen are disproportionate here, and the
  existing fake modal is removed rather than made real.
- **A school-system student identifier.** The four-digit number is removed and
  nothing replaces it. An optional identifier for matching against a student
  information system can be added later if an actual export need appears.
- **Cross-Class student identity.** Deliberately excluded by ADR 0002.
- **Student accounts or student authentication.** Students remain anonymous
  users of a shared screen.
- **Per-Class Destination lists.** Destinations are an account-wide setting, as
  specified.
- **Editing a Pass's Destination.** A wrong Destination means the trip was wrong;
  the teacher reassigns or cancels instead.
- **Grace periods on Overdue.** The teacher sets the expected minutes; the app
  does not add invisible padding.
- **Multi-teacher or school-wide views.** Hallway remains one teacher's account.

## Further Notes

The three-character cap on last-name prefixes is a genuine one-way door. Letters
discarded at import cannot be recovered by a later migration — restoring them
would mean every teacher re-importing every roster. This was raised explicitly
with the developer and confirmed.

Corrections deserve care in review. They are the one place where a reasonable
contributor is likely to look at the folding complexity and propose "simplifying"
it into a normal editable table. ADR 0004 records why that must not happen, and
notes the security dimension: Kiosk Mode runs on the teacher's live session, so
any update right granted to teachers is also reachable from the door screen.

The confirmation before a Class switch is the only step in this design that
destroys information — the real return times of students still out. That is why
it names them rather than showing a count.
