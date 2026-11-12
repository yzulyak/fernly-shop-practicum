---
name: diff-to-test-plan
description: Reads a code change (a git diff or a pull request) in Fernly and writes a test plan that sends each changed area to the right test level and specialist. Use when the user asks what to test for a change, a branch, a pull request, a diff or a new feature. Writes docs/test-plans/<branch>.md and stops for approval. Do NOT use to write tests.
paths: "docs/**"
---

# Diff to test plan

1. **Read the change.** Take the git diff or pull request. Read the docs it touches (`docs/PRODUCT.md`, `docs/features/*.md`).

2. **Path map** — send each changed path to its level and specialist:

   | Path | Level | Specialist |
   |---|---|---|
   | `web/src/components/**` | Cypress component tests | component-test-design, then cypress-test-writer |
   | `web/src/pages/**` and `web/src/slots/**` | Cypress UI tests with a mocked API, plus Playwright e2e, plus an axe scan of that page | — |
   | `web/src/api/**` | Playwright e2e (caching and data flow) | — |
   | `api/src/**` | Playwright API tests with schema checks | — |
   | `api/src/schemas.ts` or new OpenAPI paths | schema checks on every affected response | — |
   | anything else in `package.json` or config | the full suite | — |

3. **The plan.** A short summary of the change, then one table:

   ID | area | what changed | risk to a customer | level | specialist | cases (positive / negative / edge / accessibility) | source (the doc line)

   Money, privacy and sign-in rows first.

4. Write the plan to `docs/test-plans/<branch>.md`.

5. What no document says: a row marked `assumed — ask`.

6. **Stop.** Show the plan and wait for "approved" or changes. Write no tests.
