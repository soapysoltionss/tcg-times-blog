/**
 * coach/regions.ts
 * Region metadata table and helper functions.
 * Used to localise AI system prompts with market-specific context.
 */

import type { RegionContext } from "./types";

// ---------------------------------------------------------------------------
// Region metadata
// ---------------------------------------------------------------------------

export type RegionMeta = {
  name: string;
  currency: string;
  primaryPlatforms: string;
  shippingNotes: string;
  taxNotes: string;
  localMeta: string;
};

export const REGION_DATA: Record<string, RegionMeta> = {
  SG: {
    name: "Singapore",
    currency: "SGD",
    primaryPlatforms:
      "TCGPlayer (import), Carousell, Facebook Marketplace SG, Gamersaurus Rex, ETCetc, Grey Matter",
    shippingNotes:
      "Local delivery fast and cheap. International: Singpost tracked, ~SGD 8–20 for small parcels.",
    taxNotes:
      "GST 9% on imports. Under SGD 400 de minimis — no duty, but GST still applies.",
    localMeta:
      "Active FaB community. One Piece TCG very popular. GP Singapore is a major regional event.",
  },
  US: {
    name: "United States",
    currency: "USD",
    primaryPlatforms:
      "TCGPlayer, eBay, Card Merchant, Channel Fireball, local game stores",
    shippingNotes:
      "USPS First Class ~$4–8 domestically. International: USPS Priority International.",
    taxNotes: "Sales tax varies by state. No import duty for cards under $800.",
    localMeta:
      "Largest FaB and One Piece TCG market. Most competitive pricing.",
  },
  JP: {
    name: "Japan",
    currency: "JPY",
    primaryPlatforms:
      "Card Rush, Surugaya, Mercari, Yahoo Auctions Japan, BigMagic",
    shippingNotes:
      "Japan Post Epacket: ~JPY 1,500–3,000 international. Tracked and reliable.",
    taxNotes:
      "10% consumption tax included in listed prices. Import: customs may apply above ~JPY 10,000.",
    localMeta:
      "One Piece TCG origin market — often cheaper at retail. FaB growing. Grand Archive moderate presence.",
  },
  AU: {
    name: "Australia",
    currency: "AUD",
    primaryPlatforms:
      "TCGPlayer (import), Magic Madhouse AU, eBay AU, local game stores",
    shippingNotes:
      "AusPost tracked international varies. Budget for AUD 15–30 shipping from US/JP.",
    taxNotes:
      "GST 10% on all imports. No de minimis — all overseas purchases attract GST.",
    localMeta:
      "Strong FaB community. LSS (Legend Story Studios) is Australian-based — good local events.",
  },
  GB: {
    name: "United Kingdom",
    currency: "GBP",
    primaryPlatforms:
      "TCGPlayer (import), Cardmarket (EU/UK), eBay UK, local game stores",
    shippingNotes:
      "Royal Mail tracked recommended. Post-Brexit: customs on EU imports above £135.",
    taxNotes: "VAT 20% on imports. Commercial purchases always taxed.",
    localMeta: "Active FaB scene. Cardmarket offers good EU/UK sourcing options.",
  },
  DE: {
    name: "Germany / EU",
    currency: "EUR",
    primaryPlatforms: "Cardmarket, eBay DE, local game stores",
    shippingNotes:
      "Cardmarket within EU is fastest and cheapest. International DHL is reliable.",
    taxNotes:
      "VAT 19% on imports. EU de minimis €150 — below this no customs duty, but VAT applies.",
    localMeta:
      "Cardmarket dominates EU single purchasing. Strong competitive TCG community.",
  },
  PH: {
    name: "Philippines",
    currency: "PHP",
    primaryPlatforms:
      "Shopee, Lazada, Facebook Groups, local card shops in Manila/Cebu",
    shippingNotes:
      "Domestic: J&T or LBC fast. International: budget PHP 400–800 for tracked parcels.",
    taxNotes:
      "12% VAT on imports. Bureau of Customs threshold: PHP 10,000 — above this full duties apply.",
    localMeta:
      "Very active One Piece TCG and FaB community. Strong LGS scene in BGC and Megamall.",
  },
  MY: {
    name: "Malaysia",
    currency: "MYR",
    primaryPlatforms:
      "Shopee MY, Carousell MY, Facebook Groups, local card shops in KL/PJ",
    shippingNotes:
      "Poslaju domestic cheap. Regional shipping to/from SG: Pos Malaysia, ~MYR 15–30.",
    taxNotes:
      "Sales and Service Tax (SST) 10%. Duty-free below MYR 500 for personal imports.",
    localMeta:
      "Active FaB and One Piece community. Close cultural ties to SG market.",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getRegionMeta(code?: string): RegionMeta | undefined {
  if (!code) return undefined;
  return REGION_DATA[code.toUpperCase()];
}

export function regionBlock(code?: string, label = "Your region"): string {
  const r = getRegionMeta(code);
  if (!r) return "";
  return `
${label.toUpperCase()}: ${r.name} (${code!.toUpperCase()})
- Currency: ${r.currency}
- Primary buying platforms: ${r.primaryPlatforms}
- Shipping notes: ${r.shippingNotes}
- Tax/duty notes: ${r.taxNotes}
- Local meta: ${r.localMeta}`;
}

/**
 * Builds the region section that is appended to every specialist system prompt.
 * If both userRegion and counterpartyRegion are present and different, also
 * adds a cross-region deal advisory block.
 */
export function buildRegionSection(region: RegionContext): string {
  const userR = regionBlock(region.userRegion, "Player region");
  const counterR = region.counterpartyRegion
    ? regionBlock(region.counterpartyRegion, "Counterparty region (seller/buyer)")
    : "";

  const regionSection =
    userR || counterR
      ? `\n\nREGION CONTEXT — tailor all platform references, pricing, and shipping advice to these regions:${userR}${counterR}`
      : "";

  const crossRegionNote =
    region.userRegion &&
    region.counterpartyRegion &&
    region.userRegion !== region.counterpartyRegion
      ? `\n\nCROSS-REGION DEAL DETECTED: The player (${region.userRegion}) is dealing with a counterparty in ${region.counterpartyRegion}. Always address:
1. Currency conversion (remind player to check live rates)
2. Shipping costs and transit times between these two regions
3. Import duty / GST / VAT obligations for the buyer
4. Safe payment methods for cross-border TCG transactions (PayPal G&S recommended)
5. Whether the card is cheaper to buy locally vs importing`
      : "";

  return regionSection + crossRegionNote;
}

/** List of supported region codes for dropdowns */
export const SUPPORTED_REGIONS: { code: string; name: string }[] = Object.entries(
  REGION_DATA
).map(([code, meta]) => ({ code, name: meta.name }));
