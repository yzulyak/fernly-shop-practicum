# Fernly findings

Findings are ordered by severity: money and privacy first, then broken flows, then everything else. Each finding needs evidence: a test that fails, or the exact steps and requests. Until a test proves it, an issue stays under "Suspicions — not yet tested".

## Entry format

```markdown
### F-NN: <one-line title: what is wrong>

- **Where:** <page, component, or endpoint>
- **Category:** <Components | Pages | Business rules in the API | The contract | Caching | Authorization | Accessibility>
- **Impact:** <the impact on a customer, in one sentence>
- **Evidence:** <the test that fails (file and test name), or the exact steps and requests>
- **Contradicts:** <the line in docs/PRODUCT.md or the API contract>
- **Suggested fix (optional):** <one line>
```

## Findings

### F-01: Browse treats a catalog 500 like an empty result

- **Where:** Browse page (`/`), `BrowsePage.tsx`
- **Category:** Pages
- **Impact:** A customer who can't load the catalog sees "No plants match your filters" and has no way to retry.
- **Evidence:** web/cypress/ui/browse.cy.ts — shows an error with Try again when the catalog returns 500 (executed)
- **Contradicts:** docs/PRODUCT.md — "If the catalog can't be loaded, the page says so and offers **Try again**. It never pretends there are no plants."
- **Suggested fix (optional):** On `plants.isError`, render `ErrorBanner` with Try again instead of `EmptyState`.

### F-02: Price `$0` is shown without two decimals

- **Where:** `PriceTag` / `formatPrice` on Browse plant cards
- **Category:** Components
- **Impact:** A free (or whole-dollar) plant is shown as `$0` / `$22` instead of `$0.00` / `$22.00`.
- **Evidence:** web/cypress/ui/browse.cy.ts — shows $0.00 for a plant priced at 0 (executed); card rendered `$0`
- **Contradicts:** docs/PRODUCT.md — "Every price is shown in dollars with **two decimals**, everywhere: `$12.50`, never `$12.5`."
- **Suggested fix (optional):** Pad `formatPrice` to always two decimal places (e.g. `toFixed(2)`).

### F-03: Any signed-in customer can delete another customer’s review

- **Where:** `DELETE /api/reviews/{reviewId}`
- **Category:** Authorization
- **Impact:** A shopper can erase someone else’s plant review; ownership is not enforced.
- **Evidence:** tests/api/plant-reviews.spec.ts — other signed-in customer cannot delete a review → 404 (executed; received 204 and review removed)
- **Contradicts:** docs/features/plant-reviews.md — “Only the author can delete a review. Anyone else gets Review not found.”
- **Suggested fix (optional):** Return 404 unless the bearer token’s user owns the review.

### F-04: Review average for 5, 4, 5 is 4.6 instead of 4.7

- **Where:** `GET /api/plants/{plantId}/reviews` `average`
- **Category:** Business rules in the API
- **Impact:** Shoppers see a lower average than the documented half-up rounding (4.666… → 4.7).
- **Evidence:** tests/api/plant-reviews.spec.ts — average for ratings 5, 4, 5 → 4.7 (one decimal, halves up) (executed; received 4.6)
- **Contradicts:** docs/features/plant-reviews.md — “The average is rounded to one decimal, halves up… show as **4.7**.”; OpenAPI ReviewList average description
- **Suggested fix (optional):** Round half away from zero to one decimal (e.g. multiply by 10, round, divide).

### F-05: Posted review does not appear in the list until a full reload

- **Where:** Plant page Reviews slot (`ReviewsSlot` invalidateQueries key)
- **Category:** Pages
- **Impact:** After posting, the customer sees the thank-you toast but the list/average stay stale.
- **Evidence:** web/cypress/ui/plant-reviews.cy.ts — 7 positive: list shows average/count/newest-first; POST thanks and refreshes (executed); tests/e2e/plant-reviews.spec.ts — sign in, post a valid review, see toast and updated list (executed). Invalidate uses `['review', plant.id]` while the query key is `['reviews', plant.id]`.
- **Contradicts:** docs/features/plant-reviews.md — “appears in the list right away, and the page thanks the customer.”
- **Suggested fix (optional):** Invalidate `['reviews', plant.id]` (match the query key).

### F-06: Star rating is not a keyboard-operable radio group

