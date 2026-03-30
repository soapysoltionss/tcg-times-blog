# TCG Times — Product Roadmap

Problems in the TCG buying/selling space this site solves, with a step-by-step build plan.

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
