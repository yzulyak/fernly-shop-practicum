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

## Suspicions — not yet tested

Each line is something that looks different from `docs/PRODUCT.md` or the API contract, followed by the line it may contradict. "Seen" means it showed up once during the mapping walk; "Code" means it comes only from reading the source.

- Prices render without two decimals for non-zero amounts (`$22`, `$27.5`, `$12.5`, "Add $37.5 more for free shipping"); `formatPrice` rounds but never pads (seen). Related to F-02. — "Every price is shown in dollars with **two decimals**, everywhere."
- `GET /api/plants?sort=price-desc` returns the cheapest plant first ($0.99 Succulent Cutting), in the same order as `price-asc` (seen). — "Price: high to low (most expensive first)"; contract: "price-desc (highest first)".
- Care level 3 plants (Fiddle Leaf Fig, Calathea, String of Pearls) show "●●● Moderate care"; `CareLevelBadge` caps the label index at 2 (seen). — "Care level has three steps: 1 Easy, 2 Moderate, 3 Expert."
- On String of Pearls (stock 1) the + button is enabled at quantity 1; `QuantityStepper` disables only when `value > max`, and the cart line uses the same stepper (seen on the plant page). — "at the stock limit, the + button is disabled."
- After clicking "Calathea Orbifolia" under "Likes the same light" on Monstera, the address bar shows `/plants/pl-calathea` but the page still shows Monstera Deliciosa; the plant query key `['plant']` has no plant id, so Add to cart would add the wrong plant (seen once). — "The plant page always shows the plant in the address bar, including after following a 'Likes the same light' link."
- `GET /api/plants/{plantId}` returns `rating` as the string `"4.7"`, while the list endpoint returns a number (seen with curl). — Contract: `PlantSummary.rating` is `type: number`.
- Cached single orders (query key `['order', id]`) and plant data aren't cleared at sign-out; only `cart` and `orders` are, so the next customer on the same device may see the previous customer's order from cache (code). — "An order is private: only the customer who placed it can see it." and "Signing out forgets the session on this device."
- The search field has no accessible name: the snapshot shows an unnamed `searchbox`, and "Search plants" is a `<span>` hint, not a label (seen). — "every button and form field has a name a screen reader can announce."
- The heart (save) button on every plant card has no accessible name; it holds only an `aria-hidden` SVG (seen: `aria-label` is null on all 12 cards). — "every button and form field has a name a screen reader can announce."
- The large plant image on the plant page has no `alt` attribute (seen: `alt` is null). — "every meaningful image has alternative text."
- Price text is `#8dbb8a` on white, about 2.3:1 contrast, used for every `PriceTag` (computed style seen; ratio calculated). — "text has enough contrast against its background (4.5:1 for normal text)."

## Questions — neither document answers

- The "Paid" summary on a placed order still says "Add $37.5 more for free shipping." Should a finished order show that hint?
- `/login` and `/register` still show their forms to a signed-in customer. Should they redirect?
- The `?next=` check accepts any value that starts with `/`, including `//other-host`. Is that intended?
- On a narrow window the cart line's quantity stepper looked clipped, with the + button out of view. What's the supported minimum width?
- The Checkout empty state has no link back to the shop, but the Cart empty state does. Is that intended?
- `GET /api/orders` and `GET /api/orders/{id}` fire before the sign-in check redirects, so a signed-out visitor triggers 401s. Is that harmless?
