const PLANT_ID = 'pl-monstera';
const PLANT_PATH = `/plants/${PLANT_ID}`;

function stubPlantPageBasics() {
  // Avoid `/api/plants?*` — in minimatch `?` is a wildcard and steals `/plants/:id` and `/reviews`.
  cy.intercept('GET', '/api/plants?pageSize=*', { fixture: 'plants/catalog-positive.json' }).as('plants');
  cy.intercept('GET', `/api/plants/${PLANT_ID}`, { fixture: 'plants/pl-monstera.json' }).as('plant');
  cy.intercept('GET', `/api/plants/${PLANT_ID}/reviews`, { fixture: 'reviews/list-empty.json' }).as('reviews');
}

function visitPlant() {
  cy.visit(PLANT_PATH, {
    onBeforeLoad(win) {
      win.localStorage.removeItem('fernly_token');
    },
  });
}

describe('Plant page Popular slot', () => {
  it('4 positive: mocked popular shows Popular right now with up to four plants and sold copy', { tags: '@ui' }, () => {
    stubPlantPageBasics();
    cy.intercept('GET', '/api/popular*', { fixture: 'popular/list-positive.json' }).as('popular');

    visitPlant();
    cy.wait(['@plant', '@popular']);

    cy.findByRole('region', { name: 'Popular right now' }).should('be.visible');
    cy.findByRole('heading', { level: 2, name: 'Popular right now' }).should('be.visible');

    cy.findByRole('region', { name: 'Popular right now' }).within(() => {
      cy.findAllByRole('listitem').then(($items) => {
        expect($items, 'popular count').to.have.length(4);
        expect($items.eq(0)).to.contain('Snake Plant');
        expect($items.eq(0)).to.contain('128 sold this month');
        expect($items.eq(1)).to.contain('Golden Pothos');
        expect($items.eq(1)).to.contain('96 sold this month');
        expect($items.eq(2)).to.contain('ZZ Plant');
        expect($items.eq(2)).to.contain('72 sold this month');
        expect($items.eq(3)).to.contain('Fiddle Leaf Fig');
        expect($items.eq(3)).to.contain('54 sold this month');
      });
      cy.findByRole('link', { name: 'Snake Plant' }).should('have.attr', 'href', '/plants/pl-snake');
    });
  });

  it('4 edge: current plant omitted; fifth fills fourth slot', { tags: '@ui' }, () => {
    stubPlantPageBasics();
    cy.intercept('GET', '/api/popular*', { fixture: 'popular/list-includes-current.json' }).as('popular');

    visitPlant();
    cy.wait(['@plant', '@popular']);

    cy.findByRole('region', { name: 'Popular right now' }).within(() => {
      cy.findAllByRole('listitem').then(($items) => {
        expect($items, 'four after exclude').to.have.length(4);
        expect($items.eq(0)).to.contain('Snake Plant');
        expect($items.eq(1)).to.contain('Golden Pothos');
        expect($items.eq(2)).to.contain('ZZ Plant');
        expect($items.eq(3)).to.contain('Calathea Orbifolia');
        expect($items.eq(3)).to.contain('40 sold this month');
      });
      cy.root().should('not.include.text', 'Monstera Deliciosa');
    });
  });

  it('4 negative: no data / pending leaves section hidden', { tags: '@ui' }, () => {
    stubPlantPageBasics();
    cy.intercept('GET', '/api/popular*', { fixture: 'popular/list-pending.json' }).as('popular');

    visitPlant();
    cy.wait(['@plant', '@popular']);

    cy.findByRole('heading', { level: 1, name: 'Monstera Deliciosa' }).should('be.visible');
    cy.get('body').should('not.contain', 'Popular right now');
  });
});
