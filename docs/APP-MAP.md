# Fernly app map

A map of the shop before testing: what each page shows, what it calls, and which states it has. Sources: `web/src/pages`, `web/src/components`, `web/src/api/queries.ts`, `web/src/auth/AuthContext.tsx`, the OpenAPI document at `http://localhost:8100/openapi.json`, and a walk through `http://localhost:5173` signed out and signed in as `ava@fernly.test` (Nov 1, 2026).

The web app calls the API through the dev-server proxy (`/api/...` on port 5173 goes to port 8100). The session token is kept in `localStorage` under `fernly_token`. Saved (heart) plants are kept in `localStorage` under `fernly_saved` and never reach the API.

Two calls happen on every page, from the shared `Layout` and `AuthProvider`:

- `GET /api/auth/me` once at start-up, only if a token is stored. If it fails, the token is deleted.
- `GET /api/cart` whenever a customer is signed in, to show the cart badge in the header.

## 1. Pages

| Path | What it shows | API calls it makes | Its states (loading, empty, error, signed out) |
| --- | --- | --- | --- |
| `/` (`BrowsePage`) | Hero banner; sidebar with `SearchBox`, `LightFilter`, a "Pet-safe plants only" checkbox and `SortSelect`; a results heading "N plants"; a grid of `PlantCard`s (12 per page); Previous / "Page X of Y" / Next. Filters live in the URL (`?search=&light=low,bright&petSafe=true&sort=&page=`). | `GET /api/plants?search=&light=&petSafe=true&sort=&page=` (sort and page are always sent; pageSize is the API's default of 12). | **Loading:** heading "Loading plants…" and six skeleton boxes. **Empty:** `EmptyState` "No plants match your filters". **Error:** the code shows the same `EmptyState` "No plants match your filters" with the heading "0 plants", and no Try again button. **Signed out:** same as signed in; hearts save to `localStorage`. |
| `/plants/:plantId` (`PlantPage`) | Large image, breadcrumb "Shop / {light}", name, Latin name, `CareLevelBadge`, `PetSafeTag`, light tag, rating, description, the price for the chosen size (`PriceTag`), `SizePicker`, `QuantityStepper`, an "Add to cart" button, "N in stock", and a "Likes the same light" list of links. A `Toast` confirms or reports the add. | `GET /api/plants/{plantId}`; `GET /api/plants?pageSize=48` (only to turn the similar ids into names); `POST /api/cart/lines` on Add to cart. | **Loading:** "Loading plant…". **Not found (404):** `EmptyState` "We couldn't find that plant" with "Back to the shop". **Error (other):** `ErrorBanner` "The plant couldn't be loaded." with Try again. **Out of stock:** button reads "Out of stock" and is disabled, the stepper is disabled, and the page says "Out of stock right now." **Signed out:** Add to cart goes to `/login?next=/plants/{id}`. **Add failed:** an error `Toast` shows the API's `detail`. |
| `/login` (`LoginPage`) | "Sign in" form: Email, Password, a Sign in button, and a link to create an account (it keeps `?next=`). | `POST /api/auth/login`; on success the cart query is refreshed (`GET /api/cart`), then the page goes to `next` (default `/`). | **Busy:** the button reads "Signing in…" and is disabled. **Error:** `ErrorBanner` with the API's `detail`. The form uses `noValidate`, so the browser does not check the fields. **Signed in:** the form still shows; there's no redirect. |
| `/register` (`RegisterPage`) | "Create an account" form: Name, Email, Password with the hint "At least 8 characters.", a Create account button, and a link to sign in. | `POST /api/auth/register`; then the same as sign-in. | **Busy:** "Creating…". **Error:** `ErrorBanner` with the API's `detail`. `noValidate`, so the 8-character rule is left to the API. **Signed in:** the form still shows. |
| `/cart` (`CartPage`) | "Your cart": one `CartLine` per line (image, name, size, price each, `QuantityStepper`, line total, Remove), an `OrderSummary` (subtotal, shipping or "Free", total, and the "Add $X more for free shipping" hint), the cart-summary slot, and "Go to checkout". | `GET /api/cart`; `PATCH /api/cart/lines/{lineId}` from the stepper; `DELETE /api/cart/lines/{lineId}` from Remove. | **Auth starting:** "Loading…". **Signed out:** redirect to `/login?next=/cart`. **Loading:** "Loading your cart…". **Error:** `ErrorBanner` "Your cart couldn't be loaded." with Try again. **Empty:** `EmptyState` "Your cart is empty" with "Browse plants". **Busy:** the stepper and Remove are disabled while a change is saving. **Change failed:** an error `Toast` shows the API's `detail`. |
| `/checkout` (`CheckoutPage`) | "Checkout": a "Shipping address" form (Full name, Street address, City, Postal code, all `required` but with `noValidate`), a "Place order" button, and an `OrderSummary`. | `GET /api/cart`; `POST /api/orders` with `{ shippingAddress }`. On success it refreshes the cart, orders and plants, then goes to `/orders/{id}?placed=1`. | **Auth starting:** "Loading…". **Signed out:** redirect to `/login?next=/checkout`. **Loading:** "Loading your cart…". **Error:** `ErrorBanner` "Your cart couldn't be loaded." with Try again. **Empty:** `EmptyState` "Your cart is empty" / "Add a plant before you check out." (no link). **Busy:** "Placing order…". **Order refused:** `ErrorBanner` with the API's `detail`. |
| `/orders` (`OrdersPage`) | "Your orders": one row per order with a link "Order {id}", the date, "N lines", and the total. | `GET /api/orders` (the query isn't gated on sign-in, so it fires before the redirect). | **Auth starting:** "Loading…". **Signed out:** redirect to `/login?next=/orders`. **Loading:** "Loading your orders…". **Error:** `ErrorBanner` "Your orders couldn't be loaded." with Try again. **Empty:** `EmptyState` "No orders yet". |
| `/orders/:orderId` (`OrderPage`) | "Order {id}", "Placed {date} · Ships to {name}, {city}", one row per line ("{qty} × {name} (size {S/M/L})" and the line total), and an `OrderSummary` titled "Paid". With `?placed=1`, a "Thank you! Your order is placed." status banner. | `GET /api/orders/{orderId}` (not gated on sign-in either). | **Auth starting:** "Loading…". **Signed out:** redirect to `/login?next=/orders/{id}`. **Loading:** "Loading order…". **Not found (404):** `EmptyState` "Order not found" with "Back to your orders". **Error (other):** `ErrorBanner` "The order couldn't be loaded." with Try again. |
| `*` (any other path) | `EmptyState` "Page not found" with "Back to the shop". | Only the shared calls. | One state. |
| Layout (every page) | Skip link "Skip to content"; header with the Fernly logo, Shop, Orders (signed in only), Cart with a badge of `itemCount` (hidden at 0), "Hi, {first name}" with Sign out, or a Sign in link; the footer. | `GET /api/auth/me` (start-up, if a token is stored); `GET /api/cart` (signed in). Sign out calls no API: it deletes the token and clears the cached `cart` and `orders` queries. | While auth starts, the header briefly shows the signed-out links (seen in the browser). |

## 2. Components

All of these are in `web/src/components/`. The props come from each component's TypeScript interface; `CareLevelBadge` and `PetSafeTag` declare their props inline instead.

| Name | File | Props (from its TypeScript interface) | What it shows | Pages that use it |
| --- | --- | --- | --- | --- |
| `CareLevelBadge` | `CareLevelBadge.tsx` | `{ level: 1 \| 2 \| 3 }` (inline type) | A pill with one to three dots (hidden from screen readers) and "{Easy/Moderate/Expert} care", coloured by level, with the title "How much care this plant needs". | Browse (inside `PlantCard`), Plant |
| `CartLine` | `CartLine.tsx` | `CartLineProps { line: CartLine; onQuantityChange: (lineId: string, quantity: number) => void; onRemove: (lineId: string) => void; busy?: boolean }` | One `<li>`: an image with empty alt, the name, "Size X · {price} each", a `QuantityStepper` (max = `line.stock`, label "Quantity of {name}"), the line total, and a Remove button (aria-label "Remove {name}"). | Cart |
| `EmptyState` | `Feedback.tsx` | `EmptyStateProps { title: string; message?: string; action?: ReactNode }` | A seedling icon, an `<h2>` title, an optional message and an optional action (link or button). | Browse, Plant (404), Cart, Checkout, Orders, Order (404), `*` route in `App.tsx` |
| `ErrorBanner` | `Feedback.tsx` | `ErrorBannerProps { message: string; onRetry?: () => void }` | A `role="alert"` box with the message and, if `onRetry` is given, a "Try again" button. | Plant, Cart, Checkout, Orders, Order, Login, Register |
| `Toast` | `Feedback.tsx` | `ToastProps { message: string; tone?: 'success' \| 'error'; onClose: () => void; duration?: number }` (default 4000 ms; 0 keeps it open) | A fixed `role="status"` message bottom right with a "Dismiss" (×) button; it closes itself after `duration`. | Plant, Cart |
| `LightFilter` | `LightFilter.tsx` | `LightFilterProps { value: Light[]; onChange: (value: Light[]) => void }` | A fieldset "Light" with checkboxes for Low, Medium and Bright light; toggling one adds it to or removes it from the list. | Browse |
| `OrderSummary` | `OrderSummary.tsx` | `OrderSummaryProps { itemCount: number; subtotal: number; shipping: number; total: number; title?: string }` (default title "Order summary"). Also exports `FREE_SHIPPING_FROM = 50`. | A section with "Subtotal (N item/items)", Shipping ("Free" when shipping is 0 and there are items, otherwise a price), Total, and "Add {50 − subtotal} more for free shipping." when there are items and the subtotal is under $50. | Cart, Checkout, Order (title "Paid") |
| `PetSafeTag` | `PetSafeTag.tsx` | `{ petSafe: boolean }` (inline type) | A pill reading "🐾 Pet safe" or "⚠ Not pet safe" (the icon is hidden from screen readers). | Browse (inside `PlantCard`), Plant |
| `PlantCard` | `PlantCard.tsx` | `PlantCardProps { plant: PlantSummary; saved?: boolean; onToggleSave?: (plantId: string) => void }` | An `<article>` with the image linked to the plant (alt = name), an "Out of stock" ribbon when stock is 0, a heart save button (`aria-pressed`, icon only) when `onToggleSave` is given, the name link, the Latin name, `CareLevelBadge`, `PetSafeTag`, the plant-card slot, `PriceTag`, and the rating "★ 4.7 out of 5". | Browse |
| `PriceTag` | `PriceTag.tsx` | `PriceTagProps { amount: number; size?: 'sm' \| 'md' \| 'lg'; label?: string }` (`label` is read by screen readers only) | A price formatted by `formatPrice` in `web/src/money.ts`, in light green bold text. | Browse (inside `PlantCard`), Plant, Cart (inside `CartLine` and `OrderSummary`), Checkout (inside `OrderSummary`), Orders, Order |
| `QuantityStepper` | `QuantityStepper.tsx` | `QuantityStepperProps { value: number; onChange: (value: number) => void; min?: number; max: number; disabled?: boolean; label?: string }` (`min` defaults to 1; `label` to "Quantity") | A labelled group with "Decrease quantity" (−), the value in an `aria-live` `<output>`, and "Increase quantity" (+). | Plant, Cart (inside `CartLine`) |
| `SearchBox` | `SearchBox.tsx` | `SearchBoxProps { value: string; onSearch: (value: string) => void }` | A `role="search"` form: a decorative icon, a visual hint "Search plants" (a `<span>`, not a label), a search input, a "Clear search" (×) button when there is text, and a "Search" submit button. It sends the trimmed text. | Browse |
| `SizePicker` | `SizePicker.tsx` | `SizePickerProps { sizes: { label: SizeLabel; priceDelta: number }[]; value: SizeLabel; onChange: (size: SizeLabel) => void; name?: string }` | A fieldset "Size" with one radio card per size: "Small / Medium / Large" and "Base price" or "+{delta}". | Plant |
| `SortSelect` | `SortSelect.tsx` | `SortSelectProps { value: Sort; onChange: (value: Sort) => void }` | A "Sort by" select: Featured, Price: low to high, Price: high to low, Name: A to Z, Best rated. | Browse |

Feature slots (`web/src/slots/Slot.tsx`): `PlantPageSlot { plant: Plant }` on the plant page, `PlantCardSlot { plant: PlantSummary }` inside each `PlantCard`, and `CartSummarySlot { cart: Cart }` on the cart page. They render every `.tsx` file in `slots/plant-page/`, `slots/plant-card/` and `slots/cart-summary/`. Those folders don't exist yet, so the slots render nothing.

## 3. API

"Needs sign-in?" follows the OpenAPI document (endpoints with `bearer` security answer `401 auth_required` without a token). Rejected requests return `{ detail, rule }`; 404s have no `rule`.

| Method and path | Used by which page | Needs sign-in? |
| --- | --- | --- |
| `GET /api/health` | None (system check) | No |
| `POST /api/admin/reset` | None (test setup: restores the seed data) | No |
| `GET /api/plants` | Browse (`search`, `light`, `petSafe`, `sort`, `page`); Plant (`pageSize=48`, for the names in "Likes the same light") | No |
| `GET /api/plants/{plantId}` | Plant | No |
| `POST /api/auth/register` | Register | No |
| `POST /api/auth/login` | Login | No |
| `GET /api/auth/me` | Every page, once at start-up when a token is stored (`AuthProvider`) | Yes |
| `GET /api/cart` | Every page while signed in (header badge, `Layout`); Cart; Checkout | Yes |
| `POST /api/cart/lines` | Plant (Add to cart) | Yes |
| `PATCH /api/cart/lines/{lineId}` | Cart (quantity stepper) | Yes |
| `DELETE /api/cart/lines/{lineId}` | Cart (Remove) | Yes |
| `POST /api/orders` | Checkout (Place order) | Yes |
| `GET /api/orders` | Orders | Yes |
| `GET /api/orders/{orderId}` | Order | Yes (and only the customer who placed it; anyone else gets 404) |

Seed data seen during the walk: 21 plants. Useful boundaries: `pl-pilea` Chinese Money Plant has stock 0; `pl-pearls` String of Pearls has stock 1; `pl-thai` has stock 2, the longest name and the top price ($189); `pl-bird` Bird of Paradise costs exactly $50; `pl-cutting` Succulent Cutting costs $0.99. Ava (`usr-ava`, "Ava Green") starts with an empty cart and no orders; Ben was not signed in during the walk.
