/**
 * src/lib/jeux.ts
 * Jeux Kingdom (jeuxkingdom.com) — Shopify integration layer.
 *
 * Read path (always active):
 *   - Fetches products from the public Storefront JSON API (no auth needed)
 *   - Normalises Shopify variants into JeuxProduct / JeuxVariant types
 *
 * Write path (env-gated — activate by setting env vars):
 *   JEUX_SHOPIFY_ADMIN_TOKEN   — Shopify Admin API token (read_customers,
 *                                 write_customers, read_inventory, write_inventory)
 *   JEUX_SHOPIFY_STORE_DOMAIN  — e.g. "jeuxkingdom.com"  (defaults to constant below)
 *
 *   When JEUX_SHOPIFY_ADMIN_TOKEN is present:
 *     - getCustomerCredit(email)        — reads store credit balance
 *     - applyCustomerCredit(email, amt) — deducts store credit after a purchase
 *     - adjustInventory(variantId, qty) — decrements inventory after a sale here
 *
 * Webhooks (once Jeux configures them to point at /api/jeux/webhook):
 *   products/update → our cache is invalidated automatically
 *   inventory_levels/update → same
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const JEUX_STORE_DOMAIN =
  process.env.JEUX_SHOPIFY_STORE_DOMAIN ?? "jeuxkingdom.com";

const JEUX_BASE = `https://${JEUX_STORE_DOMAIN}`;
const ADMIN_TOKEN = () => process.env.JEUX_SHOPIFY_ADMIN_TOKEN ?? null;
const ADMIN_VERSION = "2024-04"; // Shopify Admin API version

// ---------------------------------------------------------------------------
// Shopify public types (subset we need)
// ---------------------------------------------------------------------------

export type ShopifyVariant = {
  id: number;
  title: string; // condition label e.g. "Near Mint"
  price: string;
  available: boolean;
  sku: string;
  inventory_quantity?: number; // not always present in public API
};

export type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: ShopifyVariant[];
  images: { src: string }[];
  updated_at: string;
};

export type ShopifyProductsResponse = {
  products: ShopifyProduct[];
};

// ---------------------------------------------------------------------------
// Normalised types (used throughout the app)
// ---------------------------------------------------------------------------

/** A single variant (condition) of a Jeux Kingdom product that is in stock */
export type JeuxVariant = {
  variantId: number;
  condition: string;
  priceSGD: number; // in cents (SGD)
  available: boolean;
  sku: string;
};

