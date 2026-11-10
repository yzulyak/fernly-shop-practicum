import { OrderSummary } from '../../src/components/OrderSummary';

describe('OrderSummary discount line', () => {
  it('6a positive: discount > 0 shows Discount (LEAFY10) and −$…', { tags: '@component' }, () => {
    cy.mount(
      <OrderSummary
        itemCount={1}
        subtotal={34.99}
        shipping={6.95}
        total={37.75}
        discount={4}
        promoCode="LEAFY10"
      />,
    );

    cy.findByText('Discount (LEAFY10)').should('be.visible');
    cy.findByText('−$4').should('be.visible');
  });

  it('6b positive: discount 0 hides discount row', { tags: '@component' }, () => {
    cy.mount(
      <OrderSummary itemCount={1} subtotal={34.99} shipping={6.95} total={41.94} discount={0} promoCode={null} />,
    );

    cy.findByText(/^Discount/).should('not.exist');
  });

  it('6c edge: discount without promoCode shows Discount only', { tags: '@component' }, () => {
    cy.mount(
      <OrderSummary itemCount={1} subtotal={20} shipping={6.95} total={24.95} discount={2} promoCode={null} />,
    );

    cy.findByText('Discount').should('be.visible');
    cy.findByText('Discount (').should('not.exist');
    cy.findByText('−$2').should('be.visible');
  });
});