- **Where:** `StarRatingInput` on Write a review
- **Category:** Accessibility
- **Impact:** Keyboard and screen-reader users cannot change or hear which star is selected as documented.
- **Evidence:** web/cypress/component/ReviewForm.cy.tsx — 9 accessibility: radiogroup Your rating; Tab; arrows; selected announced (executed); tests/a11y/pages.spec.ts — Plant Reviews (signed-in) form radiogroup is named and operable (executed; no `aria-checked` after ArrowRight)
- **Contradicts:** docs/features/plant-reviews.md — “The star rating works with the keyboard like any group of radio buttons… a screen reader announces which star is selected.”
- **Suggested fix (optional):** Implement radiogroup semantics with `aria-checked`, roving tabindex, and arrow-key selection.

### F-07: Save (heart) button on plant cards has no accessible name

- **Where:** Browse plant cards (`PlantCard` save button)
- **Category:** Accessibility
- **Impact:** Screen-reader users cannot tell what the heart control does.
- **Evidence:** tests/a11y/pages.spec.ts — Browse has no blocking a11y violations (executed; axe `button-name` on every save button); hand check: `aria-label` null, only `aria-hidden` SVG
- **Contradicts:** docs/PRODUCT.md — “every button and form field has a name a screen reader can announce.”
- **Suggested fix (optional):** Add `aria-label` such as “Save Monstera Deliciosa” (and “Unsave…” when saved).

### F-08: PriceTag text fails contrast (about 2.3:1)

- **Where:** `PriceTag` (Browse, Plant, Checkout, and any page that shows prices)
- **Category:** Accessibility
- **Impact:** Shoppers with low vision may not read prices against the white background.
- **Evidence:** tests/a11y/pages.spec.ts — Browse / Plant / Plant Reviews (signed-out) / Checkout axe `color-contrast` on `.PriceTag-module__price` (executed)
- **Contradicts:** docs/PRODUCT.md — “text has enough contrast against its background (4.5:1 for normal text).”
- **Suggested fix (optional):** Darken the price color to meet 4.5:1 on white.

### F-09: Plant page hero image has no alternative text

- **Where:** Plant page large image
- **Category:** Accessibility
- **Impact:** Screen-reader users miss the plant photo entirely.
- **Evidence:** tests/a11y/pages.spec.ts — Plant / Plant Reviews (signed-out) axe `image-alt` (executed); hand check: `alt` is null on `/plants/pl-monstera`
- **Contradicts:** docs/PRODUCT.md — “every meaningful image has alternative text.”
- **Suggested fix (optional):** Set `alt` to the plant name (or empty `alt` only if decorative — it is not).

### F-10: Promo code field has no accessible name or visible label

- **Where:** `PromoCodeInput` on Cart
- **Category:** Accessibility
- **Impact:** Screen-reader users cannot identify the promo code field; sighted users see only a title paragraph, not a label for the input.
- **Evidence:** tests/a11y/pages.spec.ts — Cart has no blocking a11y violations (executed; axe `label`); web/cypress/component/PromoCodeInput.cy.tsx — 7f accessibility: code field has a visible accessible name (executed); tests/e2e/promo-codes.spec.ts — cart promo code field has a visible accessible name (executed)
- **Contradicts:** docs/features/promo-codes.md — “The code field has a visible label.”; docs/PRODUCT.md — “every button and form field has a name a screen reader can announce.”
- **Suggested fix (optional):** Associate a visible `<label>` (e.g. “Promo code”) with the input.

### F-11: Quantity `+` stays enabled at the stock limit

- **Where:** `QuantityStepper` (plant page and cart line)
- **Category:** Components
- **Impact:** A customer can click + at max stock; the control should stop them at the stock left.
- **Evidence:** web/cypress/component/QuantityStepper.cy.tsx — disables + at the stock limit (executed; button stays enabled when `value === max`); shop check on String of Pearls (stock 1): + enabled at quantity 1
- **Contradicts:** docs/PRODUCT.md — “at the stock limit, the + button is disabled.”
- **Suggested fix (optional):** Disable when `value >= max` (not `value > max`).

### F-12: Single-plant `rating` is a string, not a number

- **Where:** `GET /api/plants/{plantId}`
- **Category:** The contract
- **Impact:** Clients that expect a numeric rating can break or coerce wrongly.
- **Evidence:** tests/api/plants.spec.ts — a plant matches the Plant schema (executed; `/rating: must be number`); hand check: `"rating": "4.7"`
- **Contradicts:** OpenAPI `Plant` / `PlantSummary.rating` — `type: number`
- **Suggested fix (optional):** Serialize `rating` as a JSON number on the detail endpoint.

### F-13: `price-desc` sorts cheapest first

