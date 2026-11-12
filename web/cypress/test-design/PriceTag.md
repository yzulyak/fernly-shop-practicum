# PriceTag — component test design

Props: `amount: number`, `size?: 'sm' | 'md' | 'lg'` (default `'md'`), `label?: string` (screen-reader only).

Used in: PlantCard, PlantPage, CartLine, OrderSummary, OrdersPage / Order.

| ID | kind | given | the user does | expected | source | technique |
|----|------|-------|---------------|----------|--------|-----------|
| PT-01 | render | `amount={12.5}` (default size, no label) | looks at the price | shows `$12.50` | PRODUCT.md: "Every price is shown in dollars with **two decimals**, everywhere: `$12.50`, never `$12.5`." | equivalence — single decimal |
| PT-02 | render | `amount={24}` | looks at the price | shows `$24.00` | PRODUCT.md: two decimals everywhere | equivalence — whole dollars |
| PT-03 | render | `amount={22.99}` | looks at the price | shows `$22.99` | PRODUCT.md: two decimals everywhere | equivalence — already two decimals |
| PT-04 | boundary | `amount={0}` | looks at the price | shows `$0.00` | PRODUCT.md: two decimals everywhere | boundary — zero |
| PT-05 | boundary | `amount={0.99}` | looks at the price | shows `$0.99` | PRODUCT.md: two decimals everywhere | boundary — under one dollar |
| PT-06 | boundary | `amount={9999.99}` | looks at the price | shows `$9999.99` | the component's purpose | boundary — large amount |
| PT-07 | boundary | `amount={12.505}` | looks at the price | shows `$12.51` (rounded to two decimals) | PRODUCT.md: two decimals; `formatPrice` rounds | boundary — third decimal (round half up / banker's?) |
| PT-08 | state | `amount={12.5}`, no `size` | looks at the price | renders at default medium size (same visual contract as `size="md"`) | APP-MAP: size defaults to `md` | equivalence — default size |
| PT-09 | state | `amount={12.5}`, `size="sm"` | looks at the price | price is visible and still formatted `$12.50` (sm size applied) | APP-MAP / CartLine uses `size="sm"` | equivalence — size sm |
| PT-10 | state | `amount={12.5}`, `size="lg"` | looks at the price | price is visible and still formatted `$12.50` (lg size applied) | APP-MAP / PlantPage & OrderSummary use `size="lg"` | equivalence — size lg |
| PT-11 | accessibility | `amount={37.5}`, `label="Line total"` | hears / reads accessible name | announces "Line total: $37.50" (label is visually hidden, price is visible) | APP-MAP: "`label` is read by screen readers only"; CartLine / Orders use this | accessibility — sr-only label |
| PT-12 | accessibility | `amount={12.5}`, no `label` | looks / listens | shows `$12.50` with no extra hidden label text | the component's purpose | accessibility — optional label absent |
| PT-13 | accessibility | `amount={12.5}` (any size) | checks contrast of the price text vs its background | contrast ≥ 4.5:1 | PRODUCT.md: "text has enough contrast against its background (4.5:1 for normal text)" | accessibility — contrast |
| PT-14 | boundary | `amount={-1}` | looks at the price | *assumed — ask* (negative prices not documented) | assumed — ask | boundary — negative |

## Notes for review

- PT-01 / PT-02 are the strongest candidates to catch the known suspicion that `formatPrice` emits `$12.5` / `$22` instead of padded two decimals.
- PT-13 matches the FINDINGS suspicion that `#8dbb8a` on white is ~2.3:1; keep or drop depending on whether component tests should assert computed contrast.
- PT-07 rounding rule for exactly `.xx5` is not spelled out in PRODUCT.md beyond "two decimals"; confirm expected string before implementing.
- No interaction rows: PriceTag is display-only (no callbacks, no controls).
