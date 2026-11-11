import { StockBadge } from '../../src/components/StockBadge';

describe('StockBadge', () => {
  it('6a shows Only 1 left when stock is 1', { tags: '@component' }, () => {
    cy.mount(<StockBadge stock={1} />);
    cy.findByText('Only 1 left');
  });

  it('6b shows Only 2 left when stock is 2', { tags: '@component' }, () => {
    cy.mount(<StockBadge stock={2} />);
    cy.findByText('Only 2 left');
  });

  it('6c shows Only 3 left when stock is 3', { tags: '@component' }, () => {
    cy.mount(<StockBadge stock={3} />);
    cy.findByText('Only 3 left');
  });

  it('6d renders nothing when stock is 4', { tags: '@component' }, () => {
    cy.mount(
      <div>
        <span>ready</span>
        <StockBadge stock={4} />
      </div>,
    );
    cy.findByText('ready');
    cy.findByText('Only 4 left').should('not.exist');
    cy.findByText(/Only \d+ left/).should('not.exist');
  });

  it('6e renders nothing when stock is 0 — never Only 0 left', { tags: ['@component', '@known-bug'] }, () => {
    cy.mount(
      <div>
        <span>ready</span>
        <StockBadge stock={0} />
      </div>,
    );
    cy.findByText('ready');
    cy.findByText('Only 0 left').should('not.exist');
  });
});
