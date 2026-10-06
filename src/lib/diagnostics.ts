import { version } from '$app/env';
import { connectionSetup } from './peer';

/**
 * When two devices can't connect, support needs to know why. This watches a
 * direct connection (WebRTC) as it forms and, if it fails, writes a short
 * plain-text report a teacher can copy into an email.
 *
 * The report never includes student data, network addresses or relay logins:
 * only counts, states and error messages.
 */

type CandidateType = 'host' | 'srflx' | 'prflx' | 'relay';
const emptyCounts = (): Record<CandidateType, number> => ({ host: 0, srflx: 0, prflx: 0, relay: 0 });

/** What a connection tried while it was forming. */
export type ConnectionWatch = { routes: Record<CandidateType, number>; relayErrors: string[] };

export function watchConnection(connection: RTCPeerConnection | null | undefined): ConnectionWatch {
  const watch: ConnectionWatch = { routes: emptyCounts(), relayErrors: [] };
  connection?.addEventListener('icecandidate', (event) => {
    const type = event.candidate?.type;
    if (type) watch.routes[type]++;
  });
  connection?.addEventListener('icecandidateerror', (event) => {
    const { url, errorCode, errorText } = event as RTCPeerConnectionIceErrorEvent;
    // Only the relay servers' errors say anything useful; each is listed once.
    const line = `${url} → ${errorCode} ${errorText}`.trim();
    if (url && !watch.relayErrors.includes(line)) watch.relayErrors.push(line);
  });
  return watch;
}

/**
 * A short code for the likeliest cause, so support can sort emails at a glance:
 * NO-RELAY: this device couldn't get relay logins from us.
 * RELAY-BLOCKED: it got logins, but the network wouldn't let it reach the relay.
 * NO-ROUTE: both devices had routes, but none of them got through.
 * Otherwise, the matchmaking server's own error, e.g. SOCKET-ERROR (PeerJS error type).
 */
function likelyCause(setup: ReturnType<typeof connectionSetup>, watch: ConnectionWatch | null, peerError?: string) {
  if (peerError) return peerError.split(':')[0].toUpperCase();
  if (setup.relay.startsWith('no logins')) return 'NO-RELAY';
  if (watch && watch.routes.relay === 0) return 'RELAY-BLOCKED';
  return 'NO-ROUTE';
}

/** Counts each kind of route in a connection's final statistics. */
async function routeSummary(connection: RTCPeerConnection) {
  const theirs = emptyCounts();
  const checks: Record<string, number> = {};
  for (const stat of (await connection.getStats()).values()) {
    if (stat.type === 'remote-candidate' && stat.candidateType in theirs) theirs[stat.candidateType as CandidateType]++;
    if (stat.type === 'candidate-pair') checks[stat.state] = (checks[stat.state] ?? 0) + 1;
  }
  return { theirs, checks };
}

const describe = (counts: Record<string, number>) =>
  Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${kind} ${count}`)
    .join(', ') || 'none';

/**
 * Writes the report. `problem` says in plain words what went wrong; `side` is
 * which device this is. Call it before closing the connection, while its
 * statistics can still be read.
 */
export async function connectionReport(details: {
  problem: string;
  side: 'teacher laptop' | 'door device';
  connection?: RTCPeerConnection | null;
  watch?: ConnectionWatch | null;
  peerError?: string;
}): Promise<{ code: string; text: string }> {
  const { problem, side, connection, watch = null, peerError } = details;
  const setup = connectionSetup();
  const code = likelyCause(setup, watch, peerError);
  const lines = [
    `Happy Hallways connection report (${code})`,
    `Problem: ${problem}`,
    `This is the: ${side}`,
    `When: ${new Date().toISOString()}`,
    `App version: ${version}`,
    `Browser: ${navigator.userAgent}`,
    `Online: ${navigator.onLine ? 'yes' : 'no'}`,
    `Matchmaking server: ${setup.matchmakingServer}`,
    `Relay: ${setup.relay}${setup.relayOnly ? ' (relay only, for testing)' : ''}`,
  ];
  if (peerError) lines.push(`Matchmaking error: ${peerError}`);
  if (connection) {
    lines.push(
      `Connection state: ${connection.connectionState}, ICE ${connection.iceConnectionState}, gathering ${connection.iceGatheringState}`,
    );
    try {
      const { theirs, checks } = await routeSummary(connection);
      if (watch) lines.push(`Routes this device found: ${describe(watch.routes)}`);
      lines.push(`Routes the other device sent: ${describe(theirs)}`);
      lines.push(`Route checks: ${describe(checks)}`);
    } catch (error) {
      lines.push(`Couldn't read connection statistics: ${error}`);
    }
  }
  if (watch?.relayErrors.length) lines.push('Relay errors:', ...watch.relayErrors.slice(0, 8).map((line) => `  ${line}`));
  return { code, text: lines.join('\n') };
}
