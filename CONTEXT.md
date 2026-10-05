# Happy Hallways

Happy Hallways records students leaving the classroom and coming back. A kiosk by the
door signs them out and in; the teacher watches from their own laptop. Everything
lives on the teacher's own devices; there is no server and no sign-in.

## Language

**Class**:
A group of students a teacher sees together during one period. Each class owns
its own roster.
_Avoid_: Period, section, classroom, group

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
The most students who may be out at the same time. One setting for all the
teacher's classes, in Pass Options.
_Avoid_: Max out, cap, capacity

**No-Pass Time**:
A stretch of the clock, set for one class, when that class may not start
passes, such as the first and last ten minutes of the period. It applies only
while that class is on the kiosk. Students already out can always come back,
and if the Line is on, students may join it and go once the No-Pass Time ends.
_Avoid_: Blackout, lockout, quiet time

**Line**:
Students waiting at the kiosk once the Pass Limit is reached, in the order they
joined, each with where they want to go. A teacher turns it on in Pass Options.
When a spot opens it is held for the first in line, who is **Up Next**; nobody
else may take it. The line belongs to the class on the kiosk and empties when
the class changes. Being in line is not a pass and leaves nothing in history.
_Avoid_: Queue, wait list

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
in the class being left. It moves only when someone deliberately moves it — from
the teacher's laptop, or at the kiosk with the teacher's PIN. Browsing a
different class on the laptop does not move it.
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
passes, destinations, Pass Options and the kiosk pairing. Restoring it replaces
everything in that browser and puts the teacher back exactly where they were.
Happy Hallways has no accounts or sign-in; the backup is the only copy that leaves the
browser.
_Avoid_: Account, profile, export file
