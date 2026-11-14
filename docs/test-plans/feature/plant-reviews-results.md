# Results: feature/plant-reviews

| row | test | result | possible finding |
| --- | --- | --- | --- |
| 1 | API POST `/api/plants/{plantId}/reviews` (auth): positive 201 + author name; negative 401 `auth_required`; edge unknown plant 404 | **PASS** | — |
| 2 | API DELETE `/api/reviews/{reviewId}`: positive author 204 + gone from GET; negative 401 `auth_required`; edge other customer 404; unknown id 404 | **PARTIAL** (author/401/unknown pass; **other customer → 204**, review removed) | **F-03:** any signed-in customer can delete another’s review |
| 3 | API one review per customer per plant: first 201; second 409 `already_reviewed`; other plant still 201 | **PASS** | — |
| 4 | API POST body validation: rating 1/5 and text 10/500 → 201; rating 0/6/1.5, text 9, empty body → 400 `validation_error`; trim short → 400; trim valid → 201 | **PASS** | — |
| 5 | API GET reviews: seed ReviewList newest-first + count; unknown 404; empty plant 0/0/[]; average for 5,4,5 → **4.7** | **PARTIAL** (list/404/empty pass; **average returned 4.6**) | **F-04:** average rounds 4.666… to 4.6 instead of halves-up 4.7 |
| 6 | Cypress UI Reviews slot (sign-in): signed-in form; signed-out Sign in + `next`; load error ErrorBanner + retry | **PASS** | — |
| 7 | Cypress UI Reviews slot (list + post): list average/count/newest; client validation; empty copy; POST thanks + refresh | **PARTIAL** (list/validation/empty pass; **POST toast ok but list does not refetch**) | **F-05:** reviews query not invalidated after POST (`['review']` vs `['reviews']`) |
| 8 | Cypress component `ReviewList`: average `toFixed(1)`, singular/plural, empty copy, visually-hidden “N out of 5” | **PASS** | — |
| 9 | Cypress component `ReviewForm` + `StarRatingInput`: submit, busy, validation, server error, maxLength 500; a11y radiogroup/keyboard/`aria-checked` | **PARTIAL** (behavior pass; **a11y keyboard/`aria-checked` fail**) | **F-06:** star radios missing `aria-checked` / not keyboard-operable like radio group |
| 10 | Playwright e2e plant reviews flow: post + toast + list; guest sign-in link; second review refused; seed newest first | **PARTIAL** (guest/duplicate/seed order pass; **posted review not visible in list after toast**) | Same as **F-05** (confirmed end-to-end against real API) |
| 11 | a11y plant page Reviews: signed-out landmark/heading + axe; signed-in form radiogroup named/operable + axe | **FAIL** | Radiogroup named but **not operable** (no `aria-checked` / arrows) → **F-06**. Axe also blocked on pre-existing Plant `color-contrast` (PriceTag) and `image-alt` (hero) — already under Suspicions, not new Reviews defects. |

## Evidence labels

- **executed** — all rows above via Playwright (`tests/api/plant-reviews.spec.ts`, `tests/e2e/plant-reviews.spec.ts`, `tests/a11y/pages.spec.ts`) and Cypress (`web/cypress/ui/plant-reviews.cy.ts`, `web/cypress/component/ReviewList.cy.tsx`, `web/cypress/component/ReviewForm.cy.tsx`).
- **inspected only** — none required beyond executed failures.
- **not yet tested** — UI delete affordance (none in product; covered at API only per plan note).
