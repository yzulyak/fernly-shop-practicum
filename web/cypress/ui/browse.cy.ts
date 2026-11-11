describe('Browse page', () => {
  it('shows two plant cards and the heading "2 plants"', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants/catalog-positive.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('heading', { level: 2, name: '2 plants' }).should('be.visible');
    cy.findAllByRole('article').should('have.length', 2);
    cy.findByRole('heading', { name: 'Monstera Deliciosa' }).should('be.visible');
    cy.findByRole('heading', { name: 'Snake Plant' }).should('be.visible');
  });

  it('shows the empty catalog message when there are no plants', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants/catalog-empty.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('heading', { name: 'No plants match your filters' }).should('be.visible');
    cy.findByText('Try another search or clear a filter.').should('be.visible');
  });

  it('keeps a very long plant name inside its card', { tags: '@ui' }, () => {
    cy.fixture('plants/catalog-long-name.json').then((body) => {
      cy.intercept('GET', '/api/plants?*', body).as('plants');
      cy.visit('/');
      cy.wait('@plants');

      const longName = body.items[0].name as string;
      cy.findByRole('article').then(($card) => {
        cy.findByRole('heading', { name: longName }).then(($heading) => {
          const cardBox = $card[0].getBoundingClientRect();
          const nameBox = $heading[0].getBoundingClientRect();
          expect(nameBox.left, 'name left edge').to.be.at.least(cardBox.left);
          expect(nameBox.right, 'name right edge').to.be.at.most(cardBox.right + 1);
          expect(nameBox.top, 'name top edge').to.be.at.least(cardBox.top);
          expect(nameBox.bottom, 'name bottom edge').to.be.at.most(cardBox.bottom + 1);
        });
      });
    });
  });

  it('shows $0.00 for a plant priced at 0', { tags: ['@ui', '@known-bug'] }, () => {
    cy.intercept('GET', '/api/plants?*', { fixture: 'plants/catalog-price-zero.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('article').within(() => {
      cy.findByText('$0.00').should('be.visible');
    });
  });

  it('shows an error with Try again when the catalog returns 500', { tags: ['@ui', '@known-bug'] }, () => {
    cy.intercept('GET', '/api/plants?*', {
      statusCode: 500,
      fixture: 'plants/catalog-error-500.json',
    }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('alert').should('be.visible');
    cy.findByRole('button', { name: 'Try again' }).should('be.visible');
  });
});
