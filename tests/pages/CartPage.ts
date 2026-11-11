import type { Locator, Page } from '@playwright/test';
import { CheckoutPage } from './CheckoutPage';

export class CartPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly promoPrompt: Locator;
  /** F-10: promo code field has no accessible name or visible label — preferred getByLabel for the a11y check. */
  readonly promoCodeByLabel: Locator;
  /** F-10: unnamed field — find the promo textbox by role when filling. */
  readonly promoCodeField: Locator;
  readonly applyButton: Locator;
  readonly removeButton: Locator;
  readonly leafy10DiscountLine: Locator;
  readonly leafy10DiscountAmount: Locator;
  readonly freeshipApplied: Locator;
  readonly freeShipping: Locator;
  readonly expiredError: Locator;
  readonly goToCheckoutLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Your cart' });
    this.promoPrompt = page.getByText('Have a promo code?');
    this.promoCodeByLabel = page.getByLabel(/promo code/i);
    this.promoCodeField = page.getByRole('textbox');
    this.applyButton = page.getByRole('button', { name: 'Apply' });
    this.removeButton = page.getByRole('button', { name: 'Remove' });
    this.leafy10DiscountLine = page.getByText(/Discount \(LEAFY10\)/);
    this.leafy10DiscountAmount = page.getByText('−$3.50');
    this.freeshipApplied = page.getByText('Code FREESHIP applied');
    this.freeShipping = page.getByText('Free', { exact: true });
    this.expiredError = page.getByText(/expir/i);
    this.goToCheckoutLink = page.getByRole('link', { name: 'Go to checkout' });
  }

  /** Opens the cart page. @returns void */
  async goto(): Promise<void> {
    await this.page.goto('/cart');
  }

  /**
   * Fills the promo code field and clicks Apply.
   * @param code - Promo code to apply
   * @returns void
   */
  async applyPromo(code: string): Promise<void> {
    await this.promoCodeField.fill(code);
    await this.applyButton.click();
  }

  /** Removes the applied promo code. @returns void */
  async removePromo(): Promise<void> {
    await this.removeButton.click();
  }

  /**
   * Continues to checkout.
   * @returns Checkout page
   */
  async goToCheckout(): Promise<CheckoutPage> {
    await this.goToCheckoutLink.click();
    return new CheckoutPage(this.page);
  }
}
