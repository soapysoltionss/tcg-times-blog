import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/session";
import { getUserById, saveUser, completeTask } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const body = await req.json();
  const { firstName, lastName, email, currentPassword, newPassword, region, additionalRegions, city } = body;

  // Update basic fields
  if (firstName !== undefined) user.firstName = firstName.trim();
  if (lastName !== undefined) user.lastName = lastName.trim();
  if (email !== undefined) user.email = email.trim();

  // City / suburb for local pickup
  if (city !== undefined) {
    user.city = typeof city === "string" && city.trim() ? city.trim() : undefined;
  }

  // Region update — validate against known codes (allow "GLOBAL" for stores)
  if (region !== undefined) {
    user.region = typeof region === "string" && region.length > 0
      ? region.toUpperCase().trim()
      : undefined;
  }
  if (additionalRegions !== undefined) {
    if (Array.isArray(additionalRegions) && additionalRegions.length > 0) {
      user.additionalRegions = additionalRegions
        .map((r: string) => r.toUpperCase().trim())
        .filter(Boolean);
    } else {
      user.additionalRegions = undefined;
    }
  }

  // Password change
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password required to set a new one." },
        { status: 400 }
      );
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters." },
        { status: 400 }
      );
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  user.updatedAt = new Date().toISOString();
  await saveUser(user);

  // Check if profile is now complete → award XP
  if (user.firstName && user.lastName && user.email) {
    await completeTask(user.id, "complete_profile");
  }

  const { passwordHash: _, ...safe } = (await getUserById(session.userId))!;
  return NextResponse.json({ ok: true, user: safe });
}
