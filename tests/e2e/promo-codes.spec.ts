import { test, expect, type Page } from '@playwright/test';

const PASSWORD = 'Fernly-Test-2026';

async function registerAndLandOnShop(page: Page, name: string): Promise<void> {
  const email = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@fernly.test`;
  await page.goto('/register');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

async function addPlantToCart(page: Page, plantId: string): Promise<void> {
  await page.goto(`/plants/${plantId}`);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('link', { name: /Cart/i })).toContainText('1');
}

// executed — cart promo apply/remove, checkout summary, place order keeps code on order page

test('cart promo code field has a visible accessible name', { tag: '@e2e' }, async ({ page }) => {
  test.fail(true, 'F-10: promo code field has no accessible name or visible label');
  await registerAndLandOnShop(page, 'E2E Promo Label');
  await addPlantToCart(page, 'pl-zz');
  await page.goto('/cart');
  await expect(page.getByLabel(/promo code/i)).toBeVisible();
});

test('cart: apply leafy10 case-insensitive, see discount line; Remove clears', { tag: '@e2e' }, async ({
  page,
}) => {
  test.fail(true, 'F-14: percent promo discounts subtotal + shipping, not plants only');
  await registerAndLandOnShop(page, 'E2E Promo Cart');
  await addPlantToCart(page, 'pl-monstera');
  await page.goto('/cart');

  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
  await expect(page.getByText('Have a promo code?')).toBeVisible();
  const codeField = page.getByRole('textbox');
  await codeField.fill('leafy10');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.getByText(/Discount \(LEAFY10\)/)).toBeVisible();
  // 10% of plant subtotal only (34.99 → 3.50), never shipping
  await expect(page.getByText('−$3.50')).toBeVisible();

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText(/Discount \(LEAFY10\)/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible();
});

test('cart: expired SPRING5 shows expired error', { tag: '@e2e' }, async ({ page }) => {
  test.fail(true, 'F-15: expired SPRING5 is accepted instead of refused');
  await registerAndLandOnShop(page, 'E2E Promo Expired');
  await addPlantToCart(page, 'pl-snake');
  await page.goto('/cart');

  await page.getByRole('textbox').fill('SPRING5');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(/expir/i)).toBeVisible();
});

test('checkout and order retain FREESHIP', { tag: '@e2e' }, async ({ page }) => {
  await registerAndLandOnShop(page, 'E2E Promo Order');
  await addPlantToCart(page, 'pl-aloe');
  await page.goto('/cart');

  await page.getByRole('textbox').fill('FREESHIP');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Code FREESHIP applied')).toBeVisible();
  await expect(page.getByText('Free', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Go to checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order summary' })).toBeVisible();
  await expect(page.getByText('Free', { exact: true })).toBeVisible();

  await page.getByLabel('Full name').fill('E2E Promo Order');
  await page.getByLabel('Street address').fill('2 Fern Way');
  await page.getByLabel('City').fill('Moss City');
  await page.getByLabel('Postal code').fill('90210');
  await page.getByRole('button', { name: 'Place order' }).click();

  await expect(page.getByText('Thank you! Your order is placed.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Paid' })).toBeVisible();
  await expect(page.getByText('Free', { exact: true })).toBeVisible();
});
