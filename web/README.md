# @ehsbha/web

Production-grade React web frontend for Ehsbha — runs alongside `backend/` and `mobile/` in the monorepo.

## Stack

React 19 · TypeScript 5.7 · Vite 6 · TailwindCSS 3 · Radix UI · TanStack Query 5 · Zustand 4 · React Hook Form · Zod · Framer Motion · Recharts · `vite-plugin-pwa` (Workbox).

## Run

```bash
# from repo root (workspaces handle install)
npm install --workspaces --legacy-peer-deps

# start backend in one terminal (see ../README.md)
npm run backend:dev

# then in another terminal:
npm run web:dev
# → http://localhost:5173
```

Default API base URL is `http://localhost:4000/api/v1`. Override via `web/.env`:

```
VITE_API_URL=http://localhost:4000/api/v1
```

Demo login (seeded by backend): `+201000000001` / `demo1234`.

## Build

```bash
npm run web:typecheck
npm run web:build
npm run web:preview          # preview the production build
```

## Pages (all routes)

All 20 mandated pages are wired and lazy-loaded. Every protected page hits the live backend via TanStack Query (persisted to `localStorage` for instant cold-start UX) and updates reactively on writes (mutations invalidate the right keys — analytics, decisions, score, etc. refresh after a trip/expense is added).

| Route                  | Page                  | What it does                                                                                          |
| ---------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| `/login`               | Login                 | Phone + password, demo-account autofill, JWT issued                                                   |
| `/register`            | Register              | New driver account in seconds                                                                         |
| `/`                    | Dashboard             | Today KPIs · forecast · top-3 decisions · driver score (animated ring) · recent trips                |
| `/trips`               | Trips list            | Filter by today / 7d / 30d / this month / all; tap any trip to drill in                              |
| `/trips/new`           | Add trip              | Full form: vehicle, app, area, times, gross/received/tip/commission, total/paid km, notes            |
| `/trips/:id`           | Trip details          | Read view + inline edit + delete with confirm                                                        |
| `/expenses`            | Expenses              | Month total · category breakdown bars · list with delete · add via dialog                            |
| `/maintenance`         | Maintenance hub       | Vehicle selector · risk overview (GREEN/AMBER/RED/OVERDUE) · history · log new service                |
| `/vehicle-health`      | Vehicle health        | True cost / km · setup completeness ring · component pie + share table                                |
| `/analytics`           | Analytics             | Tabs: daily / weekly / monthly / apps / areas / hours · responsive bar charts (Recharts)             |
| `/driver-score`        | Driver score          | Animated SVG ring (0–100) · 4 sub-scores · 14-day area chart                                          |
| `/smart-decisions`     | Smart Decisions       | All recommendations colored by tone (earn/protect/goal) with dismiss                                  |
| `/work-planner`        | Work Planner          | Reads active monthly goal · needed per day / per hour / hours per day to land target                  |
| `/best-hours`          | Best Work Hours       | Morning/afternoon/evening/night profitability · 7/30/90d windows · winner highlight                  |
| `/profit-simulator`    | Profit Simulator      | Client-side what-if calc, optional "use my vehicle costs" prefill                                    |
| `/notifications`       | Notifications         | List · unread highlight · per-item and bulk mark-read                                                |
| `/settings`            | Settings              | Profile · Vehicles (CRUD) · Apps (CRUD) · Areas (CRUD) · Goals (create + delete) · theme · language  |

## Design system

- **HSL-token theming** in `src/styles/index.css` — full light + dark palettes with `color-scheme` set per theme.
- **No-flash bootstrap**: `index.html` runs a small inline script that applies the saved theme and `dir`/`lang` before React paints.
- **Logical Tailwind utilities** (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) so Arabic RTL works automatically.
- **Premium primitives**: Button, Input, Label, Card, Skeleton, Alert, Badge, Tabs, Select, Textarea, Dialog (+ ConfirmDialog), EmptyState, PageHeader, Logo, ThemeToggle, LangToggle.
- **Motion** via Framer (small, purposeful: layout-id pills on active tabs/nav, springs on dialogs, fade-ins on page enter, animated bars/rings on data). All animations short (≤ 250ms) and respect `prefers-reduced-motion` (Framer handles this automatically).

## API client

- `src/lib/api/client.ts` — axios instance, attaches JWT, single-flight refresh on 401 (matches backend rotating-refresh policy), unwraps `{ data, meta }` envelope, normalizes errors to `{ code, message }`.
- `src/lib/api/endpoints.ts` — typed clients for `Auth`, `Driver`, `Vehicles`, `Apps`, `Areas`, `Trips`, `Expenses`, `Fuel`, `Maintenance`, `Goals`, `Analytics`, `Recommendations`, `Score`, `Notifications`.

## Reactivity (mutation → analytics)

Trip/expense/maintenance writes call `queryClient.invalidateQueries` on the affected keys, so:

- Adding a trip → dashboard KPIs, forecast, decisions, driver score, recent trips, trips list, weekly/monthly analytics all refetch.
- Adding an expense → dashboard net profit, expense totals, month-by-category refresh.
- Adding maintenance → maintenance risk + history refresh.
- Editing/deleting any of the above → same invalidations apply.

