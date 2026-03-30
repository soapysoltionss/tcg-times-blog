import { NextRequest, NextResponse } from "next/server";
import { getUserById, saveUser, completeTask } from "@/lib/db";
import { getSession, signSession, setSessionCookie } from "@/lib/session";

/**
 * POST /api/auth/sync-subscription
 *
 * Re-reads the user's subscription status from the DB and re-mints the
 * tcgt_session cookie with the correct isSubscriber flag.
 *
 * Also awards the "subscribe" quest if the user is active/declined and
 * hasn't completed it yet.
 *
 * Called from the profile page on mount so that manually-activated
 * subscribers (or stale sessions) get their paywall unlocked immediately
 * without needing to log out and back in.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isSubscriber =
    user.subscription?.status === "active" ||
    user.subscription?.status === "declined";

  // Award the subscribe quest if newly active and not yet completed
  if (isSubscriber) {
    const alreadyDone = user.tasks.some(
      (t) => t.id === "subscribe" && t.completedAt
    );
    if (!alreadyDone) {
      await completeTask(user.id, "subscribe").catch(() => {/* non-fatal */});
      // Refresh so the returned user reflects the updated tasks/XP
      const fresh = await getUserById(user.id);
      if (fresh) {
        // saveUser not needed here — completeTask already saved
        Object.assign(user, fresh);
      }
    }
  }

  // Re-mint the session cookie with the current isSubscriber value
  const token = await signSession({
    userId: user.id,
    username: user.username,
    isSubscriber,
    tierName: user.subscription?.tierName,
    tierLevel: user.subscription?.tierLevel,
    regionCode: user.region,
  });

  const res = NextResponse.json({
    ok: true,
    isSubscriber,
    tierName: user.subscription?.tierName ?? null,
    tierLevel: user.subscription?.tierLevel ?? null,
  });
  setSessionCookie(res, token);
  return res;
}
