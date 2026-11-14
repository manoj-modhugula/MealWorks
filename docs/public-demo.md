# Public demo

Anonymous visitors to `/` are redirected to `/demo/today`. The demo also exposes `/demo/menu`, `/demo/preferences` and `/demo/settings`. Signed-in visitors continue through `/continue`, which selects onboarding, Today or Admin based on their account.

The demo uses the same screen components as the authenticated application. `DemoExperience` provides an isolated in-memory workspace containing sample preferences, reviews and a separate cache. Changes survive navigation within the demo and reset on reload. Sample preferences recalculate recommendations locally. Unknown operations fail closed. Digest previews do not send email. Demo Settings explains the sample workspace instead of offering account actions. Timezone syncing is skipped on demo routes.

Authenticated screens use their API matches. The demo never reads the account cache or database. Private pages retain their authentication guard; private endpoints retain their existing session checks. `/api/me` continues to return `{user: null}` for anonymous requests.

`src/lib/sample-catalog.ts` defines the sample dishes and photo lookup. `public/images/sample-menu.png` is bundled with the app so the demo does not depend on uploaded files or a seeded database. The catalog contains 23 dishes. The initial sample profile has eight Good lunch dishes with distinct photos.

## Fit score

Fit measures the availability of recommended choices at each offered meal. Three breakfast choices, four lunch choices and three Salad Compose choices reach the 97 ceiling. Scores average coverage across the meals present in the menu. Avoid and caution dishes never contribute.

Local matching, AI-polished matching, cached matches and week scores share this calculation. Cached results are recalculated when read. Fit describes choice availability, not the percentage of all dishes a person should eat.

## Verification

Run `npm ci`, `npm run lint`, `npm test` and `npm run build`. Tests cover choice coverage, sample preference changes, cache isolation, dated reviews, temporary restrictions and blocked network operations. Browser checks cover guest navigation, review editing, preference saves, digest previews, scroll resets and responsive layouts.

Guest access does not configure hosting. A public deployment still needs its own application origin, authentication settings, database and email configuration.
