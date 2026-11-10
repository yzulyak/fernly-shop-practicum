const PLANT_ID = 'pl-monstera';
const PLANT_PATH = `/plants/${PLANT_ID}`;

function stubPlantPageBasics() {
  // Avoid `/api/plants?*` — in minimatch `?` is a wildcard and steals `/plants/:id` and `/reviews`.
  cy.intercept('GET', '/api/plants?pageSize=*', { fixture: 'plants/catalog-positive.json' }).as('plants');
  cy.intercept('GET', `/api/plants/${PLANT_ID}`, { fixture: 'plants/pl-monstera.json' }).as('plant');
}

function visitPlant(options: { signedIn?: boolean } = {}) {
  cy.visit(PLANT_PATH, {
    onBeforeLoad(win) {
      if (options.signedIn) {
        win.localStorage.setItem('fernly_token', 'test-token');
      } else {
        win.localStorage.removeItem('fernly_token');
      }
    },
  });
}

function stubSignedInApis() {
  cy.intercept('GET', '/api/auth/me', { fixture: 'auth/me.json' }).as('me');
  cy.intercept('GET', '/api/cart', { fixture: 'cart/empty.json' }).as('cart');
}

describe('Plant page Reviews slot', () => {
  it('6 positive: signed-in mock shows Write a review form', { tags: '@ui' }, () => {
    stubSignedInApis();
    stubPlantPageBasics();
    cy.intercept('GET', `/api/plants/${PLANT_ID}/reviews`, { fixture: 'reviews/list-positive.json' }).as('reviews');

    visitPlant({ signedIn: true });
    cy.wait(['@me', '@plant', '@reviews']);

    cy.findByRole('heading', { level: 2, name: 'Reviews' }).should('be.visible');
    cy.findByRole('heading', { level: 3, name: 'Write a review' }).should('be.visible');
    cy.findByRole('radiogroup', { name: 'Your rating' }).should('be.visible');
    cy.findByLabelText('Your review').should('be.visible');
    cy.findByRole('button', { name: 'Post review' }).should('be.visible');
  });

  it('6 negative: signed-out shows Sign in link to login with next', { tags: '@ui' }, () => {
    stubPlantPageBasics();
    cy.intercept('GET', `/api/plants/${PLANT_ID}/reviews`, { fixture: 'reviews/list-positive.json' }).as('reviews');

    visitPlant();
    cy.wait(['@plant', '@reviews']);

    cy.findByRole('region', { name: 'Reviews' }).within(() => {
      cy.root().should('not.include.text', 'Write a review');
      cy.findByText(/to write a review/i).should('be.visible');
      cy.findByRole('link', { name: 'Sign in' })
        .should('be.visible')
        .and('have.attr', 'href', `/login?next=/plants/${PLANT_ID}`);
    });
  });

  it('6 edge: reviews load error shows ErrorBanner and retry', { tags: '@ui' }, () => {
    stubPlantPageBasics();
    let attempts = 0;
    cy.intercept('GET', `/api/plants/${PLANT_ID}/reviews`, (req) => {
      attempts += 1;
      if (attempts === 1) {
        req.reply({ statusCode: 500, fixture: 'reviews/list-error-500.json' });
        return;
      }
      req.reply({ fixture: 'reviews/list-positive.json' });
    }).as('reviews');

    visitPlant();
    cy.wait('@plant');
    cy.wait('@reviews');

    cy.findByRole('alert').should('contain', "Reviews couldn't be loaded.");
    cy.findByRole('button', { name: 'Try again' }).click();
    cy.wait('@reviews');
    cy.findByText(/4\.5 out of 5/).should('be.visible');
  });

  it('7 positive: list shows average/count/newest-first; POST thanks and refreshes', { tags: '@ui' }, () => {
    stubSignedInApis();
    stubPlantPageBasics();

    let reviewsCalls = 0;
    cy.intercept('GET', `/api/plants/${PLANT_ID}/reviews`, (req) => {
      reviewsCalls += 1;
      if (reviewsCalls === 1) {
        req.reply({ fixture: 'reviews/list-positive.json' });
        return;
      }
      req.reply({ fixture: 'reviews/list-after-post.json' });
    }).as('reviews');

    cy.intercept('POST', `/api/plants/${PLANT_ID}/reviews`, { statusCode: 201, fixture: 'reviews/post-created.json' }).as(
      'postReview',
    );

    visitPlant({ signedIn: true });
    cy.wait(['@me', '@plant', '@reviews']);

    cy.findByRole('region', { name: 'Reviews' }).within(() => {
      cy.findByText(/4\.5 out of 5 · 2 reviews/).should('be.visible');
      cy.findAllByRole('listitem').then(($items) => {
        expect($items, 'review count').to.have.length(2);
        expect($items.eq(0)).to.contain('Leo M.');
        expect($items.eq(1)).to.contain('Priya S.');
      });
    });

    cy.findByRole('radio', { name: '5 stars' }).click();
    cy.findByLabelText('Your review').type('Loves the bright corner by my desk.');
    cy.findByRole('button', { name: 'Post review' }).click();

    cy.wait('@postReview');
    cy.findByText('Thanks for your review!').should('be.visible');
    cy.wait('@reviews');
    cy.findByRole('region', { name: 'Reviews' }).within(() => {
      cy.findByText('Loves the bright corner by my desk.').should('be.visible');
      cy.findByText(/4\.7 out of 5 · 3 reviews/).should('be.visible');
    });
  });

  it('7 negative: no stars or short text shows alert and does not POST', { tags: '@ui' }, () => {
    stubSignedInApis();
    stubPlantPageBasics();
    cy.intercept('GET', `/api/plants/${PLANT_ID}/reviews`, { fixture: 'reviews/list-positive.json' }).as('reviews');
    cy.intercept('POST', `/api/plants/${PLANT_ID}/reviews`, { statusCode: 201, body: {} }).as('postReview');

    visitPlant({ signedIn: true });
    cy.wait(['@me', '@plant', '@reviews']);

    cy.findByRole('button', { name: 'Post review' }).click();
    cy.findByRole('alert').should('contain', 'Choose a rating from 1 to 5 stars.');
    cy.get('@postReview.all').should('have.length', 0);

    cy.findByRole('radio', { name: '4 stars' }).click();
    cy.findByLabelText('Your review').type('Too short');
    cy.findByRole('button', { name: 'Post review' }).click();
    cy.findByRole('alert').should('contain', 'Write at least 10 characters.');
    cy.get('@postReview.all').should('have.length', 0);
  });

  it('7 edge: empty list shows No reviews yet invitation', { tags: '@ui' }, () => {
    stubPlantPageBasics();
    cy.intercept('GET', `/api/plants/${PLANT_ID}/reviews`, { fixture: 'reviews/list-empty.json' }).as('reviews');

    visitPlant();
    cy.wait(['@plant', '@reviews']);

    cy.findByText("No reviews yet. Be the first to share how it's growing.").should('be.visible');
  });
});
