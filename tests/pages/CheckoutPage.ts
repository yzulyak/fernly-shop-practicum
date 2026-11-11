import type { Locator, Page } from '@playwright/test';
import { OrderPage } from './OrderPage';

export class CheckoutPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly orderSummaryHeading: Locator;
  readonly freeShipping: Locator;
  readonly fullName: Locator;
  readonly streetAddress: Locator;
  readonly city: Locator;
  readonly postalCode: Locator;
  readonly placeOrderButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Checkout' });
    this.orderSummaryHeading = page.getByRole('heading', { name: 'Order summary' });
    this.freeShipping = page.getByText('Free', { exact: true });
    this.fullName = page.getByLabel('Full name');
    this.streetAddress = page.getByLabel('Street address');
    this.city = page.getByLabel('City');
    this.postalCode = page.getByLabel('Postal code');
    this.placeOrderButton = page.getByRole('button', { name: 'Place order' });
  }

  /**
   * Fills the shipping address fields.
   * @param address - Shipping field values
   * @returns void
   */
  async fillShipping(address: {
    fullName: string;
    streetAddress: string;
    city: string;
    postalCode: string;
  }): Promise<void> {
    await this.fullName.fill(address.fullName);
    await this.streetAddress.fill(address.streetAddress);
    await this.city.fill(address.city);
    await this.postalCode.fill(address.postalCode);
  }

  /**
   * Places the order.
   * @returns Order confirmation page
   */
  async placeOrder(): Promise<OrderPage> {
    await this.placeOrderButton.click();
    return new OrderPage(this.page);
  }
}
