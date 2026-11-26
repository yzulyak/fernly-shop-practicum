# Results: feature/popular-plants

| row | test | result | possible finding |
| --- | --- | --- | --- |
| 1 | `GET /api/popular` default → 200 PopularList days 30 ≤4 items | PASS | — |
| 1 | `limit=1` / `limit=12` caps | PASS | — |
| 1 | `limit=5` → at most 5 | PASS | — |
| 1 | `limit=0` / `13` / `abc` → 400 `validation_error` | PASS | — |
| 2 | ordered by `unitsSold` desc; ties A→Z | PASS | — |
| 2 | workshop bulk cuttings rank by units, not orders | FAIL (expected F-18) | **F-18:** ranks by order count; Succulent Cutting absent from top 12 |
| 2 | out-of-stock plants left out | FAIL (expected F-19) | **F-19:** Chinese Money Plant (`pl-pilea`, stock 0) appears in popular |
| 3 | PopularList component (5 Cypress cases) | PASS | — |
| 4 | Plant Popular slot UI mocked (3 Cypress cases) | PASS | — |
| 5 | plant page Popular matches API after exclude current | PASS | — |
| 5 | #1 popular plant omitted; up to four others | PASS | — |
| 5 | follow popular link → that plant’s page | FAIL (expected F-21) | **F-21:** URL updates; h1 stays on previous plant |
| 6 | Plant Popular section named / keyboard / axe | PASS* | Pre-existing **F-08** / **F-09** on plant page (`test.fail`); Popular region/links OK |
| 7 | k6 smoke (1 VU) | PASS | popular ~135 ms; catalog &lt;1 ms; 0 failures |
| 7 | k6 load (20 VUs, 45s) | FAIL | **F-20:** popular p95 **2.05 s** (target ≤300 ms); catalog p95 **1.72 s** (target ≤300 ms); failures **0%** |

\* Axe still reports F-08/F-09; Popular-specific checks (region name, focusable named links, sold copy) held.

## Artifacts

| Kind | Path |
| --- | --- |
| API | `tests/api/popular-plants.spec.ts` |
| E2E | `tests/e2e/popular-plants.spec.ts` |
| Page object | `tests/pages/PlantPage.ts` (popular locators) |
| A11y | `tests/a11y/pages.spec.ts` (Plant Popular case) |
| Cypress component | `web/cypress/component/PopularList.cy.tsx` |
| Cypress UI | `web/cypress/ui/plant-popular.cy.ts` |
| Fixtures | `web/cypress/fixtures/popular/*.json` |
| k6 | `tests/performance/popular-plants.js` |
| Findings | `FINDINGS.md` F-18 … F-21 |

## Row verdicts

| row | verdict |
| --- | --- |
| 1 | **PASS** |
| 2 | **PARTIAL** (ordering OK; units + OOS FAIL → F-18, F-19) |
| 3 | **PASS** |
| 4 | **PASS** |
| 5 | **PARTIAL** (2/3 PASS; link navigation FAIL → F-21) |
| 6 | **PASS** (Popular a11y OK; plant page still F-08/F-09) |
| 7 | **FAIL** (load p95 over SLO → F-20; smoke PASS; no request failures) |

## k6 load numbers (keep)

- Profile: `PROFILE=load`, 20 VUs, 45s, 378 iterations, 756 HTTP requests
- Targets: popular p95 ≤ 300 ms, catalog p95 ≤ 300 ms, no failures
- Measured: popular p95 = **2050 ms**, catalog p95 = **1720 ms**, popular_failures = **0%**, catalog_failures = **0%**, http_req_failed = **0%**
