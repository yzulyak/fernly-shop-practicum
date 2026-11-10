import { test, expect, type Page } from '@playwright/test';
import { CartPage, PlantPage, RegisterPage } from '../pages';

const PASSWORD = 'Fernly-Test-2026';

async function registerAndLandOnShop(page: Page, name: string): Promise<void> {
  const email = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@fernly.test`;
  const register = new RegisterPage(page);
  await register.goto();
  const browse = await register.createAccount(name, email, PASSWORD);
  await expect(browse.signOutButton).toBeVisible();
}

async function addPlantToCart(page: Page, plantId: string): Promise<void> {
  const plant = new PlantPage(page);
  await plant.goto(plantId);
  await plant.addToCart();
  await expect(plant.cartLink).toContainText('1');
}

// executed — cart promo apply/remove, checkout summary, place order keeps code on order page

test('cart promo code field has a visible accessible name', { tag: '@e2e' }, async ({ page }) => {
  test.fail(true, 'F-10: promo code field has no accessible name or visible label');
  await registerAndLandOnShop(page, 'E2E Promo Label');
  await addPlantToCart(page, 'pl-zz');
  const cart = new CartPage(page);
  await cart.goto();
  await expect(cart.promoCodeByLabel).toBeVisible();
});

test('cart: apply leafy10 case-insensitive, see discount line; Remove clears', { tag: '@e2e' }, async ({
  page,
}) => {
  test.fail(true, 'F-14: percent promo discounts subtotal + shipping, not plants only');
  await registerAndLandOnShop(page, 'E2E Promo Cart');
  await addPlantToCart(page, 'pl-monstera');
  const cart = new CartPage(page);
  await cart.goto();

  await expect(cart.heading).toBeVisible();
  await expect(cart.promoPrompt).toBeVisible();
  await cart.applyPromo('leafy10');

  await expect(cart.leafy10DiscountLine).toBeVisible();
  // 10% of plant subtotal only (34.99 → 3.50), never shipping
  await expect(cart.leafy10DiscountAmount).toBeVisible();

  await cart.removePromo();
  await expect(cart.leafy10DiscountLine).toHaveCount(0);
  await expect(cart.applyButton).toBeVisible();
});

test('cart: expired SPRING5 shows expired error', { tag: '@e2e' }, async ({ page }) => {
  test.fail(true, 'F-15: expired SPRING5 is accepted instead of refused');
  await registerAndLandOnShop(page, 'E2E Promo Expired');
  await addPlantToCart(page, 'pl-snake');
  const cart = new CartPage(page);
  await cart.goto();

  await cart.applyPromo('SPRING5');
  await expect(cart.expiredError).toBeVisible();
});

test('checkout and order retain FREESHIP', { tag: '@e2e' }, async ({ page }) => {
  await registerAndLandOnShop(page, 'E2E Promo Order');
  await addPlantToCart(page, 'pl-aloe');
  const cart = new CartPage(page);
  await cart.goto();

  await cart.applyPromo('FREESHIP');
  await expect(cart.freeshipApplied).toBeVisible();
  await expect(cart.freeShipping).toBeVisible();

  const checkout = await cart.goToCheckout();
  await expect(checkout.heading).toBeVisible();
  await expect(checkout.orderSummaryHeading).toBeVisible();
  await expect(checkout.freeShipping).toBeVisible();

  await checkout.fillShipping({
    fullName: 'E2E Promo Order',
    streetAddress: '2 Fern Way',
    city: 'Moss City',
    postalCode: '90210',
  });
  const order = await checkout.placeOrder();

  await expect(order.thankYou).toBeVisible();
  await expect(order.paidHeading).toBeVisible();
  await expect(order.freeShipping).toBeVisible();
});
