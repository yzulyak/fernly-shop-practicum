import { test, expect } from '@playwright/test';
import { formatBlockingMessage } from './baseline';
import { scanPage } from './helpers/scan';
import { BrowsePage, PlantPage } from '../pages';

// executed — axe on browse with low-stock card; axe on OOS plant with notify form; keyboard to Notify me
// Do not edit a11y-baseline.json

test('Browse with a low-stock card visible has no new blocking a11y violations', { tag: '@a11y' }, async ({
  page,
}, testInfo) => {
  test.fail(true, 'F-07: save buttons unnamed; F-08: PriceTag contrast fails');
  const browse = new BrowsePage(page);
  await browse.goto();
  await expect(browse.plantsHeading).toBeVisible();
  // Seed stock 1: String of Pearls — may need search if not on first page
  await page.goto('/?search=String+of+Pearls');
  await expect(browse.lowStockBadge('String of Pearls', 1)).toBeVisible();

  const { blocking } = await scanPage(page, testInfo, { name: 'Browse' });
  expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
});

test('Out-of-stock plant page notify form has no new blocking a11y violations', { tag: '@a11y' }, async ({
  page,
}, testInfo) => {
  test.fail(true, 'F-08: PriceTag contrast fails; F-09: plant hero image has no alt');
  const plant = new PlantPage(page);
  await plant.goto('pl-pilea');
  await expect(plant.heading).toBeVisible();
  await expect(plant.notifyEmail).toBeVisible();
  await expect(plant.notifyMeButton).toBeVisible();

  const { blocking } = await scanPage(page, testInfo, { name: 'Plant' });
  expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
});

test('keyboard reaches notify email field and Notify me on out-of-stock plant', { tag: '@a11y' }, async ({
  page,
}) => {
  const plant = new PlantPage(page);
  await plant.goto('pl-pilea');
  await expect(plant.notifyEmail).toBeVisible();

  await plant.notifyEmail.focus();
  await expect(plant.notifyEmail).toBeFocused();
  // Notify me is disabled while empty — type so the control is keyboard-reachable
  await plant.notifyEmail.fill(`a11y-notify-${Date.now()}@example.com`);
  await expect(plant.notifyMeButton).toBeEnabled();

  await page.keyboard.press('Tab');
  await expect(plant.notifyMeButton).toBeFocused();
});
