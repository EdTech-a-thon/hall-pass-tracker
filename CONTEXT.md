# Hallway

Hallway records students leaving the classroom and coming back. A screen by the
door signs them out and in; the teacher watches from their own workspace.

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
The only form of a student's name Hallway keeps — a first name plus as many
leading letters of the last name as it takes to tell them apart from everyone
else in their class ("Maya C.", or "Maya Che." if a Maya Cha. shares the room).
A full last name is never stored.
_Avoid_: Full name, last initial, student name

**Destination**:
A place a student may go. The teacher chooses the list for their whole account,
and each destination carries the number of minutes that trip is expected to take.
_Avoid_: Reason, location, place

**Pass**:
One round trip — a student left for a destination and has, or has not yet, come
back.
_Avoid_: Trip, hall pass, request

**Pass Event**:
A single line in the permanent log: a student left, or a student came back.
Events are never edited or erased.
_Avoid_: Log entry, record

**Kiosk Mode**:
The locked, student-facing screen by the classroom door. It shows one class at a
time, and the teacher's PIN is required to leave it or to change which class it
is showing.
_Avoid_: Kiosk view, door mode, student mode

**Active Class**:
The class kiosk mode is currently showing. Changing it ends every pass still open
in the class being left. It moves only when someone deliberately moves it — from
the door screen with the teacher's PIN, or with an explicit button in the
dashboard. Browsing a different class in the dashboard does not move it.
_Avoid_: Current class, selected class

**Overdue**:
A pass that has lasted longer than its destination's expected minutes. Only the
teacher's dashboard says a pass is overdue; kiosk mode never does.
_Avoid_: Late, over time, flagged

**Correction**:
A teacher's after-the-fact amendment to the log — giving a trip to the student it
really belonged to, or adjusting when it started or ended. Every correction is
itself recorded, so the original reading and who changed it are never lost.
_Avoid_: Edit, fix, override

**Former Student**:
A student who has left a class part-way through the year. They disappear from
the door screen but keep every trip they ever took, so the class's history stays
whole. A student who has history is never truly deleted.
_Avoid_: Archived student, deleted student, inactive student
