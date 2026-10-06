# Happy Hallways

Happy Hallways records students leaving the classroom and coming back. A kiosk by the
door signs them out and in; the teacher watches from their own laptop. Everything
lives on the teacher's own devices; there is no server and no sign-in.

## Language

**Class**:
A group of students a teacher sees together during one period. Each class owns
its own roster.
_Avoid_: Section, classroom, group

**Student**:
One child on one class's roster. The same child taught in two different classes
is two unrelated students, and nothing in the product connects them.
_Avoid_: Pupil, kid, roster entry

**Display Name**:
The only form of a student's name Happy Hallways keeps — a first name plus as many
leading letters of the last name as it takes to tell them apart from everyone
else in their class ("Maya C.", or "Maya Che." if a Maya Cha. shares the room).
A full last name is never stored.
_Avoid_: Full name, last initial, student name

**Destination**:
A place a student may go. The teacher keeps one list for all their classes. A
destination may carry the number of minutes that trip is expected to take; one
without a time can never be Overdue. Each has a color and an icon, so students
recognise it at the kiosk.
_Avoid_: Reason, location, place

**Pass**:
One round trip — a student left for a destination and has, or has not yet, come
back.
_Avoid_: Trip, hall pass, request

**Pass Limit**:
The most students who may be at one destination at the same time, such as one
at a time for the Restroom. Each destination has its own, or none at all, so
the Nurse and the Counselor can take any number of students while the Restroom
takes one. There is no limit on how many students may be out in total.
_Avoid_: Max out, cap, capacity

**Pass Allowance**:
How many passes each student may take in a stretch of time: per day, per week,
or since the teacher last reset it (for a quarter or a term). One setting for
all the teacher's classes, in Pass Options, counted separately for each student
in each class. Only destinations marked as counting use it up; a trip to the
Nurse, for example, need not. When a student has used it all, the kiosk either
stops them or warns them and lets them go, as the teacher chooses. Off unless
the teacher turns it on.
_Avoid_: Pass Limit (that is how many may be out at once), quota, budget, cap

**Extra Pass**:
A pass taken after a student has used up their Pass Allowance, because the
teacher let them go or because the allowance only warns. The teacher lets a
student go at the kiosk with their PIN, or gives them one from the laptop for
the student to use at the kiosk before the day ends. An Extra Pass lifts only
the allowance; No-Pass Time and a full destination each need their own
permission, a No-Pass Exception or a Line Skip. When the teacher lets a student
go, they get whichever of the three they need, each recorded on its own. It is recorded and counted like any other pass, and marked as
extra so the teacher can see it later. A pass cancelled at the door is never
extra, because it never counts.
_Avoid_: Override, excused pass, bonus pass

**No-Pass Exception**:
The teacher's permission for one student to start one pass during No-Pass
Time. It lifts only the No-Pass Time, and lasts until it is used or that
stretch of No-Pass Time ends. A pass taken with one is marked so the teacher
can see it later.
_Avoid_: Extra Pass (that lifts the Pass Allowance), override, excused pass

**Line Skip**:
The teacher's permission for one student to leave for a destination that has
reached its Pass Limit, ahead of anyone in its Line. Those in line keep their
places. A pass taken with one is marked so the teacher can see it later.
_Avoid_: Cutting, priority, override

**Exempt Student**:
A student the Pass Allowance does not apply to, such as one with a medical
need written into an IEP or 504 plan. They never run out, every trip is still
recorded, and the kiosk never shows that they are exempt.
_Avoid_: Unlimited student, special student, accommodation

**No-Pass Time**:
A stretch of the clock when the class on the kiosk may not start passes. Most
come from the Current Schedule and apply only while the teacher is On Schedule:
each schedule has its own, either the first or last minutes of a period
(set on each period, and copied to the rest in one click), or a fixed time
drawn on it. The teacher can also start one by hand from the laptop, on or off schedule,
which lasts until they end it or the class on the kiosk changes. Students already out can always come back,
and if the Line is on, students may join it and go once the No-Pass Time ends.
_Avoid_: Blackout, lockout, quiet time

