# Test design: ReviewList

Approved from `docs/test-plans/feature/plant-reviews.md` row 8 (feature/plant-reviews).

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| 8a | render | `average={4.7}`, `count={2}`, two reviews (newer first in props) | views list | average shown with `toFixed(1)` (“4.7 out of 5”); “2 reviews”; each item shows author, stars, date, text | plant-reviews.md: Reviews section bullets | equivalence / props |
| 8b | render | `count={1}`, one review | views list | singular “1 review” | plant-reviews.md: count wording | boundary (1) |
| 8c | edge | `count={0}`, `reviews={[]}`, `average={0}` | views list | empty invitation: “No reviews yet. Be the first to share how it's growing.” | plant-reviews.md: empty-state bullet | empty state |
| 8d | accessibility | a review with `rating={4}` | views list | visually-hidden “4 out of 5” for that rating | plant-reviews.md / a11y rating pattern | accessibility |

**Status:** approved (plan row 8).
