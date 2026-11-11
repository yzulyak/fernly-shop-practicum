import { test, expect } from '@playwright/test';
import { BrowsePage, PlantPage } from '../pages';

// executed — browse low-stock badge; OOS notify signed-out; in-stock hides form
// assumed — ask (no tests): second out-of-stock plant for cross-plant email

test('browse card with stock 1–3 shows Only N left under the name', { tag: '@e2e' }, async ({
  page,
}) => {
  const browse = new BrowsePage(page);
  await browse.goto();
  await expect(browse.plantsHeading).toBeVisible();

  // Seed: String of Pearls (pl-pearls) stock 1 — APP-MAP
  await expect(browse.lowStockBadge('String of Pearls', 1)).toBeVisible();
});

test('browse card with stock > 3 has no Only N left badge', { tag: '@e2e' }, async ({ page }) => {
  const browse = new BrowsePage(page);
  await browse.goto();
  await expect(browse.plantsHeading).toBeVisible();

  const monstera = browse.plantCard('Monstera Deliciosa');
  await expect(monstera.getByRole('heading', { name: 'Monstera Deliciosa' })).toBeVisible();
  await expect(monstera.getByText(/Only \d+ left/)).toHaveCount(0);
});

test('browse out-of-stock card shows Out of stock never Only 0 left', { tag: '@e2e' }, async ({
  page,
}) => {
  const browse = new BrowsePage(page);
  await browse.goto();
  // Chinese Money Plant may be past first page — search or paginate via URL/query if needed
  await page.goto('/?search=Chinese+Money');
  await expect(browse.outOfStock('Chinese Money Plant')).toBeVisible();
  await expect(browse.plantCard('Chinese Money Plant').getByText('Only 0 left')).toHaveCount(0);
});

test('signed-out visitor can notify on out-of-stock plant page', { tag: '@e2e' }, async ({
  page,
}) => {
  const plant = new PlantPage(page);
  await plant.goto('pl-pilea');
  await expect(plant.heading).toBeVisible();
  await expect(plant.notifyEmail).toBeVisible();
  await expect(plant.notifyMeButton).toBeVisible();

  const email = `e2e-notify-${Date.now()}@example.com`;
  await plant.notifyEmail.fill(email);
  await plant.notifyMeButton.click();

  await expect(plant.notifyStatus).toContainText(`We'll email ${email}`);
  await expect(plant.notifyStatus).toContainText('when');
  await expect(plant.notifyStatus).toContainText('is back');
});

test('in-stock plant page does not show notify form', { tag: '@e2e' }, async ({ page }) => {
  const plant = new PlantPage(page);
  await plant.goto('pl-monstera');
  await expect(plant.heading).toBeVisible();
  await expect(plant.notifyEmail).toHaveCount(0);
  await expect(plant.notifyMeButton).toHaveCount(0);
});
