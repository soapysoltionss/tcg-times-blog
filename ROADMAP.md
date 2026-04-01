# TCG Times — Product Roadmap

Problems in the TCG buying/selling space this site solves, with a step-by-step build plan.

---

## Problem 1 — Trust & fees on existing marketplaces ✅ Partially done
**The issue:** TCGPlayer charges sellers 10–15% + payment processor fees. Buyers get price-gouged by bot-driven repricing. There is no community relationship — you're transacting with a faceless storefront.

**Our solution:** A community-first marketplace where sellers are known, rated members. Reputation is built through the existing XP system. No percentage cut — flat subscription for sellers via Patreon tiers. Trust signals visible on every listing.

### Implemented
- ✅ Full community + store marketplace at `/marketplace`
- ✅ Trusted Seller badge (10+ sales) and Verified Seller badge (admin-granted) shown on every listing card
- ✅ `totalSales` count visible on listing cards and detail pages
- ✅ Seller role system: `reader / community / professional / store / admin`
- ✅ Patreon subscription integration — tier level, status, and sync via webhook
- ✅ XP-based reputation: level titles from "Novice Duelist" to "Master"

### Still to do
- [ ] **1b.** ~~Add a "Leave feedback" flow after a sale is marked sold~~ ✅ Done — buyer can rate the transaction (positive / neutral / negative) with an optional short note; feedback summary shows on seller block
- [ ] **1d.** Display full reputation summary (e.g. "47 sales · 98% positive") on listing detail page.

---

## Problem 2 — No price transparency or market education ✅ Partially done
**The issue:** Players see prices but have no context for *why* they move — set rotation, tournament results, ban lists, reprint announcements. That knowledge lives in Discord and is never searchable.

**Our solution:** Price movement articles tied to real events. "This card spiked because X won Y." Content and market data live in the same place.

### Implemented
- ✅ Market Ticker strip showing live price movers (`/api/ticker`)
- ✅ Hero slider Market Report slide — surfaces top-priced active listing
- ✅ Set detail pages at `/tools/market/set/[game]/[groupId]` — full card list with TCGPlayer market prices, price change %, reprint risk badges, market insights panel
- ✅ Box EV calculator at `/tools/market/box-ev`
- ✅ Market index landing page at `/tools/market`
- ✅ Reprint risk system with per-card risk ratings and tooltips
- ✅ `price_snapshots` Neon table — daily price data from tcgcsv.com, upserted once per day per card
- ✅ PriceGraph component wired to real data on listing detail pages
- ✅ Latest set slides on hero slider (latest set per game, with card list link)

### Still to do
- [ ] **2c.** `/tools/price-tracker` — search any card, see full price history graph, see which TCG Times articles mention that card.
- [ ] **2d.** Article "card tag" hook — tag cards in frontmatter; they get a "Mentioned in" link on the price tracker page.

---

## Problem 3 — Cross-game fragmentation ✅ Done
**The issue:** FaB, Grand Archive, and One Piece TCG buyers each use separate platforms, Discord servers, and Facebook groups. A multi-game player juggles five accounts.

**Our solution:** One account, one marketplace, multiple games.

### Implemented
- ✅ Game filter on marketplace (Flesh and Blood / Grand Archive / One Piece TCG / Pokémon / Other)
- ✅ Card autocomplete for FaB (`/api/fab-cards`), Grand Archive (`/api/ga-cards`), One Piece (`/api/op-cards`)
- ✅ Per-game category pages at `/category/[slug]`
- ✅ Per-game hero slider slides and set detail pages
- ✅ Product type filter (Singles / Sealed) on marketplace

---

## Problem 4 — No buyer protection for P2P trades ✅ Done
**The issue:** Facebook group and Discord trades are rampant with scams. No escrow, no dispute resolution, no verified seller history.

**Our solution:** Structured dispute/feedback system. Verified seller badges. In-site messaging. Patreon subscribers automatically get a "Trusted" tier.

### Implemented
- ✅ Dispute system — buyers can open a dispute on a sold listing within 7 days; `open → under_review → resolved` state machine; admin resolution UI
- ✅ In-site messaging — `messages` table; full inbox at `/profile` → Messages tab; no email addresses exposed
- ✅ "Express Interest" button on listings — opens a message thread to the seller
- ✅ Verified Seller badge (admin-granted ✦) shown on all listing cards
- ✅ Trusted Seller badge (auto at 10+ sales ✓) shown on all listing cards

