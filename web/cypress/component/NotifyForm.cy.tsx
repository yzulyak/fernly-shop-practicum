import { NotifyForm } from '../../src/components/NotifyForm';

describe('NotifyForm', () => {
  it('7a interaction: types email with spaces, clicks Notify me → onSubmit trimmed', { tags: '@component' }, () => {
    const onSubmit = cy.spy().as('onSubmit');
    cy.mount(<NotifyForm plantName="Chinese Money Plant" onSubmit={onSubmit} />);

    cy.findByLabelText("Email me when it's back").type('  shopper@example.com  ');
    cy.findByRole('button', { name: 'Notify me' }).click();

    cy.get('@onSubmit').should('have.been.calledOnceWith', 'shopper@example.com');
  });

  it('7b state: subscribedEmail shows status with address and plant name', { tags: '@component' }, () => {
    cy.mount(
      <NotifyForm
        plantName="Chinese Money Plant"
        onSubmit={cy.spy()}
        subscribedEmail="shopper@example.com"
      />,
    );

    cy.findByRole('status').should(
      'contain',
      "We'll email shopper@example.com when Chinese Money Plant is back.",
    );
  });

  it('7c negative: Notify me disabled when email empty', { tags: '@component' }, () => {
    cy.mount(<NotifyForm plantName="Chinese Money Plant" onSubmit={cy.spy()} />);

    cy.findByRole('button', { name: 'Notify me' }).then(($btn) => {
      expect($btn, 'Notify me when empty').to.be.disabled;
    });
  });

  it('7d negative: error prop shown in role="alert"', { tags: '@component' }, () => {
    cy.mount(
      <NotifyForm
        plantName="Chinese Money Plant"
        onSubmit={cy.spy()}
        error="You're already on the list"
      />,
    );

    cy.findByRole('alert').should('contain', "You're already on the list");
  });

  it('7e edge: Notify me disabled when busy with typed email', { tags: '@component' }, () => {
    cy.mount(<NotifyForm plantName="Chinese Money Plant" onSubmit={cy.spy()} busy />);

    cy.findByLabelText("Email me when it's back").type('shopper@example.com');
    cy.findByRole('button', { name: 'Notify me' }).then(($btn) => {
      expect($btn, 'Notify me while busy').to.be.disabled;
    });
  });

  it('7f accessibility: email field named via label “Email me when it\'s back”', { tags: '@component' }, () => {
    cy.mount(<NotifyForm plantName="Chinese Money Plant" onSubmit={cy.spy()} />);

    cy.findByLabelText("Email me when it's back").should('be.visible');
  });

  it('7g accessibility: success via role="status"; error via role="alert"', { tags: '@component' }, () => {
    cy.mount(
      <NotifyForm
        plantName="Chinese Money Plant"
        onSubmit={cy.spy()}
        subscribedEmail="shopper@example.com"
      />,
    );
    cy.findByRole('status').should('be.visible');

    cy.mount(
      <NotifyForm
        plantName="Chinese Money Plant"
        onSubmit={cy.spy()}
        error="You're already on the list"
      />,
    );
    cy.findByRole('alert').should('contain', "You're already on the list");
  });
});
