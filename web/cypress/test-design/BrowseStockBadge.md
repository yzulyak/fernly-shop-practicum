# Test design: Browse plant-card stock badge

Approved from `docs/test-plans/feature/back-in-stock.md` row 8 UI portion (feature/back-in-stock).

Page: Browse (`/`) with mocked `GET /api/plants*`.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| 8a | positive | catalog fixture with a plant stock 1–3 (e.g. stock 2) | opens `/` | card shows “Only 2 left” with other tags under the plant name | back-in-stock.md: Only N left; badge with other tags under name | happy path |
| 8b | negative | catalog fixture plant stock &gt; 3 | opens `/` | that card has no “Only N left” badge | back-in-stock.md: more than 3 → no badge | negative |
| 8c | edge | catalog fixture plant stock 0 | opens `/` | card shows “Out of stock”; never “Only 0 left” | back-in-stock.md: At 0 only Out of stock | edge |
| 8d | edge | low-stock card with photo + save control | opens `/` | “Only N left” does not cover the plant photo or the save (heart) button (geometry) | back-in-stock.md: never covers photo or save | layout |

**Status:** approved (plan row 8 UI).
