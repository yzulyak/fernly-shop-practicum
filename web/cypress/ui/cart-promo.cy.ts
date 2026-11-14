function stubSignedIn() {
  cy.intercept('GET', '/api/auth/me', { fixture: 'auth/me.json' }).as('me');
}

function visitCart() {
  cy.visit('/cart', {
    onBeforeLoad(win) {
      win.localStorage.setItem('fernly_token', 'test-token');
    },
  });
}

describe('Cart page promo slot', () => {
  it('8 positive: promo field + Apply updates discount; Remove clears', { tags: '@ui' }, () => {
    stubSignedIn();
    let applied = false;
    cy.intercept('GET', '/api/cart', (req) => {
      req.reply({ fixture: applied ? 'cart/with-leafy10.json' : 'cart/with-plant.json' });
    }).as('cart');

    cy.intercept('POST', '/api/cart/promo', (req) => {
      applied = true;
      req.reply({ fixture: 'cart/with-leafy10.json' });
    }).as('applyPromo');
    cy.intercept('DELETE', '/api/cart/promo', (req) => {
      applied = false;
      req.reply({ fixture: 'cart/with-plant.json' });
    }).as('removePromo');

    visitCart();
    cy.wait(['@me', '@cart']);

    cy.findByText('Have a promo code?').should('be.visible');
    cy.get('input').type('LEAFY10');
    cy.findByRole('button', { name: 'Apply' }).click();
    cy.wait('@applyPromo');

    cy.findByText('Discount (LEAFY10)').should('be.visible');
    cy.findByText(/Code/).should('contain', 'LEAFY10');

    cy.findByRole('button', { name: 'Remove' }).click();
    cy.wait('@removePromo');
    cy.findByRole('button', { name: 'Apply' }).should('be.visible');
    cy.findByText(/^Discount/).should('not.exist');
  });

  it('8 negative: invalid promo shows error message', { tags: '@ui' }, () => {
    stubSignedIn();
    cy.intercept('GET', '/api/cart', { fixture: 'cart/with-plant.json' }).as('cart');
    cy.intercept('POST', '/api/cart/promo', { statusCode: 400, fixture: 'cart/promo-invalid.json' }).as(
      'applyPromo',
    );

    visitCart();
    cy.wait(['@me', '@cart']);

    cy.get('input').type('NOPE');
    cy.findByRole('button', { name: 'Apply' }).click();
    cy.wait('@applyPromo');
    cy.findByText("We don't recognize this code.").should('be.visible');
  });

  it('8 negative: expired promo shows expired message', { tags: '@ui' }, () => {
    stubSignedIn();
    cy.intercept('GET', '/api/cart', { fixture: 'cart/with-plant.json' }).as('cart');
    cy.intercept('POST', '/api/cart/promo', { statusCode: 400, fixture: 'cart/promo-expired.json' }).as(
      'applyPromo',
    );

    visitCart();
    cy.wait(['@me', '@cart']);

    cy.get('input').type('SPRING5');
    cy.findByRole('button', { name: 'Apply' }).click();
    cy.wait('@applyPromo');
    cy.findByText(/expired/i).should('be.visible');
  });
});

describe('Checkout page with promo', () => {
  it('9 positive: checkout shows discount line and total from cart', { tags: '@ui' }, () => {
    stubSignedIn();
    cy.intercept('GET', '/api/cart', { fixture: 'cart/with-leafy10.json' }).as('cart');

    cy.visit('/checkout', {
      onBeforeLoad(win) {
        win.localStorage.setItem('fernly_token', 'test-token');
      },
    });
    cy.wait(['@me', '@cart']);

    cy.findByRole('heading', { name: 'Checkout' }).should('be.visible');
    cy.findByText('Discount (LEAFY10)').should('be.visible');
    cy.findByText('−$3.5').should('be.visible');
  });
});

describe('Order detail with promo', () => {
  it('10 positive: Paid summary shows Discount (LEAFY10) and total', { tags: '@ui' }, () => {
    stubSignedIn();
    cy.intercept('GET', '/api/cart', { fixture: 'cart/empty.json' }).as('cart');
    cy.intercept('GET', '/api/orders/ord-promo-1', { fixture: 'orders/with-promo.json' }).as('order');

    cy.visit('/orders/ord-promo-1', {
      onBeforeLoad(win) {
        win.localStorage.setItem('fernly_token', 'test-token');
      },
    });
    cy.wait(['@me', '@order']);

    cy.findByRole('heading', { name: 'Paid' }).should('be.visible');
    cy.findByText('Discount (LEAFY10)').should('be.visible');
    cy.findByText('−$3.5').should('be.visible');
  });
});
