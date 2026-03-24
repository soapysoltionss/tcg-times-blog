import { NextRequest, NextResponse } from "next/server";
import { approveStaleComments } from "@/lib/db";

/**
 * POST /api/comments/approve
 *
 * Approves professional-article comments that were submitted more than
 * 2 hours ago. Called every 30 minutes by a Vercel Cron job.
 *
 * Protected by CRON_SECRET so only the scheduler (or you manually) can
 * trigger it. Set CRON_SECRET in Vercel env vars to any strong random string.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const approved = await approveStaleComments();
  return NextResponse.json({ ok: true, approved });
}

// Also accept GET so Vercel Cron (which sends GET by default) works without config changes
export async function GET(req: NextRequest) {
  return POST(req);
}
