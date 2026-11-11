# Test design: StockBadge

Approved from `docs/test-plans/feature/back-in-stock.md` row 6 (feature/back-in-stock).

Props: `stock: number`.

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| 6a | render | `stock={1}` | views badge | text “Only 1 left” | back-in-stock.md: “Only N left” when 1, 2 or 3 | boundary — 1 |
| 6b | render | `stock={2}` | views badge | text “Only 2 left” | back-in-stock.md | equivalence — mid low-stock |
| 6c | render | `stock={3}` | views badge | text “Only 3 left” | back-in-stock.md | boundary — 3 |
| 6d | negative | `stock={4}` | views badge | renders nothing (no “Only 4 left”) | back-in-stock.md: more than 3 → no badge | boundary — one past limit |
| 6e | edge | `stock={0}` | views badge | renders nothing — never “Only 0 left” | back-in-stock.md: “At 0 the card shows only Out of stock — never Only 0 left” | boundary — zero |

**Status:** approved (plan row 6).