### Still to do
- [ ] **4d.** Formal seller ID verification flow — upload document or link Patreon, admin approval queue.

---

## Problem 5 — New players have no buying guide ✅ Done
**The issue:** "What should I buy first?" and "Is this a good deal?" answers are buried in Discord and Reddit, not searchable, and go stale fast.

**Our solution:** Evergreen buying guide articles, "budget build" posts, and the FAI Coach / TCG Coach tools.

### Implemented
- ✅ Starter Guide system — per-game pinned articles; seeded from `scripts/seed-starter-guides.mts`
- ✅ `pinned` frontmatter field — pinned posts render at top of category pages
- ✅ FAI Coach (`/tools/fai-coach`) — AI card assistant for Flesh and Blood
- ✅ TCG Coach (`/tools/tcg-coach`) — multi-game AI assistant with region-aware responses
- ✅ Buying Guide tag filter on `/blog` page
- ✅ PaywallGate component — subscriber-only content gating per article
- ✅ XP quest: "Read 5 articles" tracked and rewarded

---

## Problem 6 — Card condition is described inconsistently ✅ Done
**The issue:** NM, LP, and MP mean different things to different sellers. Condition disputes are the #1 source of conflict in P2P sales.

**Our solution:** Standardised condition guide with photo examples, enforced on every listing form.

### Implemented
- ✅ `/tools/condition-guide` — visual grading guide (Near Mint → Damaged) with per-tier descriptions, what to look for, and TCG-specific notes
- ✅ Condition tooltip/link on listing creation form
- ✅ `conditionNotes` free-text field on all listings — shows on listing cards and detail pages
- ✅ Condition badge (colour-coded) on every listing card

---

## Problem 7 — Local player-to-player selling is dead ✅ Done
**The issue:** The only local options are Facebook Marketplace (unsafe) or LGS buylist (terrible rates). There is no "find sellers near me" for TCGs.

**Our solution:** Location-aware listings with city/region tagging, local filter, and a safety guide.

### Implemented
- ✅ `city` and `region` fields on user profiles — set in `/profile` → Edit Profile
- ✅ `localPickup` boolean + `sellerCity` on listings — checkbox in listing creation form
- ✅ 📍 City badge on listing cards when `localPickup = true`
- ✅ "Local pickup only" filter toggle in marketplace FilterPanel + active chip
- ✅ `/tools/local-meetup` safety guide — 9 practical tips for meeting strangers
- ✅ Safety guide link surfaces below local-filtered results
- ✅ DB columns: `users.city`, `listings.seller_city`, `listings.local_pickup` (live on Neon)

---

## Problem 8 — No real-time price discovery or market liquidity 🔄 In progress
**The issue:** Card prices in Singapore are opaque — sellers guess based on TCGPlayer (USD, US-focused) or Discord DMs. There is no SEA-specific live market, no transaction history, no volume data.

**Our solution:** A stock market-style card exchange layer. Buyers place bids, sellers place asks — the spread determines market price. Transaction volume, market cap, and price history surfaced per card.

### Still to do
- [ ] **8a.** `transactions` table — record every completed sale: `cardName`, `game`, `setName`, `priceCents`, `quantity`, `buyerId`, `sellerId`, `completedAt`, `region`
- [ ] **8b.** Bid/ask order book — `orders` table with `type` (bid/ask), `priceCents`, `quantity`, `status` (open/filled/cancelled), `expiresAt`, `userId`, `cardName`, `game`
- [ ] **8c.** `/tools/market/[game]/[cardName]` — live order book view, price history chart, volume bars, market cap estimate
- [ ] **8d.** Market cap calculation — last sale price × estimated circulating supply
- [ ] **8e.** Price discovery widget on listing detail pages — "Last sold: $X · 24h volume: N copies · 7d change: +/−X%"
- [ ] **8f.** Aggregate volume dashboard — top movers, most traded cards, sealed product index, game-by-game activity heatmap

---

## Problem 9 — Daily engagement & gamification ✅ Done
**The issue:** There is no reason to come back to the site daily. Readers consume one article and leave. No habit loop.

**Our solution:** XP system, daily mini-games, and quests that reward consistent engagement.

