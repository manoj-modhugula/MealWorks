# MealWorks — Architecture

Personalized office cafeteria guidance: cafe staff publish a daily menu; employees set diet and preferences; each person receives a **Today** match (recommended items, items to avoid, and plate combinations).

---

## 1. Purpose and scope

| Actor | Goal |
|-------|------|
| **Employee** | Register → onboarding → **Today** match, **Menu**, **Preferences**, **Settings** |
| **Cafe admin** | Publish and edit menus, preview matches, manage team, run digests |

**Out of scope (current):** multi-tenant cafes, native mobile apps, real-time collaboration.

---

## 2. High-level system

```
┌────────────────────────────────────────────────────────────┐
│  Browser (Next.js App Router, client components)           │
└───────────────┬────────────────────────────┬───────────────┘
                │                            │
                ▼                            ▼
┌───────────────────────────────┐  ┌─────────────────────────┐
│  Next.js server               │  │  Static / uploads       │
│  Route handlers · Auth ·      │  │  public/uploads/menus/* │
│  Domain services              │  │  public/sample-menu.png │
└───────────────┬───────────────┘  └─────────────────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌───────────────┐  ┌─────────────────────┐
│ SQLite        │  │ OpenRouter          │
│ better-sqlite3│  │ Vision + JSON model │
│ + Drizzle     │  └─────────────────────┘
└───────────────┘
        │
        ▼
┌───────────────┐
│ SMTP (optional)│  digest email
└───────────────┘
```

Single process, single SQLite file. Digests run on demand or via a tick endpoint / light in-process scheduler.

---

## 3. Technology stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind 4 + application design tokens |
| Auth | Auth.js (NextAuth v5) credentials + JWT |
| Database | SQLite (`better-sqlite3`) + Drizzle ORM |
| Validation | Zod on key API bodies |
| AI | OpenRouter (OpenAI-compatible client) |
| Email | Nodemailer (optional SMTP) |
| Tests | Vitest |

---

## 4. Repository layout

```
src/
  app/
    (auth)/          # login, register, continue
    (app)/           # authenticated shell
    api/             # JSON route handlers
  components/        # navigation, carousel, UI primitives
  lib/
    db/              # schema, connection, seed admin
    services.ts      # domain orchestration
    matching.ts      # deterministic rules engine
    agents.ts        # AI extract / interpret / polish
    openrouter-ai.ts
    salad-compose.ts # always-on Salad Compose station
data/                # SQLite file (gitignored)
public/uploads/      # menu images (gitignored content)
```

**Dependency rule:** routes and pages call **services** (and auth). AI and rules live in **agents** / **matching**. UI does not access the database directly.

---

## 5. Routes

### Pages

| Path | Auth | Notes |
|------|------|--------|
| `/` | — | Entry redirect |
| `/login`, `/register` | public | Credentials |
| `/continue` | session | Post-login routing |
| `/onboarding` | session | First-run preferences |
| `/today` | session | Primary match surface |
| `/menu` | session | Shared menu board |
| `/preferences` | session | Preference editor |
| `/settings` | session | Account and digests |
| `/admin` | session | Admin suite (`isAdmin`) |

### API (grouped)

- Auth / account: `/api/register`, `/api/auth/*`, `/api/me`, `/api/account`  
- Preferences: `/api/preferences`, `/api/preferences/temporary`  
- Menu read: `/api/menu/today`, `/api/menus/dates`, `/api/week`  
- Match: `/api/match/today`, `/api/feedback`  
- Digests: `/api/digests/*`, `/api/admin/digests/*`  
- Admin: overview, menu CRUD, preview, users, match clear  

---

## 6. Data model

Primary tables (see `src/lib/db/schema.ts`):

- **users** — identity, password hash, admin flag  
- **preference_profiles** — diet, avoids, likes, allergies, digest schedule  
- **temporary_restrictions** — dated avoid windows  
- **menu_days** / **menu_items** — published menu  
- **match_results** — cached per-user match payload  
- **digest_logs** — digest history  
- **dish_feedback** — per-dish feedback  

