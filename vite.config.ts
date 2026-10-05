import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit({
      // Hallway has no server: every page is built into plain files that run in
      // the browser. `fallback` serves index.html for any address, so links such
      // as /classes/abc or /door?code=123456 open the app directly.
      adapter: adapter({ fallback: 'index.html' }),
      // Kiosks and laptops stay open all day. Checking for a new version every
      // few minutes lets an open page refresh itself after an update, so a
      // kiosk and a laptop are never left running different versions for long.
      version: { pollInterval: 5 * 60_000 },
    }),
  ],
  // CF_BEACON_TOKEN (set in the hosting environment or .env.local) turns on
  // Cloudflare Web Analytics; without it no analytics script loads.
  envPrefix: ['VITE_', 'CF_BEACON_TOKEN'],
  server: {
    allowedHosts: ['.exe.xyz', '.edtechathon.com'],
  },
});
