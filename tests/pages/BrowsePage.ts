import type { Locator, Page } from '@playwright/test';

export class BrowsePage {
  readonly page: Page;
  readonly sortBy: Locator;
  readonly plantsHeading: Locator;
  readonly plantList: Locator;
  readonly firstPlantHeading: Locator;
  readonly signOutButton: Locator;
  readonly cartLink: Locator;
  readonly nextPageButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sortBy = page.getByLabel('Sort by');
    this.plantsHeading = page.getByRole('heading', { level: 2, name: /\d+ plants/ });
    this.plantList = page.getByRole('list');
    this.firstPlantHeading = this.plantList
      .getByRole('listitem')
      .first()
      .getByRole('heading', { level: 3 });
    this.signOutButton = page.getByRole('button', { name: 'Sign out' });
    this.cartLink = page.getByRole('link', { name: /Cart/i });
    this.nextPageButton = page.getByRole('navigation', { name: 'Pages' }).getByRole('button', {
      name: 'Next',
    });
  }

  /** Opens the browse (shop) page. @returns void */
  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  /**
   * Selects "Price: high to low" in Sort by.
   * @returns void
   */
  async sortPriceHighToLow(): Promise<void> {
    await this.sortBy.selectOption({ label: 'Price: high to low' });
  }

  /** Opens the next page of plant results. @returns void */
  async goToNextPage(): Promise<void> {
    await this.nextPageButton.click();
  }

  /**
   * Plant card listitem scoped by visible plant name.
   * @param plantName - Name shown on the card
   * @returns Locator for that card's listitem
   */
  plantCard(plantName: string): Locator {
    return this.plantList.getByRole('listitem').filter({ hasText: plantName });
  }

  /**
   * Heart/save control on a plant card.
   * F-07: Save (heart) button has no accessible name — find by role inside its card.
   * @param plantName - Name shown on the card
   * @returns Locator for the unnamed button inside that card
   */
  saveButton(plantName: string): Locator {
    return this.plantCard(plantName).getByRole('button');
  }
}
