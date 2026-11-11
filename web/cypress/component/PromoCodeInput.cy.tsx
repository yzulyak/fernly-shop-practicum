import { PromoCodeInput } from '../../src/components/PromoCodeInput';

describe('PromoCodeInput', () => {
  it('7a positive: Apply calls onApply with trimmed code', { tags: '@component' }, () => {
    const onApply = cy.spy().as('onApply');
    cy.mount(<PromoCodeInput appliedCode={null} onApply={onApply} onRemove={cy.spy()} />);

    cy.get('input').type('  leafy10  ');
    cy.findByRole('button', { name: 'Apply' }).click();
    cy.get('@onApply').should('have.been.calledOnceWith', 'leafy10');
  });

  it('7b positive: applied state shows code; Remove calls onRemove', { tags: '@component' }, () => {
    const onRemove = cy.spy().as('onRemove');
    cy.mount(<PromoCodeInput appliedCode="LEAFY10" onApply={cy.spy()} onRemove={onRemove} />);

    cy.findByText(/Code/).should('contain', 'LEAFY10');
    cy.findByRole('button', { name: 'Remove' }).click();
    cy.get('@onRemove').should('have.been.calledOnce');
  });

  it('7c negative: Apply disabled when empty', { tags: '@component' }, () => {
    cy.mount(<PromoCodeInput appliedCode={null} onApply={cy.spy()} onRemove={cy.spy()} />);

    cy.findByRole('button', { name: 'Apply' }).then(($btn) => {
      expect($btn, 'Apply when empty').to.be.disabled;
    });
  });

  it('7d negative: Apply and Remove disabled when busy', { tags: '@component' }, () => {
    cy.mount(<PromoCodeInput appliedCode={null} onApply={cy.spy()} onRemove={cy.spy()} busy />);
    cy.get('input').type('LEAFY10');
    cy.findByRole('button', { name: 'Apply' }).then(($btn) => {
      expect($btn, 'Apply while busy').to.be.disabled;
    });

    cy.mount(<PromoCodeInput appliedCode="FREESHIP" onApply={cy.spy()} onRemove={cy.spy()} busy />);
    cy.findByRole('button', { name: 'Remove' }).then(($btn) => {
      expect($btn, 'Remove while busy').to.be.disabled;
    });
  });

  it('7e negative: error text is shown', { tags: '@component' }, () => {
    cy.mount(
      <PromoCodeInput
        appliedCode={null}
        onApply={cy.spy()}
        onRemove={cy.spy()}
        error="This code has expired."
      />,
    );

    cy.findByText('This code has expired.').should('be.visible');
  });

  it('7f accessibility: code field has a visible accessible name', { tags: ['@component', '@known-bug'] }, () => {
    cy.mount(<PromoCodeInput appliedCode={null} onApply={cy.spy()} onRemove={cy.spy()} />);

    cy.findByLabelText(/promo code/i).should('be.visible');
  });

  it('7g accessibility: refused-code message is announced to AT', { tags: ['@component', '@known-bug'] }, () => {
    cy.mount(
      <PromoCodeInput
        appliedCode={null}
        onApply={cy.spy()}
        onRemove={cy.spy()}
        error="This code has expired."
      />,
    );

    cy.findByRole('alert').should('contain', 'This code has expired.');
  });
});
