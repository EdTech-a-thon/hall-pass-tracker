import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  use: { baseURL: 'http://localhost:8000' },
  webServer: { command: 'bun run dev', url: 'http://localhost:8000', reuseExistingServer: true },
});