- **Where:** `GET /api/plants?sort=price-desc`; Browse “Price: high to low”
- **Category:** Business rules in the API
- **Impact:** Shoppers asking for most expensive first see the cheapest plant first ($0.99 Succulent Cutting).
- **Evidence:** tests/api/plants.spec.ts — price-desc returns the most expensive plant first (executed); tests/e2e/browse.spec.ts — choosing Price: high to low… (executed); hand check: first item `$0.99`
- **Contradicts:** docs/PRODUCT.md — “Price: high to low (most expensive first)”; contract: “price-desc (highest first)”
- **Suggested fix (optional):** Sort by price descending for `price-desc`.

### F-14: Percent promo discounts plants + shipping

- **Where:** `POST /api/cart/promo` with `LEAFY10`
- **Category:** Business rules in the API
- **Impact:** Customer is charged the wrong total — 10% is taken off shipping as well as plants.
- **Evidence:** tests/api/promo-codes.spec.ts — LEAFY10 on a non-empty cart → 10% of plant subtotal only (executed; Monstera $34.99 + ship $6.95 → discount `$4.19` instead of `$3.50`); tests/e2e/promo-codes.spec.ts — cart apply leafy10… (executed)
- **Contradicts:** docs/features/promo-codes.md — “A percentage code takes that percentage off the subtotal of the plants — never off shipping.”; CartSchema discount description
- **Suggested fix (optional):** Compute percent discount from `subtotal` only, not `subtotal + shipping`.

### F-15: Expired `SPRING5` is accepted

- **Where:** `POST /api/cart/promo` with `SPRING5`
- **Category:** Business rules in the API
- **Impact:** An expired code still reduces the cart; shoppers and the shop disagree on what “expired” means.
- **Evidence:** tests/api/promo-codes.spec.ts — SPRING5 expired → refused with expired message (executed; 200 with `promoCode: "SPRING5"`); tests/e2e/promo-codes.spec.ts — cart: expired SPRING5… (executed)
- **Contradicts:** docs/features/promo-codes.md — “Expired codes are refused, with a message that says the code has expired.”; table: SPRING5 valid until 30 Apr 2026
- **Suggested fix (optional):** Reject when today is after `expiresAt`, with an expired message and `promo_invalid`.

### F-16: Any signed-in customer can read another customer’s order

- **Where:** `GET /api/orders/{orderId}`
- **Category:** Authorization
- **Impact:** Order details (address, totals, promo) leak across accounts.
- **Evidence:** tests/api/promo-codes.spec.ts — other signed-in customer cannot GET an order → 404 (executed; received 200 with full order); hand check with two tokens
- **Contradicts:** docs/PRODUCT.md — “An order is private: only the customer who placed it can see it. Anyone else gets Order not found.”
- **Suggested fix (optional):** Return 404 unless the bearer token’s user owns the order.

### F-17: Refused promo message is not announced to assistive tech

- **Where:** `PromoCodeInput` error text
- **Category:** Accessibility
- **Impact:** Screen-reader users may miss that a code was refused.
- **Evidence:** web/cypress/component/PromoCodeInput.cy.tsx — 7g accessibility: refused-code message is announced to AT (executed; no `role="alert"` / live region)
- **Contradicts:** docs/features/promo-codes.md — “When a code is refused, the message is announced to screen-reader users as soon as it appears.”
- **Suggested fix (optional):** Render the error in a `role="alert"` or `aria-live="assertive"` region.

### F-18: Incomplete notify emails (`a@b`, `name@`) are accepted

- **Where:** `POST /api/plants/{plantId}/notify`
- **Category:** Business rules in the API
- **Impact:** Customers can sign up with addresses that cannot receive mail; they will never be notified.
- **Evidence:** tests/api/back-in-stock.spec.ts — incomplete email a@b / name@ → 400 validation_error (executed + hand: both → 201 `subscribed`); marked `test.fail` as known bug
- **Contradicts:** docs/features/back-in-stock.md — “The email must be a full address like `name@example.com`; `a@b` or `name@` are refused.”
- **Suggested fix (optional):** Reject incomplete addresses with 400 `validation_error`.

### F-19: Duplicate notify sign-ups are accepted (including case variants)

- **Where:** `POST /api/plants/{plantId}/notify`
- **Category:** Business rules in the API
- **Impact:** The same email can be stored more than once for one plant; case variants bypass uniqueness.
- **Evidence:** tests/api/back-in-stock.spec.ts — duplicate / case-variant → 409 already_subscribed (executed + hand: second POST and `AVA@Example.COM` → 201); marked `test.fail` as known bug
- **Contradicts:** docs/features/back-in-stock.md — “One sign-up per email per plant, ignoring upper and lower case: signing up again is refused with You're already on the list.”
- **Suggested fix (optional):** Compare emails case-insensitively and return 409 `already_subscribed` with that detail.

