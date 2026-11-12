import type { Locator, Page } from '@playwright/test';
import { BrowsePage } from './BrowsePage';

export class SignInPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly signInButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Sign in' });
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign in' });
  }

  /** Opens the sign-in page. @returns void */
  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  /**
   * Signs in with the given credentials and lands on the shop.
   * @param email - Account email
   * @param password - Account password
   * @returns Browse page after a successful sign-in
   */
  async signIn(email: string, password: string): Promise<BrowsePage> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.signInButton.click();
    return new BrowsePage(this.page);
  }
}
