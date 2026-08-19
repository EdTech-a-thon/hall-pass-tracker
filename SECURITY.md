# Hallway Security Model

This prototype treats a student-operated kiosk as hostile. Browser code is never an authorization boundary.

## Required deployment controls

- Host teacher and kiosk interfaces on different origins and browser profiles.
- Run the kiosk in a managed, unprivileged operating-system kiosk account. Restrict navigation, extensions, downloads, removable media, firmware boot, and browser password storage.
- Put PocketBase behind HTTPS, restrict CORS, enable HSTS, encrypt PocketBase settings, and restrict superuser access by IP and MFA.
- Never put a superuser token, teacher token, or teacher password in Vite environment variables or kiosk storage.
- Keep collections locked. Client writes go through authenticated custom routes with strict body limits.
- Treat student IDs as identifiers, not proof of identity. Production should use opaque badges or separate PINs if impersonation is not an accepted risk.
- Fail closed when PocketBase is unavailable. Never report approval until a server transaction succeeds.

## Authentication boundary

Teachers use PocketBase email/password authentication. Public registration creates a new teacher record, which is also a new isolated classroom in this one-teacher/one-class prototype. Public registration does not grant access to existing classrooms: every collection rule and custom route scopes records to the authenticated teacher ID.

This deployment cannot send email, so email verification, password-reset email, and PocketBase email-OTP MFA are unavailable. PocketBase does not natively support authenticator-app TOTP, and this project does not roll its own. Production authenticator-app MFA requires an audited external identity provider or a separately reviewed PocketBase extension.

Teacher tokens use an in-memory `BaseAuthStore`; refreshing destroys the session.

## The kiosk boundary

A kiosk is a link, not an account. There is nothing to sign in to on the device by the door, so there is no password, one-time code, or session for a student to shoulder-surf or replay against a teacher.

A teacher creates a kiosk link on a trusted device. The raw 40-character token is returned exactly once and never stored: PocketBase holds only its SHA-256 hash, so a database disclosure does not yield a working link. The token names the classroom, which is why one link can never reach another teacher's class.

A kiosk holding a valid token may do exactly two things, both through custom routes:

- **Read the roster** (`POST /api/hallway/kiosk/session`) — student IDs and names for that one classroom, so the screen can greet a student by name. Not the log, not other classes, not the teacher record.
- **Append to the pass log** (`POST /api/hallway/kiosk/events`) — one exit or return at a time.

Everything else is closed by collection rules, not by browser code. `pass_events` has no update or delete rule at all, so the log is append-only for every principal including the teacher: a mistaken check-in is corrected by adding an entry, never by rewriting one. The kiosk is not authenticated to PocketBase, so its list and view rules exclude it too. The route-level tests in `tests/backend.spec.ts` assert each of these refusals against a real server.

Because the kiosk cannot read the log, it cannot decide whether a pass is allowed. The server counts who is out and either records the exit or answers `denied`, and it tells the kiosk only a count — never who is out. It also cannot know whether a student is currently out, which is why the student chooses between requesting a pass and signing back in rather than the screen choosing for them.

Revoking a link sets `active = false`, which stops both routes on the next request. A revoked device falls back to the teacher sign-in page and clears its stored token.

**A kiosk link is a bearer credential.** Anyone holding it can sign that class's students out and read that class's roster. Send it directly to the classroom device and revoke it if the device leaves the room.

## What is not protected

An earlier version of this prototype encrypted the classroom in the teacher's browser and stored only ciphertext. That is incompatible with a kiosk that greets students by name, so the roster and the hall pass log are now ordinary PocketBase records, readable by anyone with database or backup access. Protecting them is a deployment responsibility: disk encryption, restricted superuser access, and controlled backups.
