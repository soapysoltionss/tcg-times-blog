# TCG Times Blog — Copilot Instructions

## Project
TCG Times (`tcgtimes.blog`) — a TCG (Trading Card Game) news, marketplace, and community platform.

## Stack
- **Framework**: Next.js 16 (App Router, Turbopack), TypeScript, React 19
- **Styling**: Tailwind CSS v4, CSS custom properties (`var(--foreground)`, `var(--background)`, `var(--border)`, `var(--border-strong)`, `var(--muted)`, `var(--text-muted)`)
- **Database**: Neon PostgreSQL via `@neondatabase/serverless` — tagged template literal queries (`sql\`SELECT...\``)
- **Auth**: Custom JWT sessions via `jose` — `getSession()` from `@/lib/session`, cookie name `tcgt_session`
- **Payments**: Patreon subscriptions
- **Deployment**: Vercel (production at `https://www.tcgtimes.blog`)

## Key conventions
- All source code lives in `src/`
- API routes: `src/app/api/[route]/route.ts`
- Pages: `src/app/[route]/page.tsx`
- Shared components: `src/components/`
- DB helpers: `src/lib/db.ts` (thin wrapper) → `src/lib/db-neon.ts` (all queries)
- Types: `src/types/post.ts` and `src/lib/xp.ts`
- Prices are always stored as **integer cents** (e.g. 499 = $4.99), formatted with `$${(cents/100).toFixed(2)}`
- Game slugs: `pokemon`, `flesh-and-blood`, `one-piece`, `dragon-ball`, `grand-archive`, `magic`
- User roles: `reader` | `community` | `professional` | `store` | `admin`
- Admin check: `user?.role === "admin"`

## Middleware
`src/proxy.ts` is the Next.js middleware file (not `middleware.ts`). It:
1. Guards `/quant-lab-c4612f66b3d3a152268cb78678169119/*` — admin only, hard 404 for everyone else
2. Handles site-lock (`SITE_LOCKED=true` env var redirects non-admins to `/coming-soon`)

## DB access pattern
```ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
const rows = await sql`SELECT * FROM listings WHERE id = ${id}`;
```

## Styling pattern
Use Tailwind utility classes + CSS vars. Active/selected states use inverted colours:
```
active:   bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]
inactive: border-[var(--border)] text-[var(--text-muted)]
```
Label/badge text uses the `label-upper` utility class (uppercase, tracked, small).

## Do not
- Do not create a `src/middleware.ts` — the middleware file is `src/proxy.ts`
- Do not add the `learning-quant/` folder to `tsconfig.json` includes
- Do not commit `.env.local` or `.env.vercel`
- Do not store prices as floats — always integer cents
