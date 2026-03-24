import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getUserByProvider, saveUser } from "@/lib/db";
import { parseWebhookMember } from "@/lib/patreon";

/**
 * POST /api/auth/patreon-webhook
 *
 * Receives Patreon membership webhooks and keeps user.subscription in sync
 * WITHOUT requiring the user to be logged in.
 *
 * Events handled:
 *   members:pledge:create  — new patron
 *   members:pledge:update  — tier changed / payment status changed
 *   members:delete         — patron deleted / cancelled
 *
 * Setup in Patreon portal:
 *   1. Go to https://www.patreon.com/portal/registration/register-clients
 *   2. Add webhook URL: https://www.tcgtimes.blog/api/auth/patreon-webhook
 *   3. Select triggers: members:pledge:create, members:pledge:update, members:delete
 *   4. Copy the "Secret" value → add as PATREON_WEBHOOK_SECRET in Vercel env vars
 */

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("md5", secret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ---------------------------------------------------------------------------
// Patreon webhook payload shape (v2 API)
// ---------------------------------------------------------------------------

interface WebhookPayload {
  data: {
    id: string;
    type: "member";
    attributes: {
      patron_status: string | null;
      next_charge_date: string | null;
    };
    relationships?: {
      user?: { data: { id: string } };
      currently_entitled_tiers?: { data: { id: string }[] };
    };
  };
  included?: {
    id: string;
    type: string;
    attributes: {
      social_connections?: {
        patreon?: { user_id?: string };
      };
      email?: string;
      title?: string;
    };
  }[];
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const secret = process.env.PATREON_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[patreon-webhook] PATREON_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-patreon-signature");
  const event = req.headers.get("x-patreon-event") ?? "";

  if (!verifySignature(rawBody, signature, secret)) {
    console.warn("[patreon-webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const member = payload.data;
  const included = payload.included ?? [];

  // Extract Patreon user id from included
  const patreonUser = included.find((i) => i.type === "user");
  const patreonUserId = patreonUser?.id ?? member.relationships?.user?.data?.id;

  if (!patreonUserId) {
    console.warn("[patreon-webhook] No Patreon user id in payload");
    return NextResponse.json({ ok: true, note: "no user id" });
  }

  // Look up our user by Patreon provider account id
  const dbUser = await getUserByProvider("patreon", patreonUserId);
  if (!dbUser) {
    // User hasn't connected Patreon yet — nothing to update
    return NextResponse.json({ ok: true, note: "user not found" });
  }

  const tiers = included
    .filter((i) => i.type === "tier")
    .map((i) => ({ id: i.id, attributes: { title: i.attributes.title } }));

  if (event === "members:delete") {
    // Patron deleted — mark as cancelled
    dbUser.subscription = {
      ...(dbUser.subscription ?? {
        patreonMemberId: member.id,
        tierId: "unknown",
        tierName: "Patron",
      }),
      status: "cancelled",
      syncedAt: new Date().toISOString(),
    } as typeof dbUser.subscription & NonNullable<typeof dbUser.subscription>;
  } else {
    // pledge:create or pledge:update
    const partial = parseWebhookMember(
      {
        id: member.id,
        attributes: {
          patron_status: member.attributes.patron_status,
          next_charge_date: member.attributes.next_charge_date,
        },
        relationships: member.relationships,
      },
      tiers
    );
    dbUser.subscription = {
      patreonMemberId: partial.patreonMemberId ?? member.id,
      tierId: partial.tierId ?? "unknown",
      tierName: partial.tierName ?? "Patron",
      status: partial.status ?? "expired",
      currentPeriodEnd: partial.currentPeriodEnd,
      syncedAt: partial.syncedAt ?? new Date().toISOString(),
    };
  }

  dbUser.updatedAt = new Date().toISOString();
  await saveUser(dbUser);

  console.log(`[patreon-webhook] ${event} → user ${dbUser.id} subscription=${dbUser.subscription?.status}`);
  return NextResponse.json({ ok: true });
}
