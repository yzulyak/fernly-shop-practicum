import { test, expect, type Page } from '@playwright/test';
import { formatBlockingMessage } from './baseline';
import { scanPage } from './helpers/scan';

async function signInAsFirstCustomer(page: Page): Promise<void> {
  const email = process.env.FERNLY_USER_EMAIL;
  const password = process.env.FERNLY_USER_PASSWORD;
  if (!email || !password) {
    throw new Error('FERNLY_USER_EMAIL and FERNLY_USER_PASSWORD must be set');
  }

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

async function clearCart(page: Page): Promise<void> {
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();

  const empty = page.getByText('Your cart is empty');
  const removeButtons = page.getByRole('button', { name: /Remove/ });
  await expect(empty.or(removeButtons.first())).toBeVisible();

  while ((await removeButtons.count()) > 0) {
    const remaining = await removeButtons.count();
    await removeButtons.first().click();
    await expect(removeButtons).toHaveCount(remaining - 1);
  }
  await expect(empty).toBeVisible();
}

async function addOnePlantToCart(page: Page): Promise<void> {
  await clearCart(page);
  await page.goto('/plants/pl-monstera');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('link', { name: /Cart/i })).toContainText('1');
}

test('Browse has no blocking a11y violations', { tag: '@a11y' }, async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const { blocking } = await scanPage(page, testInfo, { name: 'Browse' });
  expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
});

test('Plant has no blocking a11y violations', { tag: '@a11y' }, async ({ page }, testInfo) => {
  await page.goto('/plants/pl-monstera');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const { blocking } = await scanPage(page, testInfo, { name: 'Plant' });
  expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
});

test('Plant Reviews (signed-out) keeps Reviews landmark and heading', { tag: '@a11y' }, async ({
  page,
}, testInfo) => {
  await page.goto('/plants/pl-monstera');
  await expect(page.getByRole('heading', { level: 2, name: 'Reviews' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Reviews' })).toBeVisible();

  const { blocking } = await scanPage(page, testInfo, { name: 'Plant Reviews signed-out' });
  expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
});

test('Plant Reviews (signed-in) form radiogroup is named and operable', { tag: '@a11y' }, async ({
  page,
}, testInfo) => {
  const email = `a11y-reviewer-${Date.now()}@fernly.test`;
  await page.goto('/register');
  await page.getByLabel('Name').fill('A11y Reviewer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Fernly-Test-2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

  await page.goto('/plants/pl-zz');
  await expect(page.getByRole('heading', { level: 2, name: 'Reviews' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Reviews' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Write a review' })).toBeVisible();

  const ratingGroup = page.getByRole('radiogroup', { name: 'Your rating' });
  await expect(ratingGroup).toBeVisible();
  await ratingGroup.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const checked = ratingGroup.getByRole('radio', { checked: true });
  await expect(checked).toBeVisible();

  const { blocking } = await scanPage(page, testInfo, { name: 'Plant Reviews signed-in' });
  expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
});

test('Sign in has no blocking a11y violations', { tag: '@a11y' }, async ({ page }, testInfo) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  const { blocking } = await scanPage(page, testInfo, { name: 'Sign in' });
  expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
});

test('Cart has no blocking a11y violations', { tag: '@a11y' }, async ({ page }, testInfo) => {
  await signInAsFirstCustomer(page);
  await addOnePlantToCart(page);
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();

  const { blocking } = await scanPage(page, testInfo, { name: 'Cart' });
  expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
});

test('Checkout has no blocking a11y violations', { tag: '@a11y' }, async ({ page }, testInfo) => {
  await signInAsFirstCustomer(page);
  await addOnePlantToCart(page);
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();

  const { blocking } = await scanPage(page, testInfo, { name: 'Checkout' });
  expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
});
