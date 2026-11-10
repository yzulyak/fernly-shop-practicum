import { test, expect } from '@playwright/test';

test('choosing Price: high to low shows the most expensive plant first', { tag: '@e2e' }, async ({
  page,
}) => {
  await page.goto('/');

  await page.getByLabel('Sort by').selectOption({ label: 'Price: high to low' });

  await expect(page.getByRole('heading', { level: 2, name: /\d+ plants/ })).toBeVisible();

  const firstPlant = page.getByRole('list').getByRole('listitem').first().getByRole('heading', {
    level: 3,
  });
  await expect(firstPlant).toHaveText(
    "Variegated Thai Constellation Monstera (Collector's Edition, Limited Greenhouse Batch)",
  );
});
