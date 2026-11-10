import { test, expect, type Page } from '@playwright/test';
import { PlantPage, RegisterPage } from '../pages';

const PASSWORD = 'Fernly-Test-2026';

async function registerAndLandOnShop(page: Page, name: string): Promise<string> {
  const email = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@fernly.test`;
  const register = new RegisterPage(page);
  await register.goto();
  const browse = await register.createAccount(name, email, PASSWORD);
  await expect(browse.signOutButton).toBeVisible();
  return email;
}

// executed — plant page reviews happy path, guest gating, duplicate refusal, seed order

test('sign in, post a valid review, see toast and updated list', { tag: '@e2e' }, async ({
  page,
}) => {
  test.fail(true, 'F-05: posted review does not appear in the list until a full reload');
  // pl-bird: unused by API review cases so parallel api/e2e workers do not collide.
  const plantId = 'pl-bird';
  const reviewText = 'E2E posted review for the bird plant.';

  await registerAndLandOnShop(page, 'E2E Reviewer');
  const plant = new PlantPage(page);
  await plant.goto(plantId);
  await expect(plant.reviewsHeading).toBeVisible();
  await expect(plant.writeReviewHeading).toBeVisible();

  await plant.submitReview(5, reviewText);

  await expect(plant.thanksToast).toBeVisible();
  await expect(plant.reviewsRegion).toContainText(reviewText);
  await expect(plant.reviewsRegion).toContainText(/5\.0 out of 5 · 1 review/);
});

test('guest on plant page sees sign-in link, not the form', { tag: '@e2e' }, async ({ page }) => {
  const plant = new PlantPage(page);
  await plant.goto('pl-monstera');
  await expect(plant.reviewsHeading).toBeVisible();

  await expect(plant.writeReviewHeading).toHaveCount(0);
  await expect(plant.signInLink).toHaveAttribute('href', '/login?next=/plants/pl-monstera');
  await expect(plant.reviewsRegion).toContainText(/to write a review/i);
});

test('second review on the same plant is refused', { tag: '@e2e' }, async ({ page }) => {
  // pl-parlor: keep off pl-fiddle (API average) and seed plants used by other cases.
  const plantId = 'pl-parlor';
  await registerAndLandOnShop(page, 'E2E Duplicate');
  const plant = new PlantPage(page);
  await plant.goto(plantId);

  await plant.submitReview(4, 'First parlor review from e2e flow.');
  await expect(plant.thanksToast).toBeVisible();

  await plant.goto(plantId);
  await expect(plant.writeReviewHeading).toBeVisible();
  await plant.submitReview(5, 'Second parlor review should be refused.');

  await expect(plant.alert).toBeVisible();
  await expect(plant.thanksToast).toHaveCount(0);
});

test('plant with seed reviews shows newest first', { tag: '@e2e' }, async ({ page }) => {
  const plant = new PlantPage(page);
  await plant.goto('pl-monstera');
  await expect(plant.reviewsHeading).toBeVisible();

  await expect(plant.reviewItems).toHaveCount(2);
  await expect(plant.reviewItems.nth(0)).toContainText('Leo M.');
  await expect(plant.reviewItems.nth(1)).toContainText('Priya S.');
});
