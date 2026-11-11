# Test design: PromoCodeInput

Approved from `docs/test-plans/feature/promo-codes.md` row 7 (feature/promo-codes).

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| 7a | positive | idle, `onApply` spy | types code with spaces + Apply | `onApply` called with trimmed code | promo-codes.md: Apply | callback |
| 7b | positive | `appliedCode="LEAFY10"` | views + clicks Remove | shows code applied; `onRemove` called | promo-codes.md: Remove | callback |
| 7c | negative | empty field | views Apply | Apply disabled | plan row 7 | disabled state |
| 7d | negative | `busy` | views Apply / Remove | controls disabled while busy | plan row 7 | busy state |
| 7e | negative | `error="…expired…"` | views | error text visible | promo-codes.md: refused message | error state |
| 7f | accessibility | idle | inspect field | visible accessible name for the code field | promo-codes.md: “The code field has a visible label.” | accessibility |
| 7g | accessibility | `error` set | inspect error | refused-code message announced to AT (`role="alert"` or live region) | promo-codes.md: announced to screen-reader users | accessibility |

**Status:** approved (plan row 7).
