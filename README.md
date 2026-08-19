# Hallway Pass Tracker

A classroom hallway pass prototype. A screen by the classroom door signs
students out and back in, and the teacher sees who is out from their own
workspace.

## How the pieces fit together

The website is a Svelte app built with Vite. Its database is **PocketBase**, a
single small server that holds teacher accounts, class rosters, and the hall
pass log. The browser talks to PocketBase directly through the PocketBase
JavaScript SDK — there is no separate backend of our own in between.

## Setting up the screen by the door

The teacher signs in, opens **Security**, and creates a **kiosk link**. Sending
that link to the classroom device and opening it once is the whole setup — no
code to type, nothing to sign in to.

That link is deliberately weak. It lets the door device read the class roster,
so it can greet students by name, and add exits and returns to the log. It
cannot read the log, change or delete anything already in it, see another
teacher's class, or reach the teacher's account. Because the device can't see
who is out, the server decides whether a pass is allowed and answers with a
count — never a name.

Anything that has to happen in one safe step on the server — creating a kiosk
link, revoking one, and every request a kiosk makes — is a custom PocketBase
route in `pb_hooks/`, not a rule the browser is trusted to follow.

```
pb_migrations/   every change to the database's shape, one file per change
pb_hooks/        the custom server routes listed above
pb_data/         the local database itself — never committed
pocketbase       the server program — downloaded per machine, never committed
```

## Running it locally

```bash
bun install
./deploy/install-pocketbase.sh                                   # once per machine
./pocketbase serve --http=127.0.0.1:8093 --hooksDir=pb_hooks --migrationsDir=pb_migrations
bun run dev                                                      # in a second terminal
```

The first `serve` builds the database from `pb_migrations/` and prints a link
for creating your local admin account. The website is then on port 8000, and it
expects PocketBase on 8093 — copy `.env.example` to `.env.local` if you need to
point it somewhere else.

## Changing the database

Make the change in the PocketBase admin dashboard at
`http://127.0.0.1:8093/_/`, and PocketBase writes the matching file into
`pb_migrations/` by itself. Commit that file as-is; don't hand-write or edit
one. It runs automatically wherever this project is deployed, so there is no
separate step to remember.

## Tests

```bash
bun run test
```

The browser tests run against a stubbed backend. The tests in
`tests/backend.spec.ts` exercise a real PocketBase and only run when
`PB_E2E_URL` is set — for a local instance that is
`PB_E2E_URL=http://127.0.0.1:8093 bun run test`. `REAL_SIGNUP_E2E=1` adds
`tests/signup-real.spec.ts`, which drives the whole flow in a real browser:
registering, creating a kiosk link, opening it on a second device, and watching
the pass appear on the teacher's screen. Both create throwaway teacher accounts,
so point them at a database you do not mind filling up.

PocketBase rate-limits sign-ins, so run the real-backend tests one at a time:
`--workers=1`. If something else on the machine already holds port 8000, set
`PORT` to move the test server, e.g. `PORT=8011 bun run test`.

Security decisions and deployment requirements live in [SECURITY.md](SECURITY.md).