Prefs arrays and full match payloads are stored as JSON text for simplicity.

### Core types (`lib/types.ts`)

- **StructuredMenu** — meals → stations → items `{ name, tags }`  
- **PrefsInput** — diet and preference lists  
- **MatchPayload** — verdict, score, items, combos, `source` (`baseline` | `hybrid` | `ai`)  

---

## 7. Core flows

### Auth

Register stores a pending signup and emails a 6-digit OTP; the `users` row is created only after the code is confirmed.  
Optional Google / Apple sign-in (provider-verified email, linked by address).  
Login → rate limit → bcrypt verify (verified accounts only) → JWT (`id`, `email`, `isAdmin` refreshed from DB).  
Password change, reset, and account delete require a fresh email OTP.  
Seed admin on database open when env credentials are configured (password is not rewritten on every boot unless `ADMIN_RESET_ON_BOOT=1`).

### Menu publish

Upload image → store under `public/uploads/menus` → vision extract → `menu_days` / `menu_items` → invalidate related matches.  
Fallback: sample menu when vision is unavailable.

**Salad Compose** is merged into every active lunch menu (not derived from OCR).

### Match (Today)

1. Resolve active menu for date  
2. Return cached `match_results` when valid  
3. Otherwise `matchMenuToPrefs` → upsert cache  

### Hybrid matching

1. **matching.matchMenuLocal** — deterministic diet / allergy / avoid rules, score, combos  
2. **agents.matchMenuToPrefs** — optional AI polish of copy and edge cases  
3. Safety: hard avoids and allergies cannot be overridden by the model  

### Digests

Optional SMTP; `runDueDigests` / admin tick honor local time and timezone.

---

## 8. Client concerns

| Concern | Approach |
|---------|----------|
| Session | NextAuth provider |
| Navigation | Role-aware app nav; optional sliding selection indicator |
| Today performance | Short client cache; rematch control |
| Plates | Fixed three-slot carousel from `payload.combos` |
| Dates | Device timezone sync |

---

## 9. External integrations

| System | Use | Failure mode |
|--------|-----|----------------|
| OpenRouter | Menu vision, pref interpret, match polish | Local baseline match; `aiStatus` on payload |
| SMTP | Digest email | In-app only when unconfigured |
| Filesystem | Menu images | Paths on `menu_days` |

---

## 10. Security notes

- Passwords: bcrypt  
- Sessions: JWT; admin claim at login  
- Rate limits on sensitive auth paths  
- Secrets only in `.env` (gitignored)  
- Allergy enforcement is application-level  

---

## 11. Configuration

| Variable | Role |
|----------|------|
| `OPENROUTER_*` | AI provider |
| `AUTH_SECRET` | Session signing |
| `APP_URL` | Canonical origin |
| `DATABASE_PATH` | SQLite path (default `./data/mealworks.db`) |
| `ADMIN_*` | Seeded admin |
| `SMTP_*` / `EMAIL_FROM` | Digests |
| `CRON_SECRET` | Optional tick guard |

---

## 12. Operational characteristics

| Topic | Design |
|-------|--------|
| Scale | Single-node SQLite; suitable for one office / demo |
| Cache | Per user × menu day match rows |
| Invalidation | Prefs or menu item changes clear relevant matches |
| Testing | Unit tests on matching rules |

---

## 13. Design decisions

1. **Hybrid match** — fast, safe baseline; AI improves language and edge cases  
2. **Cached match payloads** — reduces cost and latency  
3. **Always-on Salad Compose** — fixed bar not left to OCR  
4. **JSON columns for prefs/payload** — iteration speed; normalize later if needed  
5. **Credentials auth** — minimal setup for office deployment  

---

## 14. Mental model

```
Admin menu  →  StructuredMenu (+ Salad Compose)
Employee prefs →  Rules baseline → optional AI polish → MatchPayload
Today UI       →  Score + decisions + plate combos
Persistence    →  SQLite match_results + optional client cache
```
