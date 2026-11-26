import { PopularList, type PopularItem } from '../../src/components/PopularList';

const sampleItems: PopularItem[] = [
  { id: 'pl-snake', name: 'Snake Plant', unitsSold: 128 },
  { id: 'pl-pothos', name: 'Golden Pothos', unitsSold: 96 },
  { id: 'pl-zz', name: 'ZZ Plant', unitsSold: 72 },
  { id: 'pl-fiddle', name: 'Fiddle Leaf Fig', unitsSold: 54 },
];

const fiveItems: PopularItem[] = [
  ...sampleItems,
  { id: 'pl-calathea', name: 'Calathea Orbifolia', unitsSold: 40 },
];

describe('PopularList', () => {
  it('3 positive: up to four links in most-sold order with sold copy', { tags: '@component' }, () => {
    cy.mount(<PopularList items={sampleItems} />);

    cy.findByRole('list').within(() => {
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
    });

    cy.findByRole('link', { name: 'Snake Plant' }).should('have.attr', 'href', '/plants/pl-snake');
    cy.findByRole('link', { name: 'Golden Pothos' }).should('have.attr', 'href', '/plants/pl-pothos');
    cy.findByRole('link', { name: 'ZZ Plant' }).should('have.attr', 'href', '/plants/pl-zz');
    cy.findByRole('link', { name: 'Fiddle Leaf Fig' }).should('have.attr', 'href', '/plants/pl-fiddle');
  });

  it('3 edge: currentId matching an item is omitted', { tags: '@component' }, () => {
    cy.mount(<PopularList items={sampleItems} currentId="pl-pothos" />);

    cy.findByRole('list').within(() => {
      cy.findAllByRole('listitem').should('have.length', 3);
    });
    cy.findByRole('link', { name: 'Snake Plant' }).should('be.visible');
    cy.findByRole('link', { name: 'ZZ Plant' }).should('be.visible');
    cy.findByRole('link', { name: 'Fiddle Leaf Fig' }).should('be.visible');
    cy.get('body').should('not.contain', 'Golden Pothos');
  });

  it('3 edge: more than four after filter shows only four', { tags: '@component' }, () => {
    cy.mount(<PopularList items={fiveItems} currentId="pl-missing" />);

    cy.findByRole('list').within(() => {
      cy.findAllByRole('listitem').then(($items) => {
        expect($items, 'capped at four').to.have.length(4);
        expect($items.eq(0)).to.contain('Snake Plant');
        expect($items.eq(3)).to.contain('Fiddle Leaf Fig');
      });
    });
    cy.get('body').should('not.contain', 'Calathea Orbifolia');
  });

  it('3 edge: empty after filter renders nothing', { tags: '@component' }, () => {
    cy.mount(<PopularList items={[{ id: 'pl-snake', name: 'Snake Plant', unitsSold: 10 }]} currentId="pl-snake" />);

    cy.get('body').should('not.contain', 'Popular right now');
    cy.get('body').should('not.contain', 'Snake Plant');
  });

  it('3 accessibility: section labelled by Popular right now', { tags: '@component' }, () => {
    cy.mount(<PopularList items={sampleItems} />);

    cy.findByRole('region', { name: 'Popular right now' }).should('be.visible');
    cy.findByRole('heading', { level: 2, name: 'Popular right now' }).should('be.visible');
  });
});
