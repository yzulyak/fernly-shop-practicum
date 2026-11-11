import type { Locator, Page } from '@playwright/test';
import { BrowsePage } from './BrowsePage';

export class RegisterPage {
  readonly page: Page;
  readonly name: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly createAccountButton: Locator;
  readonly signOutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.name = page.getByLabel('Name');
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.createAccountButton = page.getByRole('button', { name: 'Create account' });
    this.signOutButton = page.getByRole('button', { name: 'Sign out' });
  }

  /** Opens the create-account page. @returns void */
  async goto(): Promise<void> {
    await this.page.goto('/register');
  }

  /**
   * Creates an account and lands on the shop.
   * @param name - Display name
   * @param email - Unique email
   * @param password - Account password
   * @returns Browse page after registration
   */
  async createAccount(name: string, email: string, password: string): Promise<BrowsePage> {
    await this.name.fill(name);
    await this.email.fill(email);
    await this.password.fill(password);
    await this.createAccountButton.click();
    return new BrowsePage(this.page);
  }
}