**Line**:
Students waiting at the kiosk for one destination once its Pass Limit is
reached, in the order they joined. Each destination with a Pass Limit has its
own line, and a destination with none never has one. A teacher turns lines on
in Pass Options. When a spot at that destination opens it is held for the first
in its line, who is **Up Next** for it; nobody else may take it, but students
headed somewhere else are not held up. The line belongs to the class on the kiosk and empties when
the class changes. Being in line is not a pass and leaves nothing in history.
_Avoid_: Queue, wait list

**Schedule**:
A plan for one kind of school day, made of Periods and named by the teacher
however they like ("A Day", "Early Release"). A teacher whose day is the same
every day has just one; one with rotating days has one for each. The same class
may sit in different periods on different schedules.
_Avoid_: Bell schedule, timetable, rotation

**Period**:
One stretch of the clock in a Schedule, belonging to one class or to none, such
as lunch or planning. A period with a class may have No-Pass Time in its first
and last minutes.
_Avoid_: Class (that is the students), block, slot

**Current Schedule**:
The schedule the teacher last picked with "Use this". It stays picked, day
after day, until the teacher picks another; Happy Hallways never works out which
day it is. A teacher may have no schedules at all.
_Avoid_: Today's schedule, default schedule

**On Schedule**:
Whether the kiosk is following the Current Schedule, moving the Active Class by
itself as each period starts. Moving the class by hand, after a warning, takes
the teacher off schedule, and they stay off — even the next day — until they
put it back. Putting it back, or picking a schedule, jumps to whatever period
the clock is in, not to where they left off. Off schedule, the only No-Pass
Time is one the teacher starts by hand.
_Avoid_: Auto mode, autopilot, paused schedule

**Kiosk**:
The locked, student-facing device by the classroom door. A teacher has at most
one kiosk at a time; pairing a new one disconnects the old. The kiosk decides
who may leave right now and keeps working while the teacher's laptop is closed,
handing its passes over once the two can reach each other again.
_Avoid_: Kiosk mode, door screen, station, student mode

**Pairing**:
Making a device the teacher's kiosk, by typing a short code or scanning a QR code
shown on the teacher's laptop. It happens once; afterwards the kiosk finds the
laptop again on its own. The code is single-use and short-lived. A device that
has not paired successfully is never a kiosk; if pairing is impossible on the
network, the teacher's own computer is the kiosk.
_Avoid_: Linking, connecting, logging in

**Active Class**:
The class the kiosk is currently showing. Changing it ends every pass still open
in the class being left. While the teacher is On Schedule it moves by itself as
each Period starts, and between periods there is none, so nobody can leave.
Otherwise it moves only when someone deliberately moves it — from the teacher's
laptop, or at the kiosk with the teacher's PIN — and moving it by hand takes the
teacher off schedule. Browsing a different class on the laptop does not move it.
_Avoid_: Current class, selected class

**Overdue**:
A pass that has lasted longer than its destination's expected minutes. Only the
teacher's dashboard says a pass is overdue; kiosk mode never does.
_Avoid_: Late, over time, flagged

**Overdue Reminder**:
The teacher's laptop drawing the teacher's attention to a pass the moment it
becomes Overdue, naming the student, where they went and how long they have been
gone. It lasts until the student is back, whether they signed in or the teacher
marked them back; it cannot be waved away while they are still out. It never
appears on the kiosk, so when the teacher's own computer is the kiosk there is
no reminder, and overdue passes are reviewed afterwards in the class's history.
_Avoid_: Alert, alarm, notification, flag

**Correction**:
A teacher's after-the-fact change to a pass — giving it to the student it really
belonged to, or adjusting when it started or ended. The pass is changed in place
and shows that it was corrected; the earlier reading is not kept.
_Avoid_: Edit, fix, override

**Former Student**:
A student who has left a class part-way through the year. They disappear from
the door screen but keep every trip they ever took, so the class's history stays
whole. A student who has history is never truly deleted.
_Avoid_: Archived student, deleted student, inactive student

**Backup**:
A single file holding everything the teacher's laptop knows: classes, students,
passes, destinations, Pass Options, schedules and the kiosk pairing. Restoring it replaces
everything in that browser and puts the teacher back exactly where they were.
Happy Hallways has no accounts or sign-in; the backup is the only copy that leaves the
browser.
_Avoid_: Account, profile, export file
