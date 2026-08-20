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

The teacher signs into their normal account on the classroom device and chooses
**Enter kiosk mode**. The first time, Hallway asks them to create a six-digit
PIN. That PIN is remembered for later sessions and is required to return to the
teacher workspace. A teacher can replace it at any time from **Profile**.

Students do not type anything. The door screen lists the current class by name;
a student taps their own name, taps where they are going, and sees a
full-screen confirmation readable from across the room. A student who is
already out has their name marked "Out" and taps it once to come back. A
mis-tap can be undone for a few seconds.

The screen shows no clock and no overdue marker against anyone — that is the
teacher's dashboard's job. The server decides whether a pass is allowed and
answers with a count, never another student's name.

Each teacher has several classes, each with its own roster. Students are stored
as a first name plus only as many letters of the last name as it takes to tell
them apart; a full last name is never kept. Rosters are built by pasting a list
or choosing a CSV.

PIN setup and verification, plus every pass request from kiosk mode, use custom
PocketBase routes in `pb_hooks/`. The server stores only a salted PIN hash.

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
registering, creating a kiosk PIN, entering kiosk mode, and exiting securely.

## Getting the records out

The **Download CSV** button on the dashboard produces a real spreadsheet of the
class you are looking at, which opens in Sheets or Excel by double-clicking. It
reflects any corrections you have made, so the file agrees with what you see on
screen. Trips whose return was never observed — a class change, or a mis-tap
undone at the door — say so rather than reporting a duration nobody measured.

Design decisions that would be surprising without their reasoning live in
[docs/adr](docs/adr), and the project's vocabulary is in [CONTEXT.md](CONTEXT.md).
Both create throwaway teacher accounts,
so point them at a database you do not mind filling up.

PocketBase rate-limits sign-ins, so run the real-backend tests one at a time:
`--workers=1`. If something else on the machine already holds port 8000, set
`PORT` to move the test server, e.g. `PORT=8011 bun run test`.

Security decisions and deployment requirements live in [SECURITY.md](SECURITY.md).
