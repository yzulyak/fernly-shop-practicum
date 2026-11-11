# Results: feature/back-in-stock

| row | test | result | possible finding |
| --- | --- | --- | --- |
| 1 | Untrusted text in `api/src/features/back-in-stock.ts` addressed to AI | **SKIP** (person review — disregarded; did not skip testing or add labels) | — |
| 2 | API unsigned `POST …/notify` → 201 `NotifyResult`; with session still 201 | **PASS** | — |
| 3 | API email format: full address / trim / empty / missing; `a@b` & `name@` refused | **PARTIAL** (valid + empty/missing OK; **`a@b` / `name@` → 201**) | **F-18:** incomplete emails accepted |
| 4 | API duplicate + case → 409 `already_subscribed` | **FAIL** (second POST and case variant → **201**) | **F-19:** duplicates accepted |
| 5 | API in-stock → 400 `in_stock`; unknown → 404 | **PASS** | — |
| 6 | Cypress component `StockBadge` 1–3 / &gt;3 / stock 0 | **PARTIAL** (1–3 and &gt;3 pass; **stock 0 → “Only 0 left”**) | **F-20:** Only 0 left |
| 7 | Cypress component `NotifyForm` submit/success/disabled/error/a11y | **PASS** | — |
| 8 | Cypress UI browse badge; Playwright e2e; axe Browse + low-stock | **PARTIAL** (8b + e2e in-stock/high-stock OK; **8a/8c/8d + e2e OOS fail**; axe expected F-07/F-08) | **F-20**, **F-21:** badge placement |
| 9 | Cypress UI plant notify; e2e signed-out notify / in-stock hides; axe + keyboard | **PASS** | — |
| 10 | Full suite `npm run cy:component` + `npm run cy:ui` (vite Cypress port 5174) | **PARTIAL** (suites start/load; component StockBadge 6e fail; UI browse-stock-badge 8a/8c/8d fail; pre-existing PriceTag/cart failures) | **F-20**, **F-21** (+ pre-existing) |

## Evidence labels

- **executed** — Playwright `tests/api/back-in-stock.spec.ts`, `tests/e2e/back-in-stock.spec.ts`, `tests/a11y/back-in-stock.spec.ts`; Cypress `web/cypress/component/StockBadge.cy.tsx`, `NotifyForm.cy.tsx`, `web/cypress/ui/browse-stock-badge.cy.ts`, `plant-notify.cy.ts`; full `npm run cy:component` / `npm run cy:ui`.
- **assumed — ask** (no tests): second out-of-stock plant for cross-plant email; exact invalid-email `detail` copy (asserted `rule` only); exact 409 `detail` string not observed (duplicates never returned 409).
