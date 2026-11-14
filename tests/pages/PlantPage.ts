import type { Locator, Page } from '@playwright/test';

export class PlantPage {
  readonly page: Page;
  readonly reviewsHeading: Locator;
  readonly writeReviewHeading: Locator;
  readonly reviewsRegion: Locator;
  readonly reviewText: Locator;
  readonly postReviewButton: Locator;
  readonly thanksToast: Locator;
  readonly signInLink: Locator;
  readonly guestReviewPrompt: Locator;
  readonly alert: Locator;
  readonly reviewItems: Locator;
  readonly addToCartButton: Locator;
  readonly cartLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.reviewsHeading = page.getByRole('heading', { level: 2, name: 'Reviews' });
    this.reviewsRegion = page.getByRole('region', { name: 'Reviews' });
    this.writeReviewHeading = this.reviewsRegion.getByRole('heading', { name: 'Write a review' });
    this.reviewText = page.getByLabel('Your review');
    this.postReviewButton = page.getByRole('button', { name: 'Post review' });
    this.thanksToast = page.getByText('Thanks for your review!');
    this.signInLink = this.reviewsRegion.getByRole('link', { name: 'Sign in' });
    this.guestReviewPrompt = this.reviewsRegion.getByText(/to write a review/i);
    this.alert = page.getByRole('alert');
    this.reviewItems = this.reviewsRegion.getByRole('listitem');
    this.addToCartButton = page.getByRole('button', { name: 'Add to cart' });
    this.cartLink = page.getByRole('link', { name: /Cart/i });
  }

  /**
   * Opens a plant detail page.
   * @param plantId - Plant id in the URL
   * @returns void
   */
  async goto(plantId: string): Promise<void> {
    await this.page.goto(`/plants/${plantId}`);
  }

  /**
   * Selects a star rating radio.
   * @param stars - Rating value (e.g. 5)
   * @returns void
   */
  async selectStars(stars: number): Promise<void> {
    await this.page.getByRole('radio', { name: `${stars} stars` }).click();
  }

  /**
   * Fills the review body.
   * @param text - Review text
   * @returns void
   */
  async fillReview(text: string): Promise<void> {
    await this.reviewText.fill(text);
  }

  /** Submits the review form. @returns void */
  async postReview(): Promise<void> {
    await this.postReviewButton.click();
  }

  /**
   * Chooses stars, fills text, and posts the review.
   * @param stars - Rating value
   * @param text - Review text
   * @returns void
   */
  async submitReview(stars: number, text: string): Promise<void> {
    await this.selectStars(stars);
    await this.fillReview(text);
    await this.postReview();
  }

  /** Adds the selected plant/size to the cart. @returns void */
  async addToCart(): Promise<void> {
    await this.addToCartButton.click();
  }

  /**
   * Star rating radio for assertions or clicks.
   * @param stars - Rating value
   * @returns Locator for that radio
   */
  starRadio(stars: number): Locator {
    return this.page.getByRole('radio', { name: `${stars} stars` });
  }
}
