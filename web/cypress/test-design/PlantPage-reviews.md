# Test design: Plant page Reviews slot

Approved from `docs/test-plans/feature/plant-reviews.md` rows 6–7 (feature/plant-reviews).

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| 6a | positive | signed-in mock (`fernly_token` + `GET /api/auth/me`); plant + reviews OK | opens `/plants/pl-monstera` | Reviews section shows “Write a review” form (heading + rating + textarea + Post review) | plant-reviews.md: “Signed-in customers see Write a review” | state (signed in) |
| 6b | negative | signed-out (no token); plant + reviews OK | opens `/plants/pl-monstera` | “Sign in to write a review” with link to `/login?next=/plants/pl-monstera`; no Write a review form | plant-reviews.md: “Everyone else sees Sign in to write a review” | state (signed out) |
| 6c | edge | `GET /api/plants/{id}/reviews` → 500 | opens plant page | ErrorBanner (“Reviews couldn't be loaded.”) + Try again; retry re-requests reviews | plant-reviews.md / ErrorBanner pattern | state (error) |
| 7a | positive | mocked list with average, count, newest-first items; signed-in; POST → 201 then refreshed list | sees list; posts valid stars + ≥10 chars | average/count/items newest-first; after POST: “Thanks for your review!” toast and list includes the new review | plant-reviews.md: average/newest first; “appears in the list right away, and the page thanks the customer” | happy path + callback refresh |
| 7b | negative | signed-in; reviews loaded | submit with no stars, or text &lt;10 | `role="alert"` client message; no POST to `/api/plants/.../reviews` | plant-reviews.md: “1–5 star rating and a text of 10 to 500 characters” | boundary / client validation |
| 7c | edge | reviews `count` 0 / empty `reviews` | opens plant page | empty invitation copy “No reviews yet…” | plant-reviews.md: “With no reviews, the section says so…” | empty state |

**Status:** approved (plan rows 6–7).
