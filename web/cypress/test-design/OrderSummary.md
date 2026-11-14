# Test design: OrderSummary

Approved from `docs/test-plans/feature/promo-codes.md` row 6 (feature/promo-codes).

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| 6a | positive | `discount={4}` `promoCode="LEAFY10"` | views summary | row `Discount (LEAFY10)` and `−$…` amount | promo-codes.md: Discount (LEAFY10) −$4.00 | props |
| 6b | positive | `discount={0}` | views summary | no Discount row | promo-codes.md: discount line only when saving | props |
| 6c | edge | `discount={2}` `promoCode={null}` | views summary | row labeled `Discount` only (no code) | plan row 6 edge | props |

**Status:** approved (plan row 6).
