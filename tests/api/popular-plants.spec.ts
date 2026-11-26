import { test, expect } from '@playwright/test';
import { expectSchema } from '../helpers/schema';

type PopularPlant = {
  id: string;
  name: string;
  stock: number;
  unitsSold: number;
};

type PopularList = {
  days: number;
  items: PopularPlant[];
};

type ErrorBody = {
  detail?: string;
  rule?: string;
};

// executed — GET /api/popular shape, limit validation, ranking, out-of-stock exclusion, units vs orders

test('GET /api/popular default → 200 PopularList with days 30 and up to 4 items', { tag: '@api' }, async ({
  request,
}) => {
  const response = await request.get('/api/popular');
  expect(response.status()).toBe(200);

  const body = (await response.json()) as PopularList;
  await expectSchema(request, body, 'PopularList');
  expect(body.days).toBe(30);
  expect(body.items.length).toBeGreaterThan(0);
  expect(body.items.length).toBeLessThanOrEqual(4);

  for (const item of body.items) {
    await expectSchema(request, item, 'PopularPlant');
    expect(Number.isInteger(item.unitsSold)).toBe(true);
    expect(item.unitsSold).toBeGreaterThanOrEqual(0);
  }
});

test('GET /api/popular?limit=1 → at most 1 item; limit=12 → at most 12', { tag: '@api' }, async ({
  request,
}) => {
  const one = await request.get('/api/popular', { params: { limit: '1' } });
  expect(one.status()).toBe(200);
  const oneBody = (await one.json()) as PopularList;
  await expectSchema(request, oneBody, 'PopularList');
  expect(oneBody.items.length).toBeLessThanOrEqual(1);

  const twelve = await request.get('/api/popular', { params: { limit: '12' } });
  expect(twelve.status()).toBe(200);
  const twelveBody = (await twelve.json()) as PopularList;
  await expectSchema(request, twelveBody, 'PopularList');
  expect(twelveBody.items.length).toBeLessThanOrEqual(12);
  expect(twelveBody.items.length).toBeGreaterThan(0);
});

test('GET /api/popular?limit=5 → at most 5 items', { tag: '@api' }, async ({ request }) => {
  const response = await request.get('/api/popular', { params: { limit: '5' } });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as PopularList;
  await expectSchema(request, body, 'PopularList');
  expect(body.items.length).toBeLessThanOrEqual(5);
});

test('GET /api/popular?limit=0 → 400 validation_error', { tag: '@api' }, async ({ request }) => {
  const response = await request.get('/api/popular', { params: { limit: '0' } });
  expect(response.status()).toBe(400);
  const body = (await response.json()) as ErrorBody;
  expect(body.rule).toBe('validation_error');
  await expectSchema(request, body, 'Error');
});

test('GET /api/popular?limit=13 → 400 validation_error', { tag: '@api' }, async ({ request }) => {
  const response = await request.get('/api/popular', { params: { limit: '13' } });
  expect(response.status()).toBe(400);
  const body = (await response.json()) as ErrorBody;
  expect(body.rule).toBe('validation_error');
  await expectSchema(request, body, 'Error');
});

test('GET /api/popular?limit=abc → 400 validation_error', { tag: '@api' }, async ({ request }) => {
  const response = await request.get('/api/popular', { params: { limit: 'abc' } });
  expect(response.status()).toBe(400);
  const body = (await response.json()) as ErrorBody;
  expect(body.rule).toBe('validation_error');
  await expectSchema(request, body, 'Error');
});

test('popular items ordered by unitsSold desc; ties by name A→Z', { tag: '@api' }, async ({
  request,
}) => {
  const response = await request.get('/api/popular', { params: { limit: '12' } });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as PopularList;
  expect(body.items.length).toBeGreaterThan(1);

  for (let i = 0; i < body.items.length - 1; i += 1) {
    const a = body.items[i];
    const b = body.items[i + 1];
    expect(a.unitsSold).toBeGreaterThanOrEqual(b.unitsSold);
    if (a.unitsSold === b.unitsSold) {
      expect(a.name.localeCompare(b.name)).toBeLessThanOrEqual(0);
    }
  }
});

test('workshop bulk cuttings rank by units sold, not order count', { tag: '@api' }, async ({
  request,
}) => {
  test.fail(true, 'F-18: popular ranks by order count, not units sold');
  // Seed includes many workshop orders of Succulent Cutting at qty 40.
  // Counting units (not orders) puts Cutting far above single-unit bestsellers.
  const response = await request.get('/api/popular', { params: { limit: '12' } });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as PopularList;

  const cutting = body.items.find((item) => item.id === 'pl-cutting' || /cutting/i.test(item.name));
  expect(cutting, 'Succulent Cutting should appear when units are counted').toBeTruthy();
  expect(cutting!.unitsSold).toBeGreaterThanOrEqual(40 * 50);
  expect(body.items[0].id).toBe(cutting!.id);
});

test('out-of-stock plants are left out of popular', { tag: '@api' }, async ({ request }) => {
  test.fail(true, 'F-19: out-of-stock Chinese Money Plant appears in popular');
  const response = await request.get('/api/popular', { params: { limit: '12' } });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as PopularList;

  for (const item of body.items) {
    expect(item.stock, `${item.name} (${item.id}) must be in stock`).toBeGreaterThan(0);
  }

  const outOfStockNames = body.items.filter(
    (item) => item.id === 'pl-pilea' || /chinese money/i.test(item.name),
  );
  expect(outOfStockNames, 'Chinese Money Plant (stock 0) must not appear').toEqual([]);
});
