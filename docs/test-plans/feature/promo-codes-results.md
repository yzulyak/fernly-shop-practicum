# Results: feature/promo-codes

| row | test | result | possible finding |
| --- | --- | --- | --- |
| 1 | API LEAFY10 percent of plant subtotal only; unknown → `promo_invalid`; lowercase `leafy10` | **PARTIAL** (unknown/schema OK; **discount uses subtotal+shipping**) | **F-14:** percent promo discounts plants + shipping |
| 2 | API FREESHIP under $50 → shipping 0 / discount 0; LEAFY10 on ≥$50 keeps free shipping (threshold before discount) | **PASS** | — |
| 3 | API SPRING5 expired; empty cart `empty_cart`; no auth `auth_required`; blank body `validation_error` | **PARTIAL** (empty/auth/validation pass; **SPRING5 → 200**) | **F-15:** expired SPRING5 accepted |
| 4 | API DELETE clears promo; second code replaces; DELETE with none → 200 | **PASS** | — |
| 5 | API place order keeps promo; cart forgets; other user GET order → 404 | **PARTIAL** (keep/forget pass; **other user → 200**) | **F-16:** order not private |
| 6 | Cypress component `OrderSummary` discount line | **PASS** | — |
| 7 | Cypress component `PromoCodeInput` apply/remove/busy/errors + a11y label/live | **PARTIAL** (behavior pass; **label + alert a11y fail**) | **F-10** (label); **F-17** (not announced) |
| 8 | Cypress UI cart promo apply/remove; invalid/expired errors; Playwright e2e leafy10 / SPRING5 / label | **PARTIAL** (mocked UI pass; e2e leafy10/SPRING5/label fail as known bugs) | **F-14**, **F-15**, **F-10** |
| 9 | Cypress UI checkout shows discount; e2e checkout with FREESHIP | **PASS** | — |
| 10 | Cypress UI order Paid discount; e2e order retains FREESHIP | **PASS** | — |
| 11 | API GET cart includes `discount` / `promoCode` (Cart schema) | **PASS** | — |

## Evidence labels

- **executed** — Playwright `tests/api/promo-codes.spec.ts`, `tests/e2e/promo-codes.spec.ts`; Cypress `web/cypress/component/OrderSummary.cy.tsx`, `PromoCodeInput.cy.tsx`, `web/cypress/ui/cart-promo.cy.ts`.
- **assumed — ask** (no tests): UI replace-without-Remove; exact expired copy string; empty-cart promo field UX.
