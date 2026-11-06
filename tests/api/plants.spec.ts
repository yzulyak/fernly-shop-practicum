import { test, expect } from '@playwright/test';
import { expectSchema } from '../helpers/schema';

test('a plant matches the Plant schema', { tag: '@api' }, async ({ request }) => {
  const response = await request.get('/api/plants/pl-monstera');
  expect(response.status()).toBe(200);

  const plant: unknown = await response.json();
  await expectSchema(request, plant, 'Plant');
});

test('price-desc returns the most expensive plant first', { tag: '@api' }, async ({ request }) => {
  const response = await request.get('/api/plants', { params: { sort: 'price-desc' } });
  expect(response.status()).toBe(200);

  const body = (await response.json()) as { items: Array<{ price: number; name: string }> };
  expect(body.items.length).toBeGreaterThan(0);

  expect(body.items[0].name).toBe(
    "Variegated Thai Constellation Monstera (Collector's Edition, Limited Greenhouse Batch)",
  );
  expect(body.items[0].price).toBe(189);
});
