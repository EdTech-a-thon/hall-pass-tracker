# Happy Hallways

A classroom hall pass, at [happyhallways.com](https://happyhallways.com). A kiosk
by the door lets students sign themselves out and back in; the teacher sees who
is out, and how much class time each student misses, from their own laptop.

## How the pieces fit together

Happy Hallways has **no server and no accounts**. It is a SvelteKit app that runs
entirely in the browser:

- **The teacher's laptop** keeps everything (classes, rosters, passes) in the
  browser's local storage. **Settings → Download backup** saves it all as one
  file, and **Restore from a backup** puts it back.
- **The kiosk** is either the laptop itself, locked with the teacher's PIN, or
  a tablet or Chromebook paired with the laptop. Pairing works like signing in
  to Netflix on a TV: the laptop shows a 6-digit code and a QR code, and the
  door device enters or scans it once.
- A paired kiosk talks **directly** to the laptop using
  [PeerJS](https://peerjs.com) (WebRTC). Our matchmaking server,
  `peer.happyhallways.com` (or `peer.teacher.dev` where that is blocked), only introduces the two devices. On networks that block
  direct connections, the encrypted data is relayed through Cloudflare's TURN
  relay, which can't read it (see SECURITY.md).
- The kiosk is in charge of the door. It decides who may leave, and it keeps
  working while the laptop is closed, saving passes on the device and sending
  them when the two reconnect. If the school network blocks devices from
  talking directly, only the laptop itself can be the kiosk.

```
src/lib/account.svelte.ts   the teacher's data and every change to it
src/lib/link.svelte.ts      the laptop's end of the kiosk connection (pairing, syncing)
src/lib/door.svelte.ts      the kiosk's end: running the door, saving passes offline
src/lib/passes.ts           pass maths and the kiosk/laptop merge rule
src/lib/stats.ts            the numbers on the class and student pages
src/lib/roster.ts           turning a pasted list into short, private display names
src/routes/(teacher)/       the teacher's pages (classes, kiosk, settings)
src/routes/door/            the kiosk screen
```

## Running it

```bash
bun install
bun run dev      # http://localhost:8000
```

`bun run check` type-checks the project. `bun run test` runs the browser
tests.

### Testing pairing against a local matchmaking server

Pairing uses `peer.happyhallways.com` by default, falling back to
`peer.teacher.dev` (the same server) if a school filter blocks it. To test against a matchmaking
server on your own machine instead:

```bash
bunx --package peer peerjs --port 9000 --path /hallway
```

and create `.env.local` (it is not committed) with your machine's address:

```
VITE_PEER_HOST=192.168.0.29
VITE_PEER_PORT=9000
VITE_PEER_PATH=/hallway
VITE_PEER_SECURE=false
```

### The relay

`api/turn.ts` hands the browser short-lived logins for Cloudflare's relay. It
needs `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` (from the TURN key in Cloudflare
Realtime) in the hosting environment, and in `.env.local` to use
the relay during `bun run dev`. Without them, devices still connect wherever
the network allows a direct connection. Add `VITE_FORCE_TURN=true` to
`.env.local` to send every connection through the relay, to test it.

To try a laptop and a kiosk in one browser, open them at two different
addresses, e.g. `http://127.0.0.1:8000` and `http://192.168.0.29:8000`. Each
address keeps its own saved data, just like two separate devices.

### Guides

The how-to guides at `/guides` are built into finished pages (not run only in
the browser like the app), so search engines can read them. To add one:

1. Add it to `src/lib/guides.ts` and write its page in `src/routes/guides/<slug>/`.
2. Write a script in `scripts/guides/<slug>.spec.ts` that clicks through the
   steps in the real app, circling what to click with `circle()` and saving
   each picture with `snap()`.
3. Run `bun run guides:screenshots`. It retakes every guide's pictures, so run
   it again whenever the app's look changes.

## Learn more

- The project's vocabulary is in [CONTEXT.md](CONTEXT.md).
- Decisions that would be surprising without their reasoning are in
  [docs/adr](docs/adr).
- What the design does and doesn't protect is in [SECURITY.md](SECURITY.md).
