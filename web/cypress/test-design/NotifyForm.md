# Test design: NotifyForm

Approved from `docs/test-plans/feature/back-in-stock.md` row 7 (feature/back-in-stock).

Props: `plantName`, `onSubmit(email)`, `busy?`, `error?`, `subscribedEmail?`.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| 7a | interaction | idle form, `plantName="Chinese Money Plant"`, `onSubmit` spy | types email with spaces, clicks Notify me | `onSubmit` called once with trimmed email | back-in-stock.md: Email me when it's back / Notify me | callback |
| 7b | state | `subscribedEmail="shopper@example.com"`, plantName set | views form | `role="status"` “We'll email shopper@example.com when Chinese Money Plant is back.” | back-in-stock.md: confirms which address will be emailed | success state |
| 7c | negative | empty email | views form | Notify me disabled | component props / UX | empty state |
| 7d | negative | `error="You're already on the list"` | views form | `role="alert"` shows that message | PRODUCT.md a11y; back-in-stock errors | error state |
| 7e | edge | `busy={true}` with non-empty typed email | views form | Notify me disabled | component `busy` prop | busy state |
| 7f | accessibility | idle form | inspects field | accessible name via label “Email me when it's back” (`htmlFor` / `findByLabelText`) | PRODUCT.md: every form field has a name | accessibility |
| 7g | accessibility | success / error props | views | success announced via `role="status"`; error via `role="alert"` | PRODUCT.md; plan row 7 | accessibility |

**Status:** approved (plan row 7).