### Implemented
- ✅ XP system — 8 levels from "Novice Duelist" to "Master"; XP bar in profile
- ✅ Quest system — 8 quests rewarding key actions (register, complete profile, comment, post, read 5 articles, subscribe, complete a sale, guess the Pokémon)
- ✅ "Guess That Pokémon!" daily mini-game at `/tools/guess-pokemon`
  - Gen 1 Pokémon silhouette (CSS brightness filter on PokeAPI sprite)
  - Deterministic daily pick by UTC date — same Pokémon worldwide
  - 1 correct guess per UTC day; awards +50 XP on first correct answer
  - Shake animation on wrong guesses; letter hint after 3 wrong attempts
  - Countdown timer to next Pokémon reset
  - `lastPokemonGuessDate` stored on user record
  - Client-side `localStorage` fast path for page refreshes

---

## Problem 10 — TCG news is fragmented across Reddit, Discord, and niche sites ✅ Partially done
**The issue:** Ban list announcements, rotation schedules, tournament breakout decklists, and new set information are scattered across Reddit (r/PokemonTCG, r/FleshandBlood, r/GrandArchive), Discord servers, fractalofin.site, and game-specific news sites. A competitive player needs 5+ tabs open daily just to stay current.

**Our solution:** An automated news aggregation layer that scrapes and normalises structured game data from authoritative sources — ban lists, rotations, breakout decklists, new set card lists — and surfaces it inside TCG Times alongside market data and articles.

### Implemented
- ✅ `news_items` Neon table — `(id, game, source, subreddit, title, url, summary, published_at, tags[], created_at)`
- ✅ `/api/news-scraper` — Vercel Cron (daily 06:00 UTC) — fetches hot posts from r/PokemonTCG, r/PokemonTCGDeals, r/FleshandBlood, r/GrandArchive, r/OnePieceTCG; keyword-filters for ban/rotation/tournament/new-set; upserts into `news_items`
- ✅ `/api/news` — public query endpoint with `?game=&tag=&limit=&offset=` filters; CDN-cached 5 min
- ✅ `BanListWidget` component — compact "Recent Bans & Restrictions" sidebar widget; embedded on listing detail pages and TCG Coach page
- ✅ `/tools/news` — full news feed UI with game tabs + tag filter pills (Bans / Rotation / Tournament / New Sets); 3-column card grid; load-more pagination

### Still to do

- [ ] **10a.** **Reddit news scraper** — scheduled Vercel Cron job (daily) that hits the Reddit JSON API for the top posts from:
  - `r/PokemonTCG`, `r/PokemonTCGDeals` — bans, rotation, set reveals
  - `r/FleshandBlood` — ban/suspension list, OP cards, Calling results
  - `r/GrandArchive` — set reveals, official ban announcements
  - `r/OnePieceTCG` — ban list, format announcements
  - Store results in a `news_items` Neon table: `(id, game, source, title, url, summary, publishedAt, tags[])`

- [ ] **10b.** **fractalofin.site scraper** — FaB-specific ban/suspension/watch list page. Parse the HTML (Cheerio or Playwright) on a daily cron to extract structured ban/restriction data and upsert into a `ban_list` table: `(game, cardName, status, effectiveDate, reason, sourceUrl)`. Surface on the `/tools/fai-coach` sidebar and on individual card pages.

- [ ] **10c.** **Official ban list polling** — direct polling of official announcement pages/feeds:
  - Pokémon: `pokemon.com/us/pokemon-tcg/rules/` — rotation cutoff dates, ban list PDF
  - Flesh and Blood: `fabtcg.com/suspended-and-banned/` — structured ban/suspension/watch list
  - Grand Archive: official Discord announcements (webhook listener) + `grandarchivetcg.com` news feed
  - One Piece: `one-piece-cardgame.com` — official ban/limited list

- [ ] **10d.** **Rotation tracker for Pokémon** — parse the rotation cutoff set symbol list from the official Pokémon site. Build a `/tools/rotation` page showing: current legal sets, sets rotating at next rotation, rotation date countdown, and cards from rotating sets that are likely to spike or drop in price (cross-referenced with `price_snapshots`).

