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

The interface in kiosk mode does not request pass history. Student exits and returns go through the authenticated `POST /api/hallway/kiosk/events` route. `pass_events` has no update or delete rule, so the log remains append-only: a mistaken check-in is corrected by adding an entry, never by rewriting one.

The server counts who is out and either records the exit or answers `denied`, telling the kiosk only a count. Students choose between requesting a pass and signing back in rather than seeing the current pass state.

**The PIN locks the Hallway interface; it does not remove the teacher session from the browser.** A technically capable person with browser developer tools could access that session. Production use therefore requires the managed operating-system kiosk controls listed above. Exiting through the interface verifies the PIN on the server; refreshing signs the account out entirely.

## What is not protected

An earlier version of this prototype encrypted the classroom in the teacher's browser and stored only ciphertext. That is incompatible with a kiosk that greets students by name, so the roster and the hall pass log are now ordinary PocketBase records, readable by anyone with database or backup access. Protecting them is a deployment responsibility: disk encryption, restricted superuser access, and controlled backups.
