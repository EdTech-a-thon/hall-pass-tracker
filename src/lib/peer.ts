import type { Peer } from 'peerjs';

/** A pairing code is the last part of a temporary address the kiosk dials once. */
export const pairingPrefix = 'hallway-pair-';

/** Every connection this page opened, so they can all be closed when it goes away. */
const live = new Set<Peer>();

/**
 * Closing a connection frees its address on PeerJS's server straight away.
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
 * Opens a connection to PeerJS's matchmaking server. If it drops, it tries
 * again after 3 seconds, then 6, 12… up to a minute, so an unreachable server
 * is not hammered.
 */
export async function createPeer(id?: string): Promise<Peer> {
  const { Peer } = await import('peerjs');
  const peer = id ? new Peer(id) : new Peer();
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
