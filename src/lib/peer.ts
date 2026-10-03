import type { DataConnection, Peer } from 'peerjs';

/** A pairing code is the last part of a temporary address the kiosk dials once. */
export const pairingPrefix = 'hallway-pair-';

/**
 * Happy Hallways' own matchmaking server (a standard PeerJS server). It only
 * introduces devices to each other; it stores nothing. Set VITE_PEER_HOST (and
 * VITE_PEER_PORT, VITE_PEER_PATH, VITE_PEER_SECURE) in .env.local to point at
 * another one, e.g. a local `peerjs` server while testing.
 */
const env = import.meta.env;
const server = {
  host: (env.VITE_PEER_HOST as string) || 'peer.teacher.dev',
  port: Number(env.VITE_PEER_PORT || 443),
  path: (env.VITE_PEER_PATH as string) || '/peerjs',
  secure: env.VITE_PEER_SECURE !== 'false',
  /**
   * Google's public STUN server only tells each device its own network
   * address. There is deliberately no relay (TURN) server: left to its
   * defaults, PeerJS would send pass data through its own public relays when a
   * network blocks direct connections. Here such a network just can't pair a
   * device, and the teacher uses the laptop as the kiosk instead.
   */
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
};

/** Every connection this page opened, so they can all be closed when it goes away. */
const live = new Set<Peer>();

/**
 * Closing a connection frees its address on the matchmaking server straight away.
 * Without this, a reload leaves the old address "taken" for a while and the new
 * page cannot claim it.
 */
function releaseAll() {
  for (const peer of live) peer.destroy();
  live.clear();
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', releaseAll);
// During development, Vite swaps code in place; close the old connections first.
import.meta.hot?.dispose(releaseAll);

/**
 * Opens a connection to our matchmaking server. If it drops, it tries
 * again after 3 seconds, then 6, 12… up to a minute, so an unreachable server
 * is not hammered.
 */
export async function createPeer(id?: string): Promise<Peer> {
  const { Peer } = await import('peerjs');
  const peer = id ? new Peer(id, server) : new Peer(server);
  live.add(peer);

  let delay = 3000;
  let timer = 0;
  peer.on('open', () => (delay = 3000));
  peer.on('disconnected', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!peer.destroyed && peer.disconnected) peer.reconnect();
    }, delay);
    delay = Math.min(delay * 2, 60_000);
  });
  peer.on('close', () => {
    clearTimeout(timer);
    live.delete(peer);
  });
  return peer;
}

/**
 * A direct connection can take a long time to notice that the other device has
 * vanished (battery died, Wi-Fi dropped). So both ends say "still here" every
 * few seconds, and treat a quiet connection as lost.
 */
const heartbeatMs = 5000;
const silentMs = 15_000;

export function keepAlive(connection: DataConnection) {
  let lastHeard = Date.now();
  connection.on('data', () => (lastHeard = Date.now()));
  const timer = window.setInterval(() => {
    if (!connection.open) return;
    if (Date.now() - lastHeard > silentMs) {
      clearInterval(timer);
      connection.close();
      return;
    }
    connection.send({ type: 'ping' });
  }, heartbeatMs);
  connection.on('close', () => clearInterval(timer));
}
