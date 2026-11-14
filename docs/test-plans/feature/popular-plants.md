# Test plan: feature/popular-plants

Plant pages get a **Popular right now** list: plants ranked by units sold in the last 30 days. This branch adds `GET /api/popular`, a seeded sales history, a `PopularList` component, and a plant-page slot that fetches the list and omits the plant on screen.

Sources: `docs/features/popular-plants.md`, OpenAPI registration in `api/src/features/popular.ts`.

| ID | area | what changed | risk to a customer | level | specialist | cases (positive / negative / edge / accessibility) | source (the doc line) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `GET /api/popular` shape & limit | New catalog endpoint; `limit` 1–12 (default 4); `PopularList` schema (`days: 30`, items with `unitsSold`) | Wrong count or invalid payload misleads shoppers / breaks clients | Playwright API + schema | — | **positive:** no `limit` → 200, `days === 30`, up to **4** items; each item matches `PopularPlant` (plant summary + int `unitsSold`); `limit=1` and `limit=12` → that many or fewer. **negative:** `limit=0`, `limit=13`, non-integer → 400 `validation_error`. **edge:** `limit=5` returns at most 5. | popular-plants.md: “GET /api/popular?limit=N returns up to N plants (1 to 12, default 4)… limit outside 1–12 gets 400 validation_error”; OpenAPI 200/400 |
| 2 | Ranking: units sold, 30 days, ties | Popularity by **units** (not orders), last 30 days only; ties by name A→Z; out-of-stock excluded | Shopper sees the wrong “popular” plants or dead links to zero-stock items | Playwright API | — | **positive:** items ordered by `unitsSold` descending; equal `unitsSold` → name A→Z. **edge:** workshop-style bulk (many units, few orders) ranks by **units**, not order count — e.g. cuttings with qty 40 count as 40. **negative / edge:** no item with `stock === 0` (seed out-of-stock plant, e.g. Chinese Money Plant, must not appear). | popular-plants.md: “units sold, not orders… workshop that buys 40 cuttings… counts as 40”; “Only sales from the last 30 days”; “Ties: by name, A to Z”; “Plants that are out of stock are left out” |
| 3 | `PopularList` component | Presentational ordered list; filters `currentId`; caps at four; sold copy | Wrong plants or copy on every plant page that uses the component | Cypress component | component-test-design, then cypress-test-writer | **positive:** up to four links, most-sold order preserved; each shows `{unitsSold} sold this month`; links to `/plants/{id}`. **edge:** `currentId` matching an item is omitted; more than four after filter → only four; empty after filter → renders nothing. **accessibility:** section labelled by “Popular right now” (`aria-labelledby` / heading). | popular-plants.md: “four plants, most popular first… units sold… ‘128 sold this month’. The plant on screen is left out…” |
| 4 | Plant page Popular slot | Slot fetches `/popular?limit=5`, passes `currentId` | List missing, shows current plant, or wrong count on the plant page | Cypress UI (mocked API) | cypress-test-writer | **positive:** mocked popular payload → “Popular right now” with up to four other plants and sold copy. **edge:** when current plant is in the mocked top set, it is absent and another plant can fill the fourth slot (limit 5 → four after exclude). **negative:** no data / pending → section not shown (null). | popular-plants.md: “Every plant page… four plants… The plant on screen is left out of its own page's list.” |
| 5 | Plant page popular flow | End-to-end against real API | Ranking/UI disagree; current plant still listed | Playwright e2e | — | **positive:** open a plant page → Popular section lists plants (≠ current) with “sold this month”; order matches `GET /api/popular` after excluding current. **edge:** open the #1 popular plant’s page → that plant is absent; still up to four others. **negative:** follow a popular link → lands on that plant’s page (URL `/plants/:id`). | popular-plants.md: full “How it should behave” list bullets |
| 6 | Plant page accessibility | New Popular section on `/plants/:plantId` | Popular block fails axe / keyboard / names | axe scan (`tests/a11y`) | — | **accessibility:** scan plant page with Popular visible; heading/name association; list links keyboard-reachable and named; sold text contrast. | popular-plants.md: section on plant page; PRODUCT.md WCAG 2.1 AA |
| 7 | Load: popular + catalog at busy hour | Doc SLO under ~20 concurrent shoppers | Slow or failing popular/catalog under browse load | Playwright API (load) | — | **positive:** ~20 concurrent `GET /api/popular` → **no failures**; **95% ≤ 300 ms**. **edge / regression:** same concurrency on `GET /api/plants` → **95% ≤ 300 ms**. | popular-plants.md: “How fast it must be” (20 shoppers; 95% of popular within 300 ms, no failures; catalog still 95% within 300 ms) |

## Notes

- No money, privacy, or sign-in surface in this change; customer-facing ranking correctness (IDs 1–2) comes first.
- CSS-only (`PopularList.module.css`) and `docs/features/popular-plants.md` have no separate test rows.
- Assert documented behavior even if implementation differs (units vs orders, out-of-stock exclusion, SLO); failures are findings, not softened expectations.
- Load harness details (exact tool, warm-up, sample size for p95) are **assumed — ask** if the repo has no existing load pattern for this SLO.

### Assumed — ask

| Topic | Why |
| --- | --- |
| Load-test harness | Feature doc requires p95 ≤ 300 ms at ~20 concurrent shoppers; confirm preferred runner (Playwright parallel requests vs external tool) and sample size before implementing row 7. |
| Stable expected top-N identities | Sales history is seeded/deterministic at API start — confirm whether tests may hard-assert specific plant IDs/order, or only relative ordering and schema. |
