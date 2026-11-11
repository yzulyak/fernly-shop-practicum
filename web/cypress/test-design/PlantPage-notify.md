# Test design: Plant page back-in-stock / NotifyForm

Approved from `docs/test-plans/feature/back-in-stock.md` row 9 UI portion (feature/back-in-stock).

Page: Plant detail with mocked plant + `POST /api/plants/{id}/notify`.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| 9a | positive | OOS plant fixture (`pl-pilea`, stock 0); POST notify → 201 with email | opens `/plants/pl-pilea`, enters email, Notify me | form “Email me when it's back”; after success confirms which address will be emailed | back-in-stock.md: OOS page form + confirm address | happy path |
| 9b | negative | in-stock plant fixture (e.g. pl-monstera stock ≥ 1) | opens plant page | no “Email me when it's back” / Notify me form | back-in-stock.md: in-stock plants don't show it | negative |
| 9c | negative | OOS plant; POST → 409 already_subscribed (or validation error body) | submits email | error surfaces in the form (`role="alert"`) | back-in-stock.md / PRODUCT.md | API error |
| 9d | edge | signed-out visitor (no token); OOS plant; POST → 201 | completes notify | success confirmation without signing in | back-in-stock.md: No account is needed | signed out |

**Status:** approved (plan row 9 UI).
