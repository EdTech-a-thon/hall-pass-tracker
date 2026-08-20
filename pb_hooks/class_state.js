/// <reference path="../pb_data/types.d.ts" />

// Route handlers run in their own isolated runtime and cannot see anything
// defined beside them in the file, so shared logic has to live in a module and
// be require()d from inside each handler.

/**
 * Who is in the hallway in one Class right now.
 *
 * Two things this has to get right. Corrections are entries too, and a "fix"
 * row carries the amended trip's student -- reading it as that student's latest
 * state would make a corrected trip vanish from the count, so corrections are
 * laid over the entries they amend exactly as the interface does. And the scan
 * reads newest first, so a class busy enough to exceed the row cap still yields
 * current state rather than the oldest slice of the month.
 */
function readClassState(tx, teacherId, classId) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const log = tx.findRecordsByFilter(
    "pass_events",
    "teacher = {:teacher} && class = {:class} && at > {:since}",
    "-at", 5000, 0,
    { teacher: teacherId, class: classId, since: since },
  );

  const amended = {};
  for (let index = 0; index < log.length; index++) {
    if (log[index].getString("kind") !== "fix") continue;
    const target = log[index].getString("corrects");
    const moved = log[index].getString("newStudent");
    // Newest first, so the first correction seen for an entry is the latest one.
    if (target && moved && !amended[target]) {
      amended[target] = { student: moved, name: log[index].getString("studentName") };
    }
  }

  const latest = {};
  const names = {};
  for (let index = 0; index < log.length; index++) {
    const row = log[index];
    const kind = row.getString("kind");
    if (kind === "fix") continue;
    const fix = amended[row.id];
    const student = fix ? fix.student : row.getString("student");
    if (latest[student]) continue;
    latest[student] = kind;
    names[student] = fix ? fix.name : row.getString("studentName");
  }
  return { latest: latest, names: names };
}

module.exports = { readClassState: readClassState };
