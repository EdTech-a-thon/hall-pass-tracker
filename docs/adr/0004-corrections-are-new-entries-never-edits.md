# Corrections are new log entries, never edits

Teachers need to reassign a trip to the student it really belonged to and adjust
exit and return times, and they need a record of those changes. The pass log
cannot be updated or deleted at the database level, so a correction is written
as a *new* entry that amends an earlier one. The dashboard, analytics, and
exports all read the corrected view; the original entry stays underneath,
untouched.

We considered making the log editable with a separate audit table. Two things
ruled it out. First, the edit history and the audit trail would be one thing
described twice, and the second copy is the one that rots. Second, kiosk mode
runs on the teacher's live session — as `SECURITY.md` already notes, a
technically capable person at the door screen can reach that session. Today the
worst they can do is add noise to an append-only log. Granting update rights to
teachers would grant them to that person too, and turn adding noise into
rewriting the afternoon.

## Consequences

Corrections can themselves be corrected; the most recent one wins.

Reading the log means folding corrections over base entries everywhere it is
read, which is real complexity and the price of the guarantee.

Passes closed by a class change, and trips cancelled at the door, record that
the return time is unknown rather than inventing one, and are excluded from
average-trip and overdue figures.
