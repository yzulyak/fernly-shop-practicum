# Test design: ReviewForm + StarRatingInput

Approved from `docs/test-plans/feature/plant-reviews.md` row 9 (feature/plant-reviews).

| ID | kind | given | the user does | expected | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| 9a | interaction | idle form, `onSubmit` spy | chooses stars + types ≥10 chars + Post review | `onSubmit` called once with `{ rating, text }` | plant-reviews.md: Write a review 1–5 / 10–500 | callback |
| 9b | state | `busy={true}` | views form | submit button disabled and labeled “Posting…” | component props / UX | busy state |
| 9c | negative | rating 0 or text &lt;10 | submits | `role="alert"` problem message; `onSubmit` not called | plant-reviews.md: rating + min length | boundary |
| 9d | edge | `error="Server said no."` | views form | alert shows that server error | component `error` prop | error state |
| 9e | edge | idle form | inspects textarea | `maxLength` is 500 | plant-reviews.md: 10 to 500 | boundary |
| 9f | accessibility | idle form | Tab into rating; arrow keys; select a star | radiogroup named “Your rating”; focus moves in group; arrow keys change rating; selected star has `aria-checked` / announced name | plant-reviews.md: “star rating works with the keyboard like any group of radio buttons” | accessibility |

**Status:** approved (plan row 9).
