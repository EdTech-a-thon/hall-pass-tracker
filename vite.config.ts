import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  build: {
    target: 'es2022',
  },
  server: {
    allowedHosts: ['.exe.xyz', '.edtechathon.com'],
  },
});
