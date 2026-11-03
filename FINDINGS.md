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

None yet. Nothing has been proven by a test.

## Suspicions — not yet tested

Each line is something that looks different from `docs/PRODUCT.md` or the API contract, followed by the line it may contradict. "Seen" means it showed up once during the mapping walk; "Code" means it comes only from reading the source.

- Prices render without two decimals (`$22`, `$27.5`, `$12.5`, "Add $37.5 more for free shipping"); `formatPrice` rounds but never pads (seen). — "Every price is shown in dollars with **two decimals**, everywhere: `$12.50`, never `$12.5`."
- `GET /api/plants?sort=price-desc` returns the cheapest plant first ($0.99 Succulent Cutting), in the same order as `price-asc` (seen). — "Price: high to low (most expensive first)"; contract: "price-desc (highest first)".
- Care level 3 plants (Fiddle Leaf Fig, Calathea, String of Pearls) show "●●● Moderate care"; `CareLevelBadge` caps the label index at 2 (seen). — "Care level has three steps: 1 Easy, 2 Moderate, 3 Expert."
- On String of Pearls (stock 1) the + button is enabled at quantity 1; `QuantityStepper` disables only when `value > max`, and the cart line uses the same stepper (seen on the plant page). — "at the stock limit, the + button is disabled."
- After clicking "Calathea Orbifolia" under "Likes the same light" on Monstera, the address bar shows `/plants/pl-calathea` but the page still shows Monstera Deliciosa; the plant query key `['plant']` has no plant id, so Add to cart would add the wrong plant (seen once). — "The plant page always shows the plant in the address bar, including after following a 'Likes the same light' link."
- If `GET /api/plants` fails, the Browse page shows "No plants match your filters" and "0 plants" with no retry; the code treats `isError` like an empty result (code). — "If the catalog can't be loaded, the page says so and offers Try again. It never pretends there are no plants."
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