- [ ] **10e.** **Breakout decklist aggregator** — scrape tournament results pages:
  - FaB: `fabtcg.com/articles/` calling/nationals top 8 decklists
  - Pokémon: `limitless.gg` top 8 tournament lists
  - Grand Archive: official Grand Archive tournament reports
  - Parse card names from decklists, cross-reference with marketplace listings to show "Cards in winning decks that are listed for sale"

- [ ] **10f.** **New set card list ingestion** — when a new set is detected (via tcgcsv.com group data or official site scrape):
  - Auto-ingest all card names + images from the set into `products` table
  - For Grand Archive specifically: scrape `grandarchivetcg.com/cards` for the latest set's full card list and store with rarity, element, class, and cost data
  - Trigger a "New Set Alert" hero slide on the homepage
  - Surface the set's card list on `/tools/market/set/[game]/[groupId]` immediately

- [ ] **10g.** **News feed UI** — `/tools/news` page with:
  - Tabs per game (All / FaB / Grand Archive / One Piece / Pokémon)
  - "Ban / Restriction" tag filter — shows only ban list changes across all games
  - "Rotation" filter — shows only rotation / format change news
  - "Tournament" filter — breakout results and top decklists
  - "New Set" filter — card reveals and set releases
  - Each item shows source badge (Reddit / Official / fractalofin / Discord), title, excerpt, date, and a link out

- [ ] **10h.** **Ban list sidebar widget** — embed a compact "Current Bans" widget on:
  - Individual card listing detail pages (if that card is banned/restricted)
  - `/tools/fai-coach` and `/tools/tcg-coach` sidebars
  - Category pages for each game

- [ ] **10i.** **Discord webhook listener** — for games where Discord is the primary official announcement channel (Grand Archive, some FaB announcements), set up a lightweight webhook receiver endpoint (`/api/discord-webhook`) that receives messages from a designated server/channel, filters for keywords (`banned`, `suspended`, `rotation`, `new set`), and upserts to `news_items`.

---

## Implementation Order (updated)

| # | Item | Effort | Impact | Status |
|---|------|--------|--------|--------|
| 1 | Problem 1 (marketplace, badges, XP) | — | High | ✅ Done |
| 2 | Problem 3 (multi-game, autocomplete) | — | High | ✅ Done |
| 3 | Problem 4 (messaging, disputes) | — | High | ✅ Done |
| 4 | Problem 5 (starter guides, AI coach) | — | High | ✅ Done |
| 5 | Problem 6 (condition guide) | — | Medium | ✅ Done |
| 6 | Problem 7 (local pickup) | — | Medium | ✅ Done |
| 7 | Problem 9 (Guess Pokémon, XP, quests) | — | High | ✅ Done |
| 8 | Problem 2 (price tracker page + article tags) | Medium | High | 🔄 In progress |
| 9 | Problem 8 (order book, transactions) | Very High | Very High | 🔄 In progress |
| 10 | **10a** — Reddit news scraper (cron + DB) | Medium | High | ⬜ |
| 11 | **10b** — fractalofin.site ban list scraper | Medium | High | ⬜ |
| 12 | **10c** — Official ban list polling (FaB, Pokémon, GA, OP) | Medium | High | ⬜ |
| 13 | **10d** — Pokémon rotation tracker page | Medium | High | ⬜ |
| 14 | **10e** — Breakout decklist aggregator | High | High | ⬜ |
| 15 | **10f** — New set auto-ingestion (Grand Archive priority) | High | High | ⬜ |
| 16 | **10g** — `/tools/news` feed UI | Medium | High | ⬜ |
| 17 | **10h** — Ban list sidebar widget | Low | Medium | ⬜ |
| 18 | **10i** — Discord webhook listener | Medium | Medium | ⬜ |
| 19 | Problem 1b — Post-sale feedback flow | Medium | High | ⬜ |
| 20 | Problem 4d — Seller ID verification | High | Medium | ⬜ |

---

## Problem 1 — Trust & fees on existing marketplaces (done)
**The issue:** TCGPlayer charges sellers 10–15% + payment processor fees. Buyers get price-gouged by bot-driven repricing. There is no community relationship — you're transacting with a faceless storefront.

**Our solution:** A community-first marketplace where sellers are known, rated members. Reputation is built through the existing XP system. No percentage cut — flat subscription for sellers via Patreon tiers. Trust signals visible on every listing.

