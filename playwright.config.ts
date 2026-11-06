import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:8100';
const WEB_URL = process.env.WEB_URL || 'http://localhost:5173';

export default defineConfig({
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: [
    {
      command: 'npm run start:api',
      url: 'http://localhost:8100/api/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run start:web',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: 'setup',
      testDir: 'tests',
      testMatch: /reset\.setup\.ts/,
      use: { baseURL: API_URL },
    },
    {
      name: 'api',
      testDir: 'tests/api',
      use: { baseURL: API_URL },
      dependencies: ['setup'],
    },
    {
      name: 'e2e',
      testDir: 'tests/e2e',
      use: { baseURL: WEB_URL },
      dependencies: ['setup'],
    },
    {
      name: 'a11y',
      testDir: 'tests/a11y',
      use: { baseURL: WEB_URL },
      dependencies: ['setup'],
    },
  ],
});
