/**
 * POST /api/tcg-coach
 *
 * General TCG AI coaching — Flesh and Blood, Grand Archive, One Piece TCG.
 * Uses a multi-agent router that classifies intent and routes to a specialist.
 *
 * Tier rate limits (per IP / user, per calendar day):
 *   free    (tier 0) —   5 messages/day, Claude Haiku only
 *   starter (tier 1) —  10 messages/day, all 3 models (base tier)
 *   basic   (tier 2) —  30 messages/day, all 3 models (base tier)
 *   pro     (tier 3) — 100 messages/day, all 3 models (premium tier)
 *
 * Pricing: SGD 0 / SGD 6 / SGD 18 / SGD 48 per month
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getSession } from "@/lib/session";
import { runCoach, type TierLevel, type ModelChoice, TIER_LIMITS } from "@/lib/ai-coach";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

async function checkAndIncrement(
  ip: string,
  tier: TierLevel
): Promise<{ count: number; allowed: boolean; limit: number }> {
  const sql = db();
  const today = new Date().toISOString().slice(0, 10);
  const limit = TIER_LIMITS[tier];

  const rows = await sql`
    INSERT INTO fai_coach_rate_limits (ip, date, count)
    VALUES (${ip}, ${today}::date, 1)
    ON CONFLICT (ip, date) DO UPDATE
      SET count = fai_coach_rate_limits.count + 1
    RETURNING count
  `;

  const count = (rows[0] as { count: number }).count;
  return { count, allowed: count <= limit, limit };
}

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      messages: Message[];
      counterpartyRegion?: string;
      modelChoice?: ModelChoice;
    };
    const { messages, counterpartyRegion: rawCounterparty, modelChoice = "claude" } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Determine tier + region from session
    const session = await getSession();
    const tierLevel = (session?.tierLevel ?? 0) as TierLevel;

    // Region: session profile > Cloudflare header > Vercel header > undefined (no tailoring)
    const userRegion =
      session?.regionCode ??
      req.headers.get("cf-ipcountry")?.toUpperCase() ??
      req.headers.get("x-vercel-ip-country")?.toUpperCase() ??
      undefined;

    // Optional: counterparty region passed from marketplace UI (e.g. seller's region)
    const counterpartyRegion = rawCounterparty?.toUpperCase();

    // All tiers are rate-limited (pro has a generous 200/day soft cap)
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

    const { count, allowed, limit } = await checkAndIncrement(ip, tierLevel);

    if (!allowed) {
      return NextResponse.json(
        { error: "rate_limited", count, limit, tier: tierLevel },
        { status: 429 }
      );
    }

    const { reply, intent, model, provider } = await runCoach(client, messages, tierLevel, {
      userRegion,
      counterpartyRegion,
    }, modelChoice);

    return NextResponse.json({
      reply,
      intent,
      model,
      provider,
      usage: { count, limit, remaining: Math.max(0, limit - count) },
    });
  } catch (err) {
    console.error("[/api/tcg-coach]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
