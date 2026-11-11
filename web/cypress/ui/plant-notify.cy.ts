const OOS_ID = 'pl-pilea';
const IN_STOCK_ID = 'pl-monstera';
const EMAIL = 'shopper@example.com';

function stubCatalogAndReviews(plantId: string) {
  // Avoid `/api/plants?*` — in minimatch `?` is a wildcard and steals `/plants/:id`.
  cy.intercept('GET', '/api/plants?pageSize=*', { fixture: 'plants/catalog-positive.json' }).as('plants');
  cy.intercept('GET', `/api/plants/${plantId}/reviews`, { fixture: 'reviews/list-empty.json' }).as('reviews');
}

function visitPlant(plantId: string, options: { signedIn?: boolean } = {}) {
  cy.visit(`/plants/${plantId}`, {
    onBeforeLoad(win) {
      if (options.signedIn) {
        win.localStorage.setItem('fernly_token', 'test-token');
      } else {
        win.localStorage.removeItem('fernly_token');
      }
    },
  });
}

describe('Plant page back-in-stock / NotifyForm', () => {
  it('9a positive: OOS form; Notify me confirms which address will be emailed', { tags: '@ui' }, () => {
    stubCatalogAndReviews(OOS_ID);
    cy.intercept('GET', `/api/plants/${OOS_ID}`, { fixture: 'plants/pl-pilea.json' }).as('plant');
    cy.intercept('POST', `/api/plants/${OOS_ID}/notify`, {
      statusCode: 201,
      fixture: 'notify/post-201.json',
    }).as('notify');

    visitPlant(OOS_ID);
    cy.wait(['@plant', '@reviews']);

    cy.findByLabelText("Email me when it's back").should('be.visible');
    cy.findByLabelText("Email me when it's back").type(EMAIL);
    cy.findByRole('button', { name: 'Notify me' }).click();
    cy.wait('@notify');

    // role="status" has no name-from-contents; QuantityStepper also uses status via <output>.
    cy.findByText(`We'll email ${EMAIL} when Chinese Money Plant is back.`)
      .should('be.visible')
      .and('have.attr', 'role', 'status');
  });

  it('9b negative: in-stock plant has no Notify me form', { tags: '@ui' }, () => {
    stubCatalogAndReviews(IN_STOCK_ID);
    cy.intercept('GET', `/api/plants/${IN_STOCK_ID}`, { fixture: 'plants/pl-monstera.json' }).as('plant');

    visitPlant(IN_STOCK_ID);
    cy.wait(['@plant', '@reviews']);

    cy.findByRole('heading', { level: 1, name: 'Monstera Deliciosa' }).should('be.visible');
    cy.get('body').should('not.include.text', "Email me when it's back");
    cy.get('body').should('not.include.text', 'Notify me');
  });

  it('9c negative: POST 409 already_subscribed surfaces in form alert', { tags: '@ui' }, () => {
    stubCatalogAndReviews(OOS_ID);
    cy.intercept('GET', `/api/plants/${OOS_ID}`, { fixture: 'plants/pl-pilea.json' }).as('plant');
    cy.intercept('POST', `/api/plants/${OOS_ID}/notify`, {
      statusCode: 409,
      fixture: 'notify/post-409.json',
    }).as('notify');

    visitPlant(OOS_ID);
    cy.wait(['@plant', '@reviews']);

    cy.findByLabelText("Email me when it's back").type(EMAIL);
    cy.findByRole('button', { name: 'Notify me' }).click();
    cy.wait('@notify');

    cy.findByRole('alert').should('contain', "You're already on the list");
  });

  it('9d edge: signed-out visitor completes notify without signing in', { tags: '@ui' }, () => {
    stubCatalogAndReviews(OOS_ID);
    cy.intercept('GET', `/api/plants/${OOS_ID}`, { fixture: 'plants/pl-pilea.json' }).as('plant');
    cy.intercept('POST', `/api/plants/${OOS_ID}/notify`, {
      statusCode: 201,
      fixture: 'notify/post-201.json',
    }).as('notify');

    visitPlant(OOS_ID);
    cy.wait(['@plant', '@reviews']);

    cy.window().then((win) => {
      expect(win.localStorage.getItem('fernly_token'), 'signed-out (no fernly_token)').to.eq(null);
    });

    cy.findByLabelText("Email me when it's back").type(EMAIL);
    cy.findByRole('button', { name: 'Notify me' }).click();
    cy.wait('@notify');

    cy.findByText(`We'll email ${EMAIL} when Chinese Money Plant is back.`)
      .should('be.visible')
      .and('have.attr', 'role', 'status');
    cy.findByRole('heading', { level: 1, name: 'Chinese Money Plant' }).should('be.visible');
    cy.url().should('include', `/plants/${OOS_ID}`);
  });
});



