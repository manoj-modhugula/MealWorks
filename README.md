# MealWorks

Personalized office cafeteria guidance. Staff publish a daily menu (photo or structured entry); employees set dietary preferences and receive a clear **Today** view of recommended and excluded dishes.

Built with **Next.js**, **SQLite**, and **OpenRouter** (`google/gemini-3.1-flash-lite`).

## Requirements

- Node.js 20+ recommended  
- npm  

## Quick start

```bash
cd MealWorks
cp .env.example .env
# Set OPENROUTER_API_KEY and AUTH_SECRET in .env

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Development admin (seeded)

| | |
|--|--|
| **Email** | `cafe.admin@example.com` |
| **Password** | Value of `ADMIN_PASSWORD` in `.env` (see `.env.example`) |

Sign in as admin to open the **Admin** suite. Override credentials with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME`.

**Important:** These defaults are for local development only. Change them before any shared or production deployment.

### Employee path

1. Register an employee account  
2. Complete onboarding preferences  
3. Admin publishes today’s menu (upload or sample)  
4. Open **Today** for a personal match  

## Environment

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `OPENROUTER_BASE_URL` | Default `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL` | Default `google/gemini-3.1-flash-lite` |
| `AUTH_SECRET` | Session signing secret |
| `APP_URL` | Public app origin (e.g. `http://localhost:3000`) |
| `DATABASE_PATH` | SQLite file path (default `./data/mealworks.db`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Seeded admin |
| `SMTP_*` / `EMAIL_FROM` | Required for signup OTP, reset, step-up, and optional digest email |
| `ALLOWED_EMAIL_DOMAINS` | Optional office lock (comma-separated) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google sign-in |
| `APPLE_ID` / `APPLE_SECRET` | Optional Apple sign-in (HTTPS `APP_URL`) |
| `CRON_SECRET` | Required in production for digest tick |
| `ADMIN_RESET_ON_BOOT` | Set `1` only when you intend to reset the seeded admin password |

Never commit `.env`. Use `.env.example` as the template.

## Features

### Employee

- **Accounts** — email OTP before the account exists, optional Google/Apple, forgot password, step-up code to change or delete  
- **Today** — date navigation, week fit, hybrid match (rules + optional AI polish), Good / Maybe / Skip, allergy-aware reasons  
- **Menu** — shared board for the selected day (includes always-on Salad Compose)  
- **Preferences** — diet, allergies, avoids, likes, soft dislikes, goals, notes  
- **Settings** — digest schedule, appearance, password (with email code), delete account  

### Admin

- Overview and team management  
- Menu post (upload / sample) and item edit  
- Preference preview simulation  
- Digest run / tick endpoints  

## Scripts

```bash
npm run dev       # development server
npm run dev:clean # clear .next and start
npm run build     # production build
npm run start     # production server
npm test          # unit tests
npm run lint      # ESLint
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Sample menu

`public/sample-menu.png` is used by the admin sample-menu flow.

## Security

- Do not commit `.env` or database files under `data/`  
- User uploads under `public/uploads/` are ignored by git  
- Rotate API keys and admin credentials for any non-local environment  
- Signup does not create a user until the email OTP is confirmed  
- Sensitive account changes require a fresh email code  
- Allergy and hard-avoid rules are enforced in application code, not by the model alone  

## License

MIT — see [LICENSE](./LICENSE).
