import type { Locator, Page } from '@playwright/test';

export class OrderPage {
  readonly page: Page;
  readonly thankYou: Locator;
  readonly paidHeading: Locator;
  readonly freeShipping: Locator;

  constructor(page: Page) {
    this.page = page;
    this.thankYou = page.getByText('Thank you! Your order is placed.');
    this.paidHeading = page.getByRole('heading', { name: 'Paid' });
    this.freeShipping = page.getByText('Free', { exact: true });
  }
}