### Steps
- [ ] **1a.** Add `sellerXp`, `sellerReputation` (thumbs up/down count), and `totalSales` columns to the users table and surface them on listing cards and the listing detail page.
- [ ] **1b.** Add a "Leave feedback" flow after a sale is marked sold — buyer can rate the transaction (positive / neutral / negative) with an optional short note.
- [ ] **1c.** Show a "Trusted Seller" badge on listings where the seller is a Patreon subscriber (already tracked via `patreonTier`).
- [ ] **1d.** Display seller reputation summary (e.g. "47 sales · 98% positive") on the listing detail page next to the seller avatar.

---

## Problem 2 — No price transparency or market education (TBD)
**The issue:** Players see prices but have no context for *why* they move — set rotation, tournament results, ban lists, reprint announcements. That knowledge lives in Discord and is never searchable.

**Our solution:** Price movement articles tied to real events. "This card spiked because X won Y." Content and market data live in the same place. The price graph component already exists.

### Steps
- [ ] **2a.** Add a `priceHistory` table to Neon — `(cardName, game, setName, priceCents, recordedAt)`. Seed it by scraping/polling a public price source or from manual entry on listings.
- [ ] **2b.** Wire the existing `PriceGraph` component on the listing detail page to real data from this table instead of mock data.
- [ ] **2c.** Create a `/tools/price-tracker` page — search any card, see its price history graph, and see which articles on TCG Times mention that card (linking content to market movement).
- [ ] **2d.** Add an "Article hook" — when writing a post, authors can tag cards by name; those cards get a "Mentioned in" link on their price tracker page.

---

## Problem 3 — Cross-game fragmentation (done)
**The issue:** FaB, Grand Archive, and One Piece TCG buyers each use separate platforms, Discord servers, and Facebook groups. A multi-game player juggles five accounts.

**Our solution:** One account, one marketplace, multiple games. The category system and game field on listings already exist.

### Steps
- [ ] **3a.** Add game filter tabs to the marketplace page (All / Flesh and Blood / Grand Archive / One Piece TCG / Other) using the existing `game` field on listings.
- [ ] **3b.** Add card autocomplete support for Grand Archive and One Piece TCG (currently only FaB has the `/api/fab-cards` autocomplete).
- [ ] **3c.** Add a `/category/[game]` or `/tools/price-tracker?game=grand-archive` scoped view so readers land on game-specific content from marketplace pages.

---

## Problem 4 — No buyer protection for P2P trades (done)
**The issue:** Facebook group and Discord trades are rampant with scams. No escrow, no dispute resolution, no verified seller history.

**Our solution:** Structured dispute/feedback system. Verified seller badges. Patreon subscribers automatically get a "Trusted" tier. Optional contact-via-site messaging so personal contact details are never exposed.

### Steps
- [ ] **4a.** Add a `disputes` table — buyer can open a dispute on a sold listing within 7 days, admin can resolve it. Simple status machine: `open → under_review → resolved`.
- [ ] **4b.** Add in-site messaging — a `messages` table (`fromUserId`, `toUserId`, `listingId`, `body`, `createdAt`). Surface a simple inbox at `/profile?tab=messages`. No email addresses exposed.
- [ ] **4c.** Add an "Interest" button on listings (already exists as `/api/interest`) — wire it to send the seller a site notification / message thread opener.
- [ ] **4d.** Seller verification flow — upload a government ID or link a verified Patreon; admin approves; "Verified" shield badge shown on listings.

---

## Problem 5 — New players have no buying guide (done)
**The issue:** "What should I buy first?" and "Is this a good deal?" answers are buried in Discord and Reddit, not searchable, and go stale fast.

**Our solution:** Evergreen buying guide articles, "budget build" posts, and the FAI Coach tool that can answer card-specific questions in context.

### Steps
- [ ] **5a.** Publish a series of pinned "Start Here" articles per game (FaB starter guide, GA starter guide, OP starter guide). Pin them to the top of each category page.
- [ ] **5b.** Add a `pinned` field to post frontmatter. Pinned posts render at the top of category and blog listing pages with a distinct visual treatment.
- [ ] **5c.** Extend FAI Coach (`/tools/fai-coach`) to be able to answer "What's a good budget deck for FaB?" by injecting a curated context doc of current budget options alongside the user's question.
- [ ] **5d.** Add a "Buying Guide" tag filter on the blog page so readers can find all purchasing-decision content in one click.