/** A normalised Jeux Kingdom product */
export type JeuxProduct = {
  id: number;
  title: string;
  handle: string;
  game: string; // normalised game slug
  productType: string;
  /** "card" for singles, "sealed" for boxes/packs/decks */
  listingType: "card" | "sealed";
  tags: string[];
  imageUrl: string | null;
  /** Card name to search against /api/fab-cards or /api/ga-cards when imageUrl is null */
  fallbackImageQuery: string | null;
  variants: JeuxVariant[];
  /** Cheapest available variant price in SGD cents */
  lowestPriceSGD: number | null;
  /** True when all variants are sold out */
  soldOut: boolean;
  jeuxUrl: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Game slug normalisation
// ---------------------------------------------------------------------------

const VENDOR_GAME_MAP: Record<string, string> = {
  "flesh and blood": "flesh-and-blood",
  "grand archive": "grand-archive",
  "one piece": "one-piece",
  "pokemon": "pokemon",
  "magic": "magic",
  "magic: the gathering": "magic",
};

function normaliseGame(vendor: string, productType: string): string {
  const key = vendor.toLowerCase();
  if (VENDOR_GAME_MAP[key]) return VENDOR_GAME_MAP[key];
  const ptKey = productType.toLowerCase();
  for (const [k, v] of Object.entries(VENDOR_GAME_MAP)) {
    if (ptKey.includes(k)) return v;
  }
  return "other";
}

// ---------------------------------------------------------------------------
// Normalise a raw Shopify product → JeuxProduct
// ---------------------------------------------------------------------------

// Sealed product detection — matches common Shopify product_type values
const SEALED_KEYWORDS = ["sealed", "booster", "box", "pack", "deck", "bundle", "case", "collection", "display"];
// Explicit single/card indicators — if present, never treat as sealed even if sealed keywords appear in tags
const SINGLE_KEYWORDS = ["single", "singles"];

function isSealedProduct(productType: string, tags: string[]): boolean {
  const pt = productType.toLowerCase();
  const tagStr = tags.join(" ").toLowerCase();
  // Explicit "single" override — always a card
  if (SINGLE_KEYWORDS.some((kw) => pt.includes(kw) || tagStr.includes(kw))) return false;
  if (SEALED_KEYWORDS.some((kw) => pt.includes(kw))) return true;
  return SEALED_KEYWORDS.some((kw) => tagStr.includes(kw));
}

function normaliseProduct(p: ShopifyProduct): JeuxProduct {
  const variants: JeuxVariant[] = p.variants.map((v) => ({
    variantId: v.id,
    condition: v.title,
    priceSGD: Math.round(parseFloat(v.price) * 100),
    available: v.available,
    sku: v.sku,
  }));

  const availableVariants = variants.filter((v) => v.available);
  const lowestPriceSGD =
    availableVariants.length > 0
      ? Math.min(...availableVariants.map((v) => v.priceSGD))
      : null;

  const imageUrl = p.images[0]?.src ?? null;

  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    game: normaliseGame(p.vendor, p.product_type),
    productType: p.product_type,
    listingType: isSealedProduct(p.product_type, p.tags) ? "sealed" : "card",
    tags: p.tags,
    imageUrl,
    // When no Shopify image, store the product title so the client can try card APIs
    fallbackImageQuery: imageUrl ? null : p.title,
    variants,
    lowestPriceSGD,
    soldOut: availableVariants.length === 0,
    jeuxUrl: `${JEUX_BASE}/products/${p.handle}`,
    updatedAt: p.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Public read API — products.json (no auth, public Shopify endpoint)
// ---------------------------------------------------------------------------

/**
 * Fetch all in-stock products from Jeux Kingdom.
 * Uses Next.js fetch cache with 5-minute revalidation.
 * Pass revalidate=0 to force-refresh (e.g. from webhook handler).
 */
export async function getJeuxProducts(opts: {
  game?: string;
  query?: string;
  collection?: string;
  page?: number;
  revalidate?: number;
  listingType?: "card" | "sealed";
  hideSoldOut?: boolean;
} = {}): Promise<JeuxProduct[]> {
  const { game, query, collection, page = 1, revalidate = 300, listingType, hideSoldOut = false } = opts;

  // Shopify supports filtering by product_type or collection in the URL
  const base = collection
    ? `${JEUX_BASE}/collections/${collection}/products.json`
    : `${JEUX_BASE}/products.json`;

  const params = new URLSearchParams({ limit: "250", page: String(page) });

  const res = await fetch(`${base}?${params}`, {
    next: { revalidate },
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    console.error(`[jeux] products.json failed: ${res.status}`);
    return [];
  }

  const data = (await res.json()) as ShopifyProductsResponse;
  let products = data.products.map(normaliseProduct);

  // Client-side game filter (Shopify public API doesn't support vendor filter)
  if (game && game !== "all") {
    products = products.filter((p) => p.game === game);
  }

  // Client-side title search
  if (query) {
    const q = query.toLowerCase();
    products = products.filter((p) => p.title.toLowerCase().includes(q));
  }

  // Client-side listing type filter
  if (listingType) {
    products = products.filter((p) => p.listingType === listingType);
  }

  // Hide sold-out products (default: show all; caller can pass hideSoldOut=true)
  if (hideSoldOut) {
    products = products.filter((p) => !p.soldOut);
  }

  return products;
}

// ---------------------------------------------------------------------------
// Admin API helpers (env-gated) — STUBBED until token is provided
// ---------------------------------------------------------------------------

function adminHeaders() {
  const token = ADMIN_TOKEN();
  if (!token) throw new Error("JEUX_SHOPIFY_ADMIN_TOKEN is not set");
  return {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": token,
  };
}

function adminUrl(path: string) {
  return `https://${JEUX_STORE_DOMAIN}/admin/api/${ADMIN_VERSION}/${path}`;
}

/** True when Admin API credentials are configured */
export function jeuxAdminEnabled(): boolean {
  return !!ADMIN_TOKEN();
}

// ---------------------------------------------------------------------------
// Store credits
// ---------------------------------------------------------------------------

export type JeuxCreditInfo = {
  customerId: string;
  email: string;
  creditSGD: number; // in cents
};

/**
 * Look up a customer's store credit balance by email.
 * Requires JEUX_SHOPIFY_ADMIN_TOKEN with read_customers scope.
 */
export async function getJeuxCredit(email: string): Promise<JeuxCreditInfo | null> {
  if (!jeuxAdminEnabled()) return null;

  // Search for customer by email
  const searchRes = await fetch(
    adminUrl(`customers/search.json?query=email:${encodeURIComponent(email)}&fields=id,email,note,tags`),
    { headers: adminHeaders() }
  );
  if (!searchRes.ok) return null;

  const { customers } = (await searchRes.json()) as {
    customers: { id: number; email: string; note?: string; tags?: string }[];
  };
  const customer = customers[0];
  if (!customer) return null;

  // Shopify store credits are stored in customer.note or as a "credit" tagged metafield.
  // Jeux Kingdom (standard Shopify) uses the built-in gift card system.
  // We read from the customer's gift card balance via the Admin API.
  const gcRes = await fetch(
    adminUrl(`customers/${customer.id}/gift_cards.json`),
    { headers: adminHeaders() }
  );
  if (!gcRes.ok) return { customerId: String(customer.id), email: customer.email, creditSGD: 0 };

  const { gift_cards } = (await gcRes.json()) as {
    gift_cards: { balance: string; currency: string; disabled_at: string | null }[];
  };

  const totalCredit = gift_cards
    .filter((gc) => !gc.disabled_at)
    .reduce((sum, gc) => sum + Math.round(parseFloat(gc.balance) * 100), 0);

  return {
    customerId: String(customer.id),
    email: customer.email,
    creditSGD: totalCredit,
  };
}

/**
 * Apply (deduct) store credit from a customer's gift card balance.
 * Requires JEUX_SHOPIFY_ADMIN_TOKEN with write_customers + read_inventory scope.
 * Returns the new remaining balance in SGD cents, or null if admin not enabled.
 */
export async function applyJeuxCredit(
  customerId: string,
  amountSGD: number // in cents
): Promise<{ newBalanceSGD: number } | null> {
  if (!jeuxAdminEnabled()) return null;

  // Shopify doesn't expose a direct "debit gift card" endpoint from the customer side.
  // The correct approach is to create an order via the API with the gift card as payment.
  // For now this stubs the interface — when Jeux grants Admin + write_orders scope,
  // replace this body with the actual Shopify draft order + payment flow.
  console.warn(
    `[jeux] applyJeuxCredit: stubbed. Would deduct SGD ${amountSGD / 100} from customer ${customerId}`
  );

  // TODO: replace with draft order creation once write_orders scope is granted
  // POST /admin/api/{version}/draft_orders.json
  // { draft_order: { customer: { id }, applied_discount: { value_type: "fixed_amount", value: amountSGD/100 } } }

  return { newBalanceSGD: 0 };
}

// ---------------------------------------------------------------------------
// Inventory write-back
// ---------------------------------------------------------------------------

/**
 * Decrement inventory for a Shopify variant after a sale on TCG Times.
 * Requires JEUX_SHOPIFY_ADMIN_TOKEN with write_inventory scope.
 */
export async function decrementJeuxInventory(
  variantId: number,
  quantitySold: number
): Promise<boolean> {
  if (!jeuxAdminEnabled()) return false;

  // Step 1: get the inventory_item_id and location_id for this variant
  const varRes = await fetch(adminUrl(`variants/${variantId}.json?fields=id,inventory_item_id`), {
    headers: adminHeaders(),
  });
  if (!varRes.ok) return false;

  const { variant } = (await varRes.json()) as { variant: { id: number; inventory_item_id: number } };

  // Step 2: get inventory levels for this item
  const levelRes = await fetch(
    adminUrl(`inventory_levels.json?inventory_item_ids=${variant.inventory_item_id}`),
    { headers: adminHeaders() }
  );
  if (!levelRes.ok) return false;

  const { inventory_levels } = (await levelRes.json()) as {
    inventory_levels: { location_id: number; available: number }[];
  };
  const level = inventory_levels[0];
  if (!level) return false;

  // Step 3: adjust inventory (negative delta = decrement)
  const adjustRes = await fetch(adminUrl("inventory_levels/adjust.json"), {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      location_id: level.location_id,
      inventory_item_id: variant.inventory_item_id,
      available_adjustment: -quantitySold,
    }),
  });

  return adjustRes.ok;
}

// ---------------------------------------------------------------------------
// Webhook cache invalidation helper
// Called from /api/jeux/webhook when Jeux configures webhooks
// ---------------------------------------------------------------------------

/**
 * Verify the Shopify webhook HMAC signature.
 * Requires JEUX_SHOPIFY_WEBHOOK_SECRET env var (set in Shopify webhook settings).
 */
export async function verifyShopifyWebhook(
  body: string,
  hmacHeader: string
): Promise<boolean> {
  const secret = process.env.JEUX_SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Buffer.from(sig).toString("base64");
  return expected === hmacHeader;
}
