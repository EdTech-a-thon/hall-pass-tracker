# Hallway Security Model

Hallway is a local-first prototype. There is no server holding student data:
each teacher's classes, rosters and passes live in their own browser's local
storage. See `docs/adr/0005-local-first-with-the-kiosk-in-charge-of-the-door.md`.

## What is stored, and where

- **Student names** are a first name plus the fewest letters of the last name
  needed to tell students apart (at most three). The rest is discarded when the
  roster is pasted (`docs/adr/0001`).
- **On the teacher's laptop:** everything, in local storage, unencrypted.
  Anyone who can use that browser profile can read it. The backup file is
  ordinary JSON and should be kept like any other class record.
- **On a paired kiosk:** each class's display names, destinations and Pass
  Limit, the teacher's PIN, and passes that are open or not yet handed to the
  laptop. It never holds the full history.

## The connection between kiosk and laptop

- Hallway's matchmaking server (`peer.happyhallways.com`, also reachable as
  `peer.teacher.dev`; a standard PeerJS server)
  introduces the two devices. It sees their randomly generated addresses but
  stores nothing and never receives pass data.
- Pass data travels over WebRTC's encrypted channel, directly between the
  devices where the network allows. Where it doesn't, it is relayed through
  Cloudflare's TURN servers (`turn.cloudflare.com`), which pass the encrypted
  data along without being able to read it. The browser gets relay logins
  from `/api/turn` that expire after 12 hours; the Cloudflare token that
  creates them stays on the server. Anyone can ask `/api/turn` for logins, so
  someone could use the relay at our expense; a Cloudflare usage alert would catch
  that. Google's public STUN server helps each device learn its own network
  address; it sees no pass data.
- When pairing fails, the teacher can copy a connection report to send to
  support. It holds the browser, app version, connection states and error
  messages, but no student data, network addresses or relay logins.
- The 6-digit pairing code is a temporary address. It works once and expires
  after 10 minutes. A code could, rarely, be guessed by someone else in those
  minutes, and their device would become the kiosk. Pairing again replaces it.
- After pairing, the kiosk proves itself with a long random secret. The laptop
  ignores connections without the current kiosk's secret, except that a
  replaced kiosk may hand over passes it still holds, once.

## What the PIN does and doesn't do

The teacher PIN locks the Hallway interface on the kiosk (switching class,
unpairing, leaving kiosk mode). It is stored in plain text in local storage on
both devices, so it does not stop a technically capable person with access to
the device's browser tools. For real classroom use, run the kiosk device in its
operating system's managed kiosk or guided-access mode.

## Kiosk screen

The kiosk shows who is out and where they went, never how long they've been
gone or whether they are overdue (`docs/adr/0003`). When the Pass Limit is
reached it says how many are out, never who.
