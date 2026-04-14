# Learning Quant — Copilot Instructions

## Project
A private interactive learning tool for quantitative finance / derivatives pricing, based on Hull's "Options, Futures, and Other Derivatives". Deployed as a hidden SPA inside tcgtimes.blog — accessible only by the admin user.

## Stack
- **Framework**: Vite + React 19, TypeScript
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite` plugin)
- **Math rendering**: KaTeX via `react-katex`
- **Math computation**: `mathjs`
- **Routing**: React Router v7 (`react-router-dom`)
- **Icons**: `lucide-react`

## Project structure
```
src/
  App.tsx               — router root
  pages/                — one page per major topic
    chapters/           — Hull chapter walkthroughs (Chapter01, Chapter02, ...)
    bookStudy/          — book overview + chapter deep-dives
  components/
    layout/             — Layout, Sidebar, Header
    charts/             — Recharts-based visualisations
    widgets/            — interactive calculators / pricers
    ui/                 — shared primitive components
  data/
    books.ts            — book registry
    chapters.ts         — chapter metadata
    glossary.ts         — term definitions
    bookStudy/          — per-book study data
  lib/
    payoff.ts           — option payoff calculations
    pricing.ts          — Black-Scholes, binomial, Greeks
    statistics.ts       — statistical helpers
  types/                — shared TypeScript types
```

## Build & deploy
- **Dev**: `cd learning-quant && npm run dev`
- **Build**: `cd learning-quant && npm run build`
  - Output goes to `../public/quant-lab-c4612f66b3d3a152268cb78678169119/`
  - Base path: `/quant-lab-c4612f66b3d3a152268cb78678169119/`
- After building, commit the `public/quant-lab-*/` output from the **parent repo** to deploy

## Key conventions
- All math displayed with KaTeX: `<InlineMath>` for inline, `<BlockMath>` for display
- Chart components use Recharts
- Calculations are pure functions in `src/lib/`
- No backend — fully client-side
- Vite config sets `base` and `outDir` — do not change these

## Do not
- Do not add this folder to the parent repo's `tsconfig.json`
- Do not import from `@/` paths — use relative imports only
- Do not add authentication logic — access control is handled by the parent Next.js proxy
