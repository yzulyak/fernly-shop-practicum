import { test, expect, type Locator } from '@playwright/test';
import { BrowsePage } from '../pages';

/** Wait until the card image has finished loading (no fixed timeout). */
async function waitForCardImage(card: Locator): Promise<void> {
  const image = card.getByRole('img');
  await expect(image).toBeVisible();
  await expect
    .poll(async () => image.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0))
    .toBe(true);
}

test('catalog first screen', { tag: '@visual' }, async ({ page }) => {
  const browse = new BrowsePage(page);
  await browse.goto();

  await expect(browse.plantsHeading).toBeVisible();
  await expect(browse.firstPlantHeading).toBeVisible();
  await expect(browse.signOutButton).toHaveCount(0);
  await waitForCardImage(browse.plantCard('Monstera Deliciosa'));

  await expect(page).toHaveScreenshot('catalog-first-screen.png');
});

test('Monstera Deliciosa card (plenty in stock)', { tag: '@visual' }, async ({ page }) => {
  const browse = new BrowsePage(page);
  await browse.goto();

  const card = browse.plantCard('Monstera Deliciosa');
  await expect(card).toBeVisible();
  await expect(browse.signOutButton).toHaveCount(0);
  await waitForCardImage(card);

  await expect(card).toHaveScreenshot('monstera-deliciosa-card.png');
});

test('Hoya Carnosa card (few left)', { tag: '@visual' }, async ({ page }) => {
  const browse = new BrowsePage(page);
  await browse.goto();

  // Default page size is 12; Hoya Carnosa is on page 2 of the seed catalog.
  await expect(browse.plantsHeading).toBeVisible();
  await browse.goToNextPage();

  const card = browse.plantCard('Hoya Carnosa');
  await expect(card).toBeVisible();
  await expect(browse.signOutButton).toHaveCount(0);
  await waitForCardImage(card);

  await expect(card).toHaveScreenshot('hoya-carnosa-card.png');
});
