function boxesOverlap(
  a: DOMRect,
  b: DOMRect,
): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

describe('Browse plant-card stock badge', () => {
  it('8a: low-stock card shows “Only 2 left” with other tags under the name', { tags: ['@ui', '@known-bug'] }, () => {
    cy.intercept('GET', '/api/plants*', { fixture: 'plants/catalog-low-stock.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('article').within(() => {
      cy.findByRole('heading', { name: 'String of Pearls' }).then(($name) => {
        cy.findByText(/Moderate care/).then(($care) => {
          cy.findByText('Not pet safe').then(($pet) => {
            cy.findByText('Only 2 left').then(($badge) => {
              const nameBox = $name[0].getBoundingClientRect();
              const careBox = $care[0].getBoundingClientRect();
              const petBox = $pet[0].getBoundingClientRect();
              const badgeBox = $badge[0].getBoundingClientRect();

              expect(careBox.top, 'care tag under name').to.be.at.least(nameBox.bottom - 1);
              expect(petBox.top, 'pet tag under name').to.be.at.least(nameBox.bottom - 1);
              expect(badgeBox.top, 'Only 2 left under name').to.be.at.least(nameBox.bottom - 1);
            });
          });
        });
      });
    });
  });

  it('8b: high-stock card has no “Only N left” badge', { tags: '@ui' }, () => {
    cy.intercept('GET', '/api/plants*', { fixture: 'plants/catalog-high-stock.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('article').within(() => {
      cy.findByRole('heading', { name: 'Monstera Deliciosa' }).should('be.visible');
      cy.findByText(/Only \d+ left/).should('not.exist');
    });
  });

  it('8c: out-of-stock card shows “Out of stock” and never “Only 0 left”', { tags: ['@ui', '@known-bug'] }, () => {
    cy.intercept('GET', '/api/plants*', { fixture: 'plants/catalog-out-of-stock.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('article').within(() => {
      cy.findByText('Out of stock').should('be.visible');
      cy.findByText('Only 0 left').should('not.exist');
    });
  });

  it('8d: “Only N left” does not cover the plant photo or the save button', { tags: ['@ui', '@known-bug'] }, () => {
    cy.intercept('GET', '/api/plants*', { fixture: 'plants/catalog-low-stock.json' }).as('plants');
    cy.visit('/');
    cy.wait('@plants');

    cy.findByRole('article').within(() => {
      cy.findByText('Only 2 left').then(($badge) => {
        cy.findByRole('img', { name: 'String of Pearls' }).then(($img) => {
          // F-07: save control is unnamed; it is the only button in the card
          cy.findByRole('button').then(($save) => {
            const badgeBox = $badge[0].getBoundingClientRect();
            const imgBox = $img[0].getBoundingClientRect();
            const saveBox = $save[0].getBoundingClientRect();

            expect(
              boxesOverlap(badgeBox, imgBox),
              'Only 2 left must not cover the plant photo',
            ).to.equal(false);
            expect(
              boxesOverlap(badgeBox, saveBox),
              'Only 2 left must not cover the save button',
            ).to.equal(false);
          });
        });
      });
    });
  });
});
