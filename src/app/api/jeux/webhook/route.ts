/**
 * POST /api/jeux/webhook
 *
 * Receives Shopify webhook events from Jeux Kingdom:
 *   - products/update   → triggers product cache revalidation
 *   - inventory_levels/update → same
 *
 * To configure on the Jeux Kingdom Shopify admin:
 *   Settings → Notifications → Webhooks
 *   Add webhook → Event: "Product updated" / "Inventory levels updated"
 *   URL: https://www.tcgtimes.blog/api/jeux/webhook
 *   Format: JSON
 *
 * Requires JEUX_SHOPIFY_WEBHOOK_SECRET env var (from Shopify webhook settings).
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/jeux";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const topic = req.headers.get("x-shopify-topic") ?? "";
  const hmac = req.headers.get("x-shopify-hmac-sha256") ?? "";

  const body = await req.text();

  // Verify webhook authenticity if secret is configured
  if (process.env.JEUX_SHOPIFY_WEBHOOK_SECRET) {
    const valid = await verifyShopifyWebhook(body, hmac);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  if (topic === "products/update" || topic === "inventory_levels/update") {
    // Bust the Next.js route cache for the marketplace page so fresh
    // product data is served on the next request
    revalidatePath("/marketplace");
    revalidatePath("/api/jeux/products");
    console.log(`[jeux/webhook] revalidated cache for topic: ${topic}`);
  }

  // Always return 200 — Shopify will retry on non-2xx
  return NextResponse.json({ ok: true });
}