## i18n

- AR (RTL, default) + EN (LTR).
- Dictionaries in `src/i18n/{ar,en}.json` with dotted-path lookup and `{var}` interpolation.
- Switching language updates `<html lang>` and `<html dir>` instantly and persists.

## PWA

- Manifest (name, short name, theme colors, dark/light theme-color metas, AR locale + RTL dir, install scope).
- Workbox SW (`vite-plugin-pwa`) precaches **48 build entries** (~1.2 MB total), `NetworkFirst` cache for `/api/*` with 6 s network timeout + 5 min expiry, `CacheFirst` for Google Fonts.
- TanStack Query cache is also persisted to `localStorage` so reopening the app shows last data immediately while it refetches in the background.

## Performance

- Manual chunks split: `react`, `query`, `forms`, `motion`, `charts` (Recharts is the biggest at ~420 kB → ~114 kB gzip but only loads on pages that use charts).
- Every page is `lazy()`-loaded; first paint ships only what the visible page needs.
- Tabular numerics + monospace digits for KPIs (`font-variant-numeric: tabular-nums`).
- Image preconnects to Google Fonts, fonts loaded with `display=swap`.

## Accessibility

- Semantic landmarks (`<header>`, `<main>`, `<nav aria-label>`), labeled icon-only buttons, focus-visible rings on interactive elements, dialog `role="dialog" aria-modal="true"` with focus trap via overflow lock + ESC handler.
- Form errors are inline, `aria-invalid` flips on the input, hints sit under fields.
- Color contrast: light + dark palettes both built around AAA-friendly text/background pairs.

## SEO

- Per-page-agnostic meta (title, description, keywords) + Open Graph + Twitter cards in `index.html`.
- `lang` and `dir` reflect current locale, `theme-color` adapts to light/dark, mobile web-app capable metas.

## Layout

```
web/
├── index.html               # SEO meta, PWA manifest link, initial-paint loader, no-flash theme/dir script
├── vite.config.ts           # PWA + manual chunks (react, query, forms, motion, charts)
├── tailwind.config.ts       # HSL tokens, animations, Cairo font
├── public/                  # favicon + PWA icons (SVG, scales to any size)
└── src/
    ├── main.tsx, App.tsx, router.tsx
    ├── styles/index.css     # Tailwind layers + CSS-var tokens + skeleton shimmer + .gradient-text
    ├── i18n/                # ar.json + en.json + Provider/useT
    ├── providers/           # theme-provider, query-provider
    ├── stores/              # auth.store.ts (Zustand + persist)
    ├── hooks/               # use-vehicle-selector
    ├── lib/
    │   ├── api/             # client (axios + JWT refresh) + endpoints (typed)
    │   ├── utils.ts         # cn (clsx + tailwind-merge)
    │   ├── format.ts        # money / km / duration / number / date (locale-aware)
    │   └── time.ts          # datetime-local helpers + ISO week
    ├── components/
    │   ├── ui/              # button, input, label, card, skeleton, alert, badge, tabs, select, textarea, dialog, empty-state, page-header, logo
    │   ├── controls/        # theme-toggle, lang-toggle
    │   └── layout/          # auth-layout, app-layout, sidebar
    ├── routes/              # protected-route, guest-route
    └── pages/
        ├── auth/            # login, register
        ├── dashboard/       # dashboard + kpi-card, decisions-card, forecast-card, score-card, recent-trips
        ├── trips/           # trips-list, trip-new, trip-detail, trip-form (shared)
        ├── expenses/
        ├── maintenance/
        ├── vehicle-health/
        ├── analytics/       # daily/weekly/monthly + apps + areas + hours (one page, animated tabs)
        ├── driver-score/
        ├── decisions/
        ├── planner/         # work planner
        ├── best-hours/
        ├── simulator/       # profit simulator
        ├── notifications/
        ├── settings/        # profile + vehicles + apps + areas + goals + appearance + logout
        └── not-found.tsx
```

## Security notes

- Refresh tokens are persisted to `localStorage` because the backend returns them in the JSON body (matching what `mobile/` does with `expo-secure-store`). On web that's XSS-readable. When the backend switches to httpOnly cookies for refresh, swap `auth.store.ts` to in-memory only and remove `refreshToken` from `partialize`.
- Backend CORS must allow the web origin. `CORS_ORIGINS=*` works for local; lock down for production.

## What I couldn't verify from here

- **Lighthouse / runtime a11y audits / live PWA install** need a real browser. The app is built to that bar (semantic HTML, ARIA, focus rings, prefers-reduced-motion, SEO meta + OG + Twitter, code-split bundles, precached SW). Verify with Chrome DevTools → Lighthouse after `npm run web:build && npm run web:preview`.
- **End-to-end backend integration**: typecheck and build pass and endpoint shapes match the NestJS controllers, but you should log in once with the demo account to confirm zero runtime drift.

## Verified

```text
npm run web:typecheck    # clean
npm run web:build        # clean, 48 PWA entries (~1.2 MB precached)
```
