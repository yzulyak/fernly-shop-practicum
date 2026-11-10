import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:8100';
const WEB_URL = process.env.WEB_URL || 'http://localhost:5173';

const includeVisual = Boolean(process.env.CI || process.env.VISUAL);

export default defineConfig({
  expect: {
    toHaveScreenshot: {
      // No pixel tolerance — a tolerance can hide a small defect.
      animations: 'disabled',
      maxDiffPixels: 0,
      maxDiffPixelRatio: 0,
      threshold: 0,
    },
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    [
      './tests/a11y/reporter.ts',
      {
        outputFolder: 'a11y-report',
        baseline: 'a11y-baseline.json',
        title: 'Fernly accessibility',
      },
    ],
  ],
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
    ...(includeVisual
      ? [
          {
            name: 'visual',
            testDir: 'tests/visual',
            use: {
              baseURL: WEB_URL,
              ...devices['Desktop Chrome'],
              viewport: { width: 1280, height: 800 },
            },
            dependencies: ['setup'],
          },
        ]
      : []),
  ],
});
