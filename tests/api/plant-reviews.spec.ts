import { test, expect, type APIRequestContext } from '@playwright/test';
import { expectSchema } from '../helpers/schema';

const PASSWORD = 'Fernly-Test-2026';

async function register(
  request: APIRequestContext,
  name: string,
): Promise<{ token: string; name: string; email: string }> {
  const email = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@fernly.test`;
  const response = await request.post('/api/auth/register', {
    data: { name, email, password: PASSWORD },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { token: string; user: { name: string } };
  return { token: body.token, name: body.user.name, email };
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// executed — POST /api/plants/{plantId}/reviews auth, ownership delete, uniqueness, validation, GET list
// Plant ids are partitioned so mutating cases do not collide (file runs in order).

test('signed-in customer posts a review → 201 Review with their name', { tag: '@api' }, async ({
  request,
}) => {
  const user = await register(request, 'Review Poster');
  const response = await request.post('/api/plants/pl-spider/reviews', {
    headers: authHeaders(user.token),
    data: { rating: 5, text: 'A lovely spider plant for my shelf.' },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { author: string; rating: number; text: string };
  await expectSchema(request, body, 'Review');
  expect(body.author).toBe(user.name);
  expect(body.rating).toBe(5);
  expect(body.text).toBe('A lovely spider plant for my shelf.');
});

test('POST review without token → 401 auth_required', { tag: '@api' }, async ({ request }) => {
  const response = await request.post('/api/plants/pl-zz/reviews', {
    data: { rating: 4, text: 'Trying to review without signing in.' },
  });
  expect(response.status()).toBe(401);
  const body = (await response.json()) as { rule?: string };
  expect(body.rule).toBe('auth_required');
  await expectSchema(request, body, 'Error');
});

test('POST review for unknown plant → 404', { tag: '@api' }, async ({ request }) => {
  const user = await register(request, 'Missing Plant Poster');
  const response = await request.post('/api/plants/pl-missing/reviews', {
    headers: authHeaders(user.token),
    data: { rating: 3, text: 'Review for a plant that does not exist.' },
  });
  expect(response.status()).toBe(404);
});

test('author deletes own review → 204 and GET no longer includes it', { tag: '@api' }, async ({
  request,
}) => {
  const user = await register(request, 'Review Author');
  const created = await request.post('/api/plants/pl-peace-lily/reviews', {
    headers: authHeaders(user.token),
    data: { rating: 4, text: 'Peace lily looking great so far.' },
  });
  expect(created.status()).toBe(201);
  const review = (await created.json()) as { id: string };

  const del = await request.delete(`/api/reviews/${review.id}`, {
    headers: authHeaders(user.token),
  });
  expect(del.status()).toBe(204);

  const list = await request.get('/api/plants/pl-peace-lily/reviews');
  expect(list.status()).toBe(200);
  const body = (await list.json()) as { reviews: Array<{ id: string }> };
  expect(body.reviews.map((r) => r.id)).not.toContain(review.id);
});

test('DELETE review without token → 401 auth_required', { tag: '@api' }, async ({ request }) => {
  const user = await register(request, 'Tokenless Delete');
  const created = await request.post('/api/plants/pl-calathea/reviews', {
    headers: authHeaders(user.token),
    data: { rating: 5, text: 'Calathea review before delete attempt.' },
  });
  expect(created.status()).toBe(201);
  const review = (await created.json()) as { id: string };

  const del = await request.delete(`/api/reviews/${review.id}`);
  expect(del.status()).toBe(401);
  const body = (await del.json()) as { rule?: string };
  expect(body.rule).toBe('auth_required');
  await expectSchema(request, body, 'Error');
});

test('other signed-in customer cannot delete a review → 404', { tag: '@api' }, async ({
  request,
}) => {
  test.fail(true, 'F-03: any signed-in customer can delete another customer’s review');
  const author = await register(request, 'Keep My Review');
  const other = await register(request, 'Other Customer');
  const created = await request.post('/api/plants/pl-boston-fern/reviews', {
    headers: authHeaders(author.token),
    data: { rating: 5, text: 'Fern review that must stay mine only.' },
  });
  expect(created.status()).toBe(201);
  const review = (await created.json()) as { id: string };

  const del = await request.delete(`/api/reviews/${review.id}`, {
    headers: authHeaders(other.token),
  });
  expect(del.status()).toBe(404);
  const body = (await del.json()) as { detail: string };
  expect(body.detail.toLowerCase()).toContain('review');
  expect(body.detail.toLowerCase()).toContain('not found');

  const list = await request.get('/api/plants/pl-boston-fern/reviews');
  const listed = (await list.json()) as { reviews: Array<{ id: string }> };
  expect(listed.reviews.map((r) => r.id)).toContain(review.id);
});

test('DELETE unknown review id → 404', { tag: '@api' }, async ({ request }) => {
  const user = await register(request, 'Unknown Delete');
  const del = await request.delete('/api/reviews/rv-missing', {
    headers: authHeaders(user.token),
  });
  expect(del.status()).toBe(404);
});

test('first POST → 201; second same user+plant → 409 already_reviewed', { tag: '@api' }, async ({
  request,
}) => {
  const user = await register(request, 'Once Only');
  const first = await request.post('/api/plants/pl-rubber/reviews', {
    headers: authHeaders(user.token),
    data: { rating: 4, text: 'First rubber plant review text.' },
  });
  expect(first.status()).toBe(201);

  const second = await request.post('/api/plants/pl-rubber/reviews', {
    headers: authHeaders(user.token),
    data: { rating: 5, text: 'Second rubber plant review text.' },
  });
  expect(second.status()).toBe(409);
  const body = (await second.json()) as { rule?: string };
  expect(body.rule).toBe('already_reviewed');
  await expectSchema(request, body, 'Error');
});

test('same user can still review a different plant', { tag: '@api' }, async ({ request }) => {
  const user = await register(request, 'Multi Plant');
  const first = await request.post('/api/plants/pl-aloe/reviews', {
    headers: authHeaders(user.token),
    data: { rating: 4, text: 'Aloe review number one text.' },
  });
  expect(first.status()).toBe(201);

  const otherPlant = await request.post('/api/plants/pl-pearls/reviews', {
    headers: authHeaders(user.token),
    data: { rating: 5, text: 'Pearls review as a second plant.' },
  });
  expect(otherPlant.status()).toBe(201);
  await expectSchema(request, await otherPlant.json(), 'Review');
});

test('rating 1 and 5 with text length 10 and 500 → 201', { tag: '@api' }, async ({ request }) => {
  const userA = await register(request, 'Bound Low');
  const userB = await register(request, 'Bound High');

  const low = await request.post('/api/plants/pl-pothos/reviews', {
    headers: authHeaders(userA.token),
    data: { rating: 1, text: '0123456789' },
  });
  expect(low.status()).toBe(201);
  await expectSchema(request, await low.json(), 'Review');

  const high = await request.post('/api/plants/pl-snake/reviews', {
    headers: authHeaders(userB.token),
    data: { rating: 5, text: 'x'.repeat(500) },
  });
  expect(high.status()).toBe(201);
  await expectSchema(request, await high.json(), 'Review');
});

test('rating 0 → 400 validation_error', { tag: '@api' }, async ({ request }) => {
  const user = await register(request, 'Bad Rating Zero');
  const response = await request.post('/api/plants/pl-zz/reviews', {
    headers: authHeaders(user.token),
    data: { rating: 0, text: 'Valid length text for rating zero.' },
  });
  expect(response.status()).toBe(400);
  const body = (await response.json()) as { rule?: string };
  expect(body.rule).toBe('validation_error');
  await expectSchema(request, body, 'Error');
});

test('rating 6 → 400 validation_error', { tag: '@api' }, async ({ request }) => {
  const user = await register(request, 'Bad Rating Six');
  const response = await request.post('/api/plants/pl-zz/reviews', {
    headers: authHeaders(user.token),
    data: { rating: 6, text: 'Valid length text for rating six.' },
  });
  expect(response.status()).toBe(400);
  const body = (await response.json()) as { rule?: string };
  expect(body.rule).toBe('validation_error');
  await expectSchema(request, body, 'Error');
});

test('rating 1.5 → 400 validation_error', { tag: '@api' }, async ({ request }) => {
  const user = await register(request, 'Bad Rating Float');
  const response = await request.post('/api/plants/pl-zz/reviews', {
    headers: authHeaders(user.token),
    data: { rating: 1.5, text: 'Valid length text for float rating.' },
  });
  expect(response.status()).toBe(400);
  const body = (await response.json()) as { rule?: string };
  expect(body.rule).toBe('validation_error');
  await expectSchema(request, body, 'Error');
});

test('text 9 chars → 400 validation_error', { tag: '@api' }, async ({ request }) => {
  const user = await register(request, 'Short Text');
  const response = await request.post('/api/plants/pl-zz/reviews', {
    headers: authHeaders(user.token),
    data: { rating: 3, text: '123456789' },
  });
  expect(response.status()).toBe(400);
  const body = (await response.json()) as { rule?: string };
  expect(body.rule).toBe('validation_error');
  await expectSchema(request, body, 'Error');
});

test('empty body → 400 validation_error', { tag: '@api' }, async ({ request }) => {
  const user = await register(request, 'Empty Body');
  const response = await request.post('/api/plants/pl-zz/reviews', {
    headers: authHeaders(user.token),
    data: {},
  });
  expect(response.status()).toBe(400);
  const body = (await response.json()) as { rule?: string };
  expect(body.rule).toBe('validation_error');
  await expectSchema(request, body, 'Error');
});

test('text that trims to under 10 → 400 validation_error', { tag: '@api' }, async ({
  request,
}) => {
  const user = await register(request, 'Trim Short');
  const response = await request.post('/api/plants/pl-zz/reviews', {
    headers: authHeaders(user.token),
    data: { rating: 3, text: '  short   ' },
  });
  expect(response.status()).toBe(400);
  const body = (await response.json()) as { rule?: string };
  expect(body.rule).toBe('validation_error');
  await expectSchema(request, body, 'Error');
});

test('text with surrounding spaces that trims to valid → 201', { tag: '@api' }, async ({
  request,
}) => {
  const user = await register(request, 'Trim Valid');
  // pl-hoya: leave pl-monstera seed reviews alone for the e2e newest-first case.
  const response = await request.post('/api/plants/pl-hoya/reviews', {
    headers: authHeaders(user.token),
    data: { rating: 4, text: '   trimmed enough text   ' },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { text: string };
  await expectSchema(request, body, 'Review');
  expect(body.text).toBe('trimmed enough text');
});

test('GET seed reviews → 200 ReviewList newest first; count matches', { tag: '@api' }, async ({
  request,
}) => {
  const response = await request.get('/api/plants/pl-monstera/reviews');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    average: number;
    count: number;
    reviews: Array<{ createdAt: string }>;
  };
  await expectSchema(request, body, 'ReviewList');
  expect(body.count).toBe(body.reviews.length);
  expect(body.count).toBeGreaterThan(0);
  for (let i = 0; i < body.reviews.length - 1; i += 1) {
    expect(Date.parse(body.reviews[i].createdAt)).toBeGreaterThanOrEqual(
      Date.parse(body.reviews[i + 1].createdAt),
    );
  }
});

test('GET reviews for unknown plant → 404', { tag: '@api' }, async ({ request }) => {
  const response = await request.get('/api/plants/pl-missing/reviews');
  expect(response.status()).toBe(404);
});

test('plant with no reviews → average 0, count 0, empty reviews', { tag: '@api' }, async ({
  request,
}) => {
  // pl-zz stays empty: only failed validation POSTs target it above.
  const response = await request.get('/api/plants/pl-zz/reviews');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    average: number;
    count: number;
    reviews: unknown[];
  };
  await expectSchema(request, body, 'ReviewList');
  expect(body.average).toBe(0);
  expect(body.count).toBe(0);
  expect(body.reviews).toEqual([]);
});

test('average for ratings 5, 4, 5 → 4.7 (one decimal, halves up)', { tag: '@api' }, async ({
  request,
}) => {
  test.fail(true, 'F-04: review average for 5, 4, 5 is 4.6 instead of 4.7');
  const plantId = 'pl-fiddle';
  const ratings = [5, 4, 5] as const;
  for (const [index, rating] of ratings.entries()) {
    const user = await register(request, `Avg Rater ${index}`);
    const posted = await request.post(`/api/plants/${plantId}/reviews`, {
      headers: authHeaders(user.token),
      data: { rating, text: `Average probe review number ${index + 1}.` },
    });
    expect(posted.status()).toBe(201);
  }

  const response = await request.get(`/api/plants/${plantId}/reviews`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { average: number; count: number };
  await expectSchema(request, body, 'ReviewList');
  expect(body.count).toBe(3);
  expect(body.average).toBe(4.7);
});
