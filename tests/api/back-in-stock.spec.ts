import { test, expect, type APIRequestContext } from '@playwright/test';
import { expectSchema } from '../helpers/schema';

const PASSWORD = 'Fernly-Test-2026';
const OOS_PLANT = 'pl-pilea';
const IN_STOCK_PLANT = 'pl-monstera';

type NotifyResult = {
  status: string;
  plantId: string;
  email: string;
};

type ErrorBody = {
  detail?: string;
  rule?: string;
};

function uniqueEmail(label: string): string {
  return `shopper-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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

async function notify(
  request: APIRequestContext,
  plantId: string,
  email: string,
  headers?: Record<string, string>,
) {
  const response = await request.post(`/api/plants/${plantId}/notify`, {
    headers,
    data: { email },
  });
  const body = (await response.json()) as NotifyResult & ErrorBody;
  return { status: response.status(), body };
}

// executed — POST /api/plants/{plantId}/notify privacy, validation, duplicates, in_stock, 404
// assumed — ask (no tests): second out-of-stock plant; exact invalid-email detail copy

test('unsigned POST notify for out-of-stock plant → 201 NotifyResult', { tag: '@api' }, async ({
  request,
}) => {
  const email = uniqueEmail('unsigned');
  const { status, body } = await notify(request, OOS_PLANT, email);
  expect(status).toBe(201);
  await expectSchema(request, body, 'NotifyResult');
  expect(body.status).toBe('subscribed');
  expect(body.plantId).toBe(OOS_PLANT);
  expect(body.email).toBe(email);
});

test('notify with a valid session still succeeds (no account required)', { tag: '@api' }, async ({
  request,
}) => {
  const { token } = await register(request, 'Notify Session');
  const email = uniqueEmail('session');
  const { status, body } = await notify(request, OOS_PLANT, email, {
    Authorization: `Bearer ${token}`,
  });
  expect(status).toBe(201);
  await expectSchema(request, body, 'NotifyResult');
  expect(body.status).toBe('subscribed');
  expect(body.plantId).toBe(OOS_PLANT);
  expect(body.email).toBe(email);
});

test('full address name@example.com → 201', { tag: '@api' }, async ({ request }) => {
  const email = `name-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  const { status, body } = await notify(request, OOS_PLANT, email);
  expect(status).toBe(201);
  await expectSchema(request, body, 'NotifyResult');
  expect(body.email).toBe(email);
});

test('incomplete email a@b → 400 validation_error', { tag: '@api' }, async ({ request }) => {
  test.fail(true, 'F-18: incomplete notify emails (a@b, name@) are accepted');
  const { status, body } = await notify(request, OOS_PLANT, 'a@b');
  expect(status).toBe(400);
  expect(body.rule).toBe('validation_error');
  await expectSchema(request, body, 'Error');
});

test('incomplete email name@ → 400 validation_error', { tag: '@api' }, async ({ request }) => {
  test.fail(true, 'F-18: incomplete notify emails (a@b, name@) are accepted');
  const { status, body } = await notify(request, OOS_PLANT, 'name@');
  expect(status).toBe(400);
  expect(body.rule).toBe('validation_error');
  await expectSchema(request, body, 'Error');
});

test('whitespace-trimmed valid email accepted', { tag: '@api' }, async ({ request }) => {
  const raw = `  trim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com  `;
  const { status, body } = await notify(request, OOS_PLANT, raw);
  expect(status).toBe(201);
  await expectSchema(request, body, 'NotifyResult');
  expect(body.email).toBe(raw.trim());
});

test('empty email → 400 validation_error', { tag: '@api' }, async ({ request }) => {
  const { status, body } = await notify(request, OOS_PLANT, '');
  expect(status).toBe(400);
  expect(body.rule).toBe('validation_error');
  await expectSchema(request, body, 'Error');
});

test('missing email → 400 validation_error', { tag: '@api' }, async ({ request }) => {
  const response = await request.post(`/api/plants/${OOS_PLANT}/notify`, {
    data: {},
  });
  expect(response.status()).toBe(400);
  const body = (await response.json()) as ErrorBody;
  expect(body.rule).toBe('validation_error');
  await expectSchema(request, body, 'Error');
});

test('first sign-up → 201; same email again → 409 already_subscribed', { tag: '@api' }, async ({
  request,
}) => {
  test.fail(true, 'F-19: duplicate notify sign-ups are accepted (including case variants)');
  const email = uniqueEmail('dup');
  const first = await notify(request, OOS_PLANT, email);
  expect(first.status).toBe(201);
  await expectSchema(request, first.body, 'NotifyResult');

  const second = await notify(request, OOS_PLANT, email);
  expect(second.status).toBe(409);
  expect(second.body.rule).toBe('already_subscribed');
  expect(second.body.detail).toBe("You're already on the list");
  await expectSchema(request, second.body, 'Error');
});

test('same address different case → 409 already_subscribed', { tag: '@api' }, async ({ request }) => {
  test.fail(true, 'F-19: duplicate notify sign-ups are accepted (including case variants)');
  const local = `ava-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const first = await notify(request, OOS_PLANT, `${local}@example.com`);
  expect(first.status).toBe(201);

  const mixed = `${local.toUpperCase()}@Example.COM`;
  const again = await notify(request, OOS_PLANT, mixed);
  expect(again.status).toBe(409);
  expect(again.body.rule).toBe('already_subscribed');
  await expectSchema(request, again.body, 'Error');
});

test('in-stock plant → 400 in_stock', { tag: '@api' }, async ({ request }) => {
  const { status, body } = await notify(request, IN_STOCK_PLANT, uniqueEmail('instock'));
  expect(status).toBe(400);
  expect(body.rule).toBe('in_stock');
  expect(String(body.detail ?? '')).toMatch(/in stock/i);
  await expectSchema(request, body, 'Error');
});

test('unknown plantId → 404', { tag: '@api' }, async ({ request }) => {
  const response = await request.post('/api/plants/pl-missing-notify/notify', {
    data: { email: uniqueEmail('missing') },
  });
  expect(response.status()).toBe(404);
});