---

## Problem 6 — Card condition is described inconsistently
**The issue:** NM, LP, and MP mean different things to different sellers. Condition disputes are the #1 source of conflict in P2P sales.

**Our solution:** A standardised condition guide with photo examples per game, enforced and linked on every listing form.

### Steps
- [ ] **6a.** Create a `/tools/condition-guide` page with a visual grading guide (Near Mint through Damaged) with real card photo examples per condition tier and per game.
- [ ] **6b.** Add a tooltip/link on the condition dropdown in the listing creation form pointing to this guide.
- [ ] **6c.** Add a `conditionNotes` free-text field to listings so sellers can describe specific flaws (e.g. "minor edge wear on top-right corner").

---

## Problem 7 — Local player-to-player selling is dead
**The issue:** The only local options are Facebook Marketplace (unsafe) or LGS buylist (terrible rates). There is no "find sellers near me" for TCGs.

**Our solution:** Location-aware listings — sellers can optionally tag their city/region, buyers can filter to see listings available for local pickup or meetup trade.

### Steps
- [ ] **7a.** Add optional `city` and `region` (state/province) fields to the users profile table. Let users set these in `/profile`.
- [ ] **7b.** Surface `city`/`region` on listings when the seller has set them. Add a "Local pickup available" boolean toggle on listing creation.
- [ ] **7c.** Add a location filter to the marketplace page — "Show listings near me" that filters by matching city or region.
- [ ] **7d.** Add a "Local meetup" safety guide page linked from filtered local results — public meeting spots, never alone, etc.

---

## Implementation Order (recommended)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | **3a** — Game filter tabs on marketplace | Low | High |
| 2 | **6a** — Condition guide page | Low | Medium |
| 3 | **6b/6c** — Condition notes + tooltip on listing form | Low | Medium |
| 4 | **5b** — Pinned posts + "Start Here" articles | Low | High |
| 5 | **1a/1c/1d** — Seller XP, Trusted badge, reputation display | Medium | High |
| 6 | **1b** — Post-sale feedback flow | Medium | High |
| 7 | **2a/2b** — Real price history data + graph | Medium | High |
| 8 | **4c/4b** — Interest → message thread + inbox | Medium | High |
| 9 | **2c** — `/tools/price-tracker` page | Medium | Medium |
| 10 | **7a/7b/7c** — Location fields + local filter | Medium | Medium |
| 11 | **3b** — GA / OP card autocomplete | High | Medium |
| 12 | **4a** — Dispute system | High | High |
| 13 | **5c** — FAI Coach budget deck context | Medium | Medium |
| 14 | **4d** — Seller ID verification | High | Medium |
| 15 | **8a–8f** — Live order book + price discovery | Very High | Very High |

---

## Problem 8 — No real-time price discovery or market liquidity

**The issue:** Card prices in Singapore are opaque — sellers guess based on TCGPlayer (USD, US-focused) or Discord DMs. There is no SEA-specific live market, no transaction history, no volume data. Buyers can't tell if a price is fair. Sellers can't tell what the market will bear.

**Our solution:** A stock market-style card exchange layer built on top of the existing marketplace. Buyers place bids, sellers place asks — the spread determines market price. Transaction volume, market cap, and price history are surfaced per card, per game, per region in real time.

### Steps

- [ ] **8a** — Add `transactions` table — records every completed sale: `cardName`, `game`, `setName`, `priceCents`, `quantity`, `buyerId`, `sellerId`, `completedAt`, `region`
- [ ] **8b** — Add bid/ask order book — `orders` table with `type` (bid/ask), `priceCents`, `quantity`, `status` (open/filled/cancelled), `expiresAt`, `userId`, `cardName`, `game`
- [ ] **8c** — `/tools/market/[game]/[cardName]` page — live order book view, price history chart, volume bars (daily/weekly/monthly), market cap estimate
- [ ] **8d** — Market cap calculation — last sale price × estimated circulating supply (derived from print run data and regional sales velocity)
- [ ] **8e** — Price discovery widget — embed on listing detail pages: "Last sold: $X.XX · 24h volume: N copies · 7d change: +/−X%"
- [ ] **8f** — Aggregate volume dashboard — `/tools/market` landing page showing top movers, most traded cards, sealed product index, game-by-game activity heatmap
