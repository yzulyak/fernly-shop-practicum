import { test, expect, type APIRequestContext } from '@playwright/test';
import { expectSchema } from '../helpers/schema';

const PASSWORD = 'Fernly-Test-2026';

type CartBody = {
  subtotal: number;
  shipping: number;
  discount: number;
  promoCode: string | null;
  total: number;
  itemCount: number;
  lines: unknown[];
};

function cents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function register(
  request: APIRequestContext,
  name: string,
): Promise<{ token: string }> {
  const email = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@fernly.test`;
  const response = await request.post('/api/auth/register', {
    data: { name, email, password: PASSWORD },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { token: string };
  return { token: body.token };
}

async function addLine(
  request: APIRequestContext,
  token: string,
  plantId: string,
  quantity = 1,
): Promise<CartBody> {
  const response = await request.post('/api/cart/lines', {
    headers: authHeaders(token),
    data: { plantId, size: 'S', quantity },
  });
  expect(response.status()).toBe(200);
  const cart = (await response.json()) as CartBody;
  await expectSchema(request, cart, 'Cart');
  return cart;
}

async function applyPromo(
  request: APIRequestContext,
  token: string,
  code: string,
): Promise<{ status: number; body: CartBody & { detail?: string; rule?: string } }> {
  const response = await request.post('/api/cart/promo', {
    headers: authHeaders(token),
    data: { code },
  });
  const body = (await response.json()) as CartBody & { detail?: string; rule?: string };
  return { status: response.status(), body };
}

// executed — POST/DELETE /api/cart/promo, cart/order promo fields, percent vs free-shipping rules

test('LEAFY10 on a non-empty cart → 10% of plant subtotal only; Cart schema', { tag: '@api' }, async ({
  request,
}) => {
  test.fail(true, 'F-14: percent promo discounts subtotal + shipping, not plants only');
  const { token } = await register(request, 'Promo Leafy');
  const before = await addLine(request, token, 'pl-monstera');
  expect(before.promoCode).toBeNull();
  expect(before.discount).toBe(0);

  const { status, body } = await applyPromo(request, token, 'LEAFY10');
  expect(status).toBe(200);
  await expectSchema(request, body, 'Cart');
  expect(body.promoCode).toBe('LEAFY10');
  expect(body.discount).toBe(cents(before.subtotal * 0.1));
  expect(body.discount).not.toBe(cents((before.subtotal + before.shipping) * 0.1));
  expect(body.shipping).toBe(before.shipping);
  expect(body.total).toBe(cents(body.subtotal - body.discount + body.shipping));
});

test('unknown promo code → 400 promo_invalid', { tag: '@api' }, async ({ request }) => {
  const { token } = await register(request, 'Promo Unknown');
  await addLine(request, token, 'pl-snake');
  const { status, body } = await applyPromo(request, token, 'NOTACODE');
  expect(status).toBe(400);
  expect(body.rule).toBe('promo_invalid');
  await expectSchema(request, body, 'Error');
});

test('lowercase leafy10 applies like LEAFY10', { tag: '@api' }, async ({ request }) => {
  test.fail(true, 'F-14: percent promo discounts subtotal + shipping, not plants only');
  const { token } = await register(request, 'Promo Lower');
  const before = await addLine(request, token, 'pl-snake');
  const { status, body } = await applyPromo(request, token, 'leafy10');
  expect(status).toBe(200);
  await expectSchema(request, body, 'Cart');
  expect(body.promoCode).toBe('LEAFY10');
  expect(body.discount).toBe(cents(before.subtotal * 0.1));
});

test('FREESHIP under $50 → shipping 0, discount 0', { tag: '@api' }, async ({ request }) => {
  const { token } = await register(request, 'Promo Freeship');
  const before = await addLine(request, token, 'pl-aloe');
  expect(before.subtotal).toBeLessThan(50);
  expect(before.shipping).toBeGreaterThan(0);

  const { status, body } = await applyPromo(request, token, 'FREESHIP');
  expect(status).toBe(200);
  await expectSchema(request, body, 'Cart');
  expect(body.promoCode).toBe('FREESHIP');
  expect(body.shipping).toBe(0);
  expect(body.discount).toBe(0);
  expect(body.total).toBe(cents(body.subtotal - body.discount + body.shipping));
});

test('LEAFY10 on cart ≥ $50 keeps free shipping (threshold before discount)', { tag: '@api' }, async ({
  request,
}) => {
  const { token } = await register(request, 'Promo Threshold');
  // Two Monsteras: 2 × 34.99 = 69.98 ≥ $50 — shipping already free, so percent is plants-only here.
  const before = await addLine(request, token, 'pl-monstera', 2);
  expect(before.subtotal).toBeGreaterThanOrEqual(50);
  expect(before.shipping).toBe(0);

  const { status, body } = await applyPromo(request, token, 'LEAFY10');
  expect(status).toBe(200);
  await expectSchema(request, body, 'Cart');
  expect(body.shipping).toBe(0);
  expect(body.discount).toBe(cents(before.subtotal * 0.1));
  expect(body.total).toBe(cents(body.subtotal - body.discount));
});

test('SPRING5 expired → refused with expired message', { tag: '@api' }, async ({ request }) => {
  test.fail(true, 'F-15: expired SPRING5 is accepted instead of refused');
  const { token } = await register(request, 'Promo Expired');
  await addLine(request, token, 'pl-pothos');
  const { status, body } = await applyPromo(request, token, 'SPRING5');
  expect(status).toBe(400);
  expect(body.rule).toBe('promo_invalid');
  expect(String(body.detail).toLowerCase()).toMatch(/expir/);
  await expectSchema(request, body, 'Error');
});

test('empty cart promo → 400 empty_cart', { tag: '@api' }, async ({ request }) => {
  const { token } = await register(request, 'Promo Empty');
  const { status, body } = await applyPromo(request, token, 'LEAFY10');
  expect(status).toBe(400);
  expect(body.rule).toBe('empty_cart');
  await expectSchema(request, body, 'Error');
});

test('POST promo without token → 401 auth_required', { tag: '@api' }, async ({ request }) => {
  const response = await request.post('/api/cart/promo', { data: { code: 'LEAFY10' } });
  expect(response.status()).toBe(401);
  const body = (await response.json()) as { rule?: string };
  expect(body.rule).toBe('auth_required');
  await expectSchema(request, body, 'Error');
});

test('empty or whitespace promo body → 400 validation_error', { tag: '@api' }, async ({
  request,
}) => {
  const { token } = await register(request, 'Promo Blank');
  await addLine(request, token, 'pl-zz');

  for (const data of [{}, { code: '' }, { code: '   ' }] as const) {
    const response = await request.post('/api/cart/promo', {
      headers: authHeaders(token),
      data,
    });
    expect(response.status(), `body ${JSON.stringify(data)}`).toBe(400);
    const body = (await response.json()) as { rule?: string };
    expect(body.rule, `body ${JSON.stringify(data)}`).toBe('validation_error');
    await expectSchema(request, body, 'Error');
  }
});

test('DELETE promo clears code and discount', { tag: '@api' }, async ({ request }) => {
  const { token } = await register(request, 'Promo Remove');
  await addLine(request, token, 'pl-rubber');
  await applyPromo(request, token, 'FREESHIP');

  const response = await request.delete('/api/cart/promo', { headers: authHeaders(token) });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as CartBody;
  await expectSchema(request, body, 'Cart');
  expect(body.promoCode).toBeNull();
  expect(body.discount).toBe(0);
  expect(body.shipping).toBeGreaterThan(0);
});

test('applying a second code replaces the first', { tag: '@api' }, async ({ request }) => {
  const { token } = await register(request, 'Promo Replace');
  await addLine(request, token, 'pl-peace-lily');
  await applyPromo(request, token, 'LEAFY10');
  const { status, body } = await applyPromo(request, token, 'FREESHIP');
  expect(status).toBe(200);
  await expectSchema(request, body, 'Cart');
  expect(body.promoCode).toBe('FREESHIP');
  expect(body.discount).toBe(0);
  expect(body.shipping).toBe(0);
});

test('DELETE promo when none applied → 200 cart', { tag: '@api' }, async ({ request }) => {
  const { token } = await register(request, 'Promo Delete None');
  await addLine(request, token, 'pl-calathea');
  const response = await request.delete('/api/cart/promo', { headers: authHeaders(token) });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as CartBody;
  await expectSchema(request, body, 'Cart');
  expect(body.promoCode).toBeNull();
  expect(body.discount).toBe(0);
});

test('place order keeps promo; cart forgets promo', { tag: '@api' }, async ({ request }) => {
  const author = await register(request, 'Promo Orderer');
  await addLine(request, author.token, 'pl-spider');
  const applied = await applyPromo(request, author.token, 'FREESHIP');
  expect(applied.status).toBe(200);
  const cart = applied.body;
  expect(cart.promoCode).toBe('FREESHIP');
  expect(cart.shipping).toBe(0);

  const placed = await request.post('/api/orders', {
    headers: authHeaders(author.token),
    data: {
      shippingAddress: {
        fullName: 'Promo Orderer',
        address: '1 Leaf St',
        city: 'Greenville',
        postalCode: '12345',
      },
    },
  });
  expect(placed.status()).toBe(201);
  const order = (await placed.json()) as {
    id: string;
    discount: number;
    promoCode: string | null;
    shipping: number;
    total: number;
  };
  await expectSchema(request, order, 'Order');
  expect(order.promoCode).toBe('FREESHIP');
  expect(order.discount).toBe(cart.discount);
  expect(order.shipping).toBe(0);
  expect(order.total).toBe(cart.total);

  const cartAfter = await request.get('/api/cart', { headers: authHeaders(author.token) });
  expect(cartAfter.status()).toBe(200);
  const empty = (await cartAfter.json()) as CartBody;
  await expectSchema(request, empty, 'Cart');
  expect(empty.lines).toEqual([]);
  expect(empty.promoCode).toBeNull();
  expect(empty.discount).toBe(0);
});

test('other signed-in customer cannot GET an order → 404', { tag: '@api' }, async ({ request }) => {
  test.fail(true, 'F-16: any signed-in customer can read another customer’s order');
  const author = await register(request, 'Promo Owner');
  const other = await register(request, 'Promo Snoop');
  await addLine(request, author.token, 'pl-boston-fern');
  await applyPromo(request, author.token, 'FREESHIP');
  const placed = await request.post('/api/orders', {
    headers: authHeaders(author.token),
    data: {
      shippingAddress: {
        fullName: 'Promo Owner',
        address: '1 Leaf St',
        city: 'Greenville',
        postalCode: '12345',
      },
    },
  });
  expect(placed.status()).toBe(201);
  const order = (await placed.json()) as { id: string };

  const stolen = await request.get(`/api/orders/${order.id}`, {
    headers: authHeaders(other.token),
  });
  expect(stolen.status()).toBe(404);
});

test('GET cart includes discount and promoCode per Cart schema', { tag: '@api' }, async ({
  request,
}) => {
  const { token } = await register(request, 'Promo Schema Cart');
  const response = await request.get('/api/cart', { headers: authHeaders(token) });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as CartBody;
  await expectSchema(request, body, 'Cart');
  expect(body).toHaveProperty('discount');
  expect(body).toHaveProperty('promoCode');
});
