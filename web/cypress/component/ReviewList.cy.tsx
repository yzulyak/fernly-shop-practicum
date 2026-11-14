import { ReviewList, type ReviewItem } from '../../src/components/ReviewList';

const sampleReviews: ReviewItem[] = [
  {
    id: 'rv-1',
    author: 'Leo M.',
    rating: 4,
    text: 'Beautiful, but it needed a bigger pot quickly.',
    createdAt: '2026-09-11T12:00:00.000Z',
  },
  {
    id: 'rv-2',
    author: 'Priya S.',
    rating: 5,
    text: 'Two new leaves in the first month!',
    createdAt: '2026-08-21T09:00:00.000Z',
  },
];

describe('ReviewList', () => {
  it('8 positive: average toFixed(1), plural reviews, author/stars/date/text', { tags: '@component' }, () => {
    cy.mount(<ReviewList reviews={sampleReviews} average={4.7} count={2} />);

    cy.findByText(/4\.7 out of 5 · 2 reviews/).should('be.visible');
    cy.findByText('Leo M.').should('be.visible');
    cy.findByText('Priya S.').should('be.visible');
    cy.findByText('Beautiful, but it needed a bigger pot quickly.').should('be.visible');
    cy.findByText('Two new leaves in the first month!').should('be.visible');
    cy.findByText('Sep 11, 2026').should('be.visible');
    cy.findByText('Aug 21, 2026').should('be.visible');
    cy.findByText('★★★★').should('exist');
    cy.findByText('★★★★★').should('exist');
  });

  it('8 positive: singular review wording when count is 1', { tags: '@component' }, () => {
    cy.mount(<ReviewList reviews={[sampleReviews[0]]} average={4.0} count={1} />);

    cy.findByText(/4\.0 out of 5 · 1 review$/).should('be.visible');
  });

  it('8 edge: count 0 shows empty invitation copy', { tags: '@component' }, () => {
    cy.mount(<ReviewList reviews={[]} average={0} count={0} />);

    cy.findByText("No reviews yet. Be the first to share how it's growing.").should('be.visible');
  });

  it('8 accessibility: rating has visually-hidden N out of 5', { tags: '@component' }, () => {
    cy.mount(<ReviewList reviews={[sampleReviews[0]]} average={4.0} count={1} />);

    cy.findByText('4 out of 5').should('have.class', 'visually-hidden');
  });
});
