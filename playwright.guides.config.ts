import { defineConfig } from '@playwright/test';

/**
 * Takes the screenshots for the Guides (`bun run guides:screenshots`), apart
 * from the tests so they only change when someone asks for new pictures.
 */
export default defineConfig({
  testDir: 'scripts/guides',
  timeout: 90_000,
  use: { baseURL: 'http://localhost:8000', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  webServer: { command: 'bun run dev', url: 'http://localhost:8000', reuseExistingServer: true },
});