### F-20: StockBadge shows “Only 0 left” for out-of-stock

- **Where:** `StockBadge` / Browse plant cards
- **Category:** Components
- **Impact:** Out-of-stock cards show a false scarcity badge alongside “Out of stock”.
- **Evidence:** web/cypress/component/StockBadge.cy.tsx — 6e (executed; `@known-bug`); web/cypress/ui/browse-stock-badge.cy.ts — 8c (`@known-bug`); tests/e2e/back-in-stock.spec.ts — never Only 0 left (`test.fail`); hand: Chinese Money Plant search shows “Out of stock” and “Only 0 left”
- **Contradicts:** docs/features/back-in-stock.md — “At 0 the card shows only Out of stock — never Only 0 left.”
- **Suggested fix (optional):** Render the badge only when stock is 1, 2, or 3.

### F-21: Low-stock badge covers the plant photo (not under the name)

- **Where:** Browse `PlantCard` stock-badge slot / `StockBadge`
- **Category:** Pages
- **Impact:** “Only N left” sits on the photo (and near the save control) instead of with the tags under the name.
- **Evidence:** web/cypress/ui/browse-stock-badge.cy.ts — 8a / 8d (`@known-bug`); hand: String of Pearls shows “Only 1 left” overlaid on the photo (top-right), not under the name with care/pet tags
- **Contradicts:** docs/features/back-in-stock.md — “The badge sits with the other tags under the plant's name. It never covers the photo or the save button.”
- **Suggested fix (optional):** Place the badge in the tag row under the name, not absolutely over the image.

## Suspicions — not yet tested

Each line is something that looks different from `docs/PRODUCT.md` or the API contract, followed by the line it may contradict. "Seen" means it showed up once during the mapping walk; "Code" means it comes only from reading the source.

- Prices render without two decimals for non-zero amounts (`$22`, `$27.5`, `$12.5`, "Add $37.5 more for free shipping"); `formatPrice` rounds but never pads (seen). Related to F-02. — "Every price is shown in dollars with **two decimals**, everywhere."
- Care level 3 plants (Fiddle Leaf Fig, Calathea, String of Pearls) show "●●● Moderate care"; `CareLevelBadge` caps the label index at 2 (seen). — "Care level has three steps: 1 Easy, 2 Moderate, 3 Expert."
- After clicking "Calathea Orbifolia" under "Likes the same light" on Monstera, the address bar shows `/plants/pl-calathea` but the page still shows Monstera Deliciosa; the plant query key `['plant']` has no plant id, so Add to cart would add the wrong plant (seen once). — "The plant page always shows the plant in the address bar, including after following a 'Likes the same light' link."
- Cached single orders (query key `['order', id]`) and plant data aren't cleared at sign-out; only `cart` and `orders` are, so the next customer on the same device may see the previous customer's order from cache (code). — "An order is private: only the customer who placed it can see it." and "Signing out forgets the session on this device."
- The search field has no accessible name: the snapshot shows an unnamed `searchbox`, and "Search plants" is a `<span>` hint, not a label (seen). — "every button and form field has a name a screen reader can announce."

## Questions — neither document answers

- The "Paid" summary on a placed order still says "Add $37.5 more for free shipping." Should a finished order show that hint?
- `/login` and `/register` still show their forms to a signed-in customer. Should they redirect?
- The `?next=` check accepts any value that starts with `/`, including `//other-host`. Is that intended?
- On a narrow window the cart line's quantity stepper looked clipped, with the + button out of view. What's the supported minimum width?
- The Checkout empty state has no link back to the shop, but the Cart empty state does. Is that intended?
- `GET /api/orders` and `GET /api/orders/{id}` fire before the sign-in check redirects, so a signed-out visitor triggers 401s. Is that harmless?
- After a rejected cart quantity `PATCH` (400 with `detail`), should the cart show an error toast with that `detail` and keep the previous quantity? `docs/PRODUCT.md` and `docs/features/*` are silent; only `docs/APP-MAP.md` (CartPage) says so. Evidence: `web/cypress/ui/cart.cy.ts` CP-13 (skipped); hand check — PATCH 400, quantity stays 1, no toast. **Wrong plan/design row:** CartPage test-design **CP-13** (not a `feature/back-in-stock` plan row).
