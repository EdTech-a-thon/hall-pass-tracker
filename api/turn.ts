/**
 * Hands the browser short-lived logins for Cloudflare's relay (TURN) servers.
 * When a school network blocks a direct connection between two devices, the
 * encrypted data is passed through the relay instead; the relay can't read it.
 *
 * The long-lived Cloudflare token (TURN_KEY_ID, TURN_KEY_API_TOKEN) stays here
 * on the server; the browser only ever sees logins that expire on their own.
 * Runs as a Vercel function in production, and inside `vite dev` locally.
 */
const loginHours = 12;

export async function GET(): Promise<Response> {
  const { TURN_KEY_ID, TURN_KEY_API_TOKEN } = process.env;
  if (!TURN_KEY_ID || !TURN_KEY_API_TOKEN)
    return Response.json({ error: 'Relay is not set up' }, { status: 503 });

  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TURN_KEY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: loginHours * 60 * 60 }),
    },
  );
  if (!response.ok)
    return Response.json({ error: 'Relay did not answer' }, { status: 502 });

  const { iceServers } = (await response.json()) as {
    iceServers: RTCIceServer[];
  };
  return Response.json(
    { iceServers: [iceServers].flat().map(withoutPort53) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Browsers refuse port 53 (it's reserved for DNS), so waiting on it only slows connecting. */
function withoutPort53(server: RTCIceServer): RTCIceServer {
  return {
    ...server,
    urls: [server.urls].flat().filter((url) => !/:53(\?|$)/.test(url)),
  };
}
