import { ReviewForm } from '../../src/components/ReviewForm';

describe('ReviewForm + StarRatingInput', () => {
  it('9 positive: choose stars and ≥10 chars calls onSubmit', { tags: '@component' }, () => {
    const onSubmit = cy.spy().as('onSubmit');
    cy.mount(<ReviewForm onSubmit={onSubmit} />);

    cy.findByRole('radio', { name: '5 stars' }).click();
    cy.findByLabelText('Your review').type('This plant thrives near my window.');
    cy.findByRole('button', { name: 'Post review' }).click();

    cy.get('@onSubmit').should('have.been.calledOnceWith', {
      rating: 5,
      text: 'This plant thrives near my window.',
    });
  });

  it('9 positive: busy disables button and shows Posting…', { tags: '@component' }, () => {
    cy.mount(<ReviewForm onSubmit={cy.spy()} busy />);

    cy.findByRole('button', { name: 'Posting…' }).then(($btn) => {
      expect($btn, 'Posting… while busy').to.be.disabled;
    });
  });

  it('9 negative: rating 0 or short text shows alert and does not submit', { tags: '@component' }, () => {
    const onSubmit = cy.spy().as('onSubmit');
    cy.mount(<ReviewForm onSubmit={onSubmit} />);

    cy.findByRole('button', { name: 'Post review' }).click();
    cy.findByRole('alert').should('contain', 'Choose a rating from 1 to 5 stars.');
    cy.get('@onSubmit').should('not.have.been.called');

    cy.findByRole('radio', { name: '3 stars' }).click();
    cy.findByLabelText('Your review').type('Short');
    cy.findByRole('button', { name: 'Post review' }).click();
    cy.findByRole('alert').should('contain', 'Write at least 10 characters.');
    cy.get('@onSubmit').should('not.have.been.called');
  });

  it('9 edge: server error prop is shown; textarea maxLength 500', { tags: '@component' }, () => {
    cy.mount(<ReviewForm onSubmit={cy.spy()} error="You already reviewed this plant." />);

    cy.findByRole('alert').should('contain', 'You already reviewed this plant.');
    cy.findByLabelText('Your review').should('have.attr', 'maxLength', '500');
  });

  it('9 accessibility: radiogroup Your rating; Tab; arrows; selected announced', { tags: '@component' }, () => {
    cy.mount(<ReviewForm onSubmit={cy.spy()} />);

    cy.findByRole('radiogroup', { name: 'Your rating' }).should('be.visible');

    cy.findByRole('radio', { name: '3 stars' }).click();
    cy.findByRole('radio', { name: '3 stars' }).should('have.attr', 'aria-checked', 'true');
    cy.findByRole('radio', { name: '2 stars' }).should('have.attr', 'aria-checked', 'false');

    cy.findByRole('radio', { name: '1 star' }).focus();
    cy.focused().should('have.attr', 'aria-label', '1 star');
    cy.focused().type('{rightarrow}');
    cy.focused().should('have.attr', 'aria-label', '2 stars');
    cy.focused().should('have.attr', 'aria-checked', 'true');
  });
});

