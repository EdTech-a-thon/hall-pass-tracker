# Hallway Security Model

This prototype uses a teacher-authenticated browser in a supervised classroom kiosk. Browser code and the kiosk PIN are interface controls, not complete authorization boundaries.

## Required deployment controls

- Run the kiosk in a managed, unprivileged operating-system kiosk account. Restrict navigation, extensions, downloads, removable media, firmware boot, and browser password storage.
- Put PocketBase behind HTTPS, restrict CORS, enable HSTS, encrypt PocketBase settings, and restrict superuser access by IP and MFA.
- Never put a superuser token, teacher token, or teacher password in Vite environment variables or kiosk storage.
- Keep collections locked. Client writes go through authenticated custom routes with strict body limits.
- Treat student IDs as identifiers, not proof of identity. Production should use opaque badges or separate PINs if impersonation is not an accepted risk.
- Fail closed when PocketBase is unavailable. Never report approval until a server transaction succeeds.

## Authentication boundary

Teachers use PocketBase email/password authentication. Public registration creates a new teacher record, which is also a new isolated classroom in this one-teacher/one-class prototype. Public registration does not grant access to existing classrooms: every collection rule and custom route scopes records to the authenticated teacher ID.

This deployment cannot send email, so email verification, password-reset email, and PocketBase email-OTP MFA are unavailable. PocketBase does not natively support authenticator-app TOTP, and this project does not roll its own. Production authenticator-app MFA requires an audited external identity provider or a separately reviewed PocketBase extension.

Teacher tokens use an in-memory `BaseAuthStore`; refreshing destroys the session and returns the device to teacher sign-in.

## The kiosk boundary

A teacher signs into their normal account on the device, then enters kiosk mode. The first session requires creating a six-digit exit PIN. PocketBase stores only a salted password hash in a hidden field. The same PIN is reused until the teacher replaces it from Profile.

Kiosk mode reads the Active Class's roster and its current pass state, so that it can greet students by name and show who is in the hallway. It reads nothing further, and it writes nothing directly: student exits and returns go through the authenticated `POST /api/hallway/kiosk/events` route. A test asserts that every collection request the door screen makes is a `GET` against its own roster, its own Class list, and its own Class's log.

An earlier version of this document said the kiosk did not request pass history. That was true when the door screen was a limited link account with no power to read it. Since kiosk mode became the teacher's own session behind a PIN, the restriction was self-imposed rather than enforced, and it cost every student a step while buying no real protection. The reasoning is recorded in `docs/adr/0003-kiosk-mode-shows-who-is-out.md`.

Kiosk mode still shows no timing of any kind -- no elapsed minutes, no countdown, no overdue marker. Whether a student is late is a judgement for the teacher's dashboard.

`pass_events` has no update or delete rule, for anyone, so the log remains append-only. A mistaken check-in is corrected by adding an entry, never by rewriting one; the same is true of the few-second undo at the door, which writes a return marked `cancelled` rather than removing anything. `docs/adr/0004-corrections-are-new-entries-never-edits.md` records why teacher-facing edits must not change this.

The server counts who is out within the Active Class and either records the exit or answers `denied`, telling the kiosk only a count, never another student's name. How long a trip should take is read from the teacher's own Destination list on the server, so a browser cannot claim a trip was meant to last an hour.

**The PIN locks the Hallway interface; it does not remove the teacher session from the browser.** A technically capable person with browser developer tools could access that session. Production use therefore requires the managed operating-system kiosk controls listed above. Exiting through the interface verifies the PIN on the server; refreshing signs the account out entirely.

## What is not protected

An earlier version of this prototype encrypted the classroom in the teacher's browser and stored only ciphertext. That is incompatible with a kiosk that greets students by name, so the roster and the hall pass log are now ordinary PocketBase records, readable by anyone with database or backup access. Protecting them is a deployment responsibility: disk encryption, restricted superuser access, and controlled backups.
