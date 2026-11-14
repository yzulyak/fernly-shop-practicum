import { test, expect } from '@playwright/test';
import { BrowsePage } from '../pages';

test('choosing Price: high to low shows the most expensive plant first', { tag: '@e2e' }, async ({
  page,
}) => {
  test.fail(true, 'F-13: price-desc sorts cheapest first');
  const browse = new BrowsePage(page);
  await browse.goto();

  await browse.sortPriceHighToLow();

  await expect(browse.plantsHeading).toBeVisible();

  await expect(browse.firstPlantHeading).toHaveText(
    "Variegated Thai Constellation Monstera (Collector's Edition, Limited Greenhouse Batch)",
  );
});
