import { test, expect, type Page } from '@playwright/test';

const PASSWORD = 'Fernly-Test-2026';

async function registerAndLandOnShop(page: Page, name: string): Promise<string> {
  const email = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@fernly.test`;
  await page.goto('/register');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  return email;
}

// executed — plant page reviews happy path, guest gating, duplicate refusal, seed order

test('sign in, post a valid review, see toast and updated list', { tag: '@e2e' }, async ({
  page,
}) => {
  const plantId = 'pl-zz';
  const reviewText = 'E2E posted review for the ZZ plant.';

  await registerAndLandOnShop(page, 'E2E Reviewer');
  await page.goto(`/plants/${plantId}`);
  await expect(page.getByRole('heading', { level: 2, name: 'Reviews' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Write a review' })).toBeVisible();

  await page.getByRole('radio', { name: '5 stars' }).click();
  await page.getByLabel('Your review').fill(reviewText);
  await page.getByRole('button', { name: 'Post review' }).click();

  await expect(page.getByText('Thanks for your review!')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Reviews' })).toContainText(reviewText);
  await expect(page.getByRole('region', { name: 'Reviews' })).toContainText(/5\.0 out of 5 · 1 review/);
});

test('guest on plant page sees sign-in link, not the form', { tag: '@e2e' }, async ({ page }) => {
  await page.goto('/plants/pl-monstera');
  await expect(page.getByRole('heading', { level: 2, name: 'Reviews' })).toBeVisible();

  const reviews = page.getByRole('region', { name: 'Reviews' });
  await expect(reviews.getByRole('heading', { name: 'Write a review' })).toHaveCount(0);
  await expect(reviews.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/login?next=/plants/pl-monstera',
  );
  await expect(reviews).toContainText(/to write a review/i);
});

test('second review on the same plant is refused', { tag: '@e2e' }, async ({ page }) => {
  const plantId = 'pl-fiddle';
  await registerAndLandOnShop(page, 'E2E Duplicate');
  await page.goto(`/plants/${plantId}`);

  await page.getByRole('radio', { name: '4 stars' }).click();
  await page.getByLabel('Your review').fill('First fiddle review from e2e flow.');
  await page.getByRole('button', { name: 'Post review' }).click();
  await expect(page.getByText('Thanks for your review!')).toBeVisible();

  await page.goto(`/plants/${plantId}`);
  await expect(page.getByRole('heading', { level: 3, name: 'Write a review' })).toBeVisible();
  await page.getByRole('radio', { name: '5 stars' }).click();
  await page.getByLabel('Your review').fill('Second fiddle review should be refused.');
  await page.getByRole('button', { name: 'Post review' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Thanks for your review!')).toHaveCount(0);
});

test('plant with seed reviews shows newest first', { tag: '@e2e' }, async ({ page }) => {
  await page.goto('/plants/pl-monstera');
  await expect(page.getByRole('heading', { level: 2, name: 'Reviews' })).toBeVisible();

  const items = page.getByRole('region', { name: 'Reviews' }).getByRole('listitem');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Leo M.');
  await expect(items.nth(1)).toContainText('Priya S.');
});
