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
    }),
  ],
  // CF_BEACON_TOKEN (set in the hosting environment or .env.local) turns on
  // Cloudflare Web Analytics; without it no analytics script loads.
  envPrefix: ['VITE_', 'CF_BEACON_TOKEN'],
  server: {
    allowedHosts: ['.exe.xyz', '.edtechathon.com'],
  },
});
