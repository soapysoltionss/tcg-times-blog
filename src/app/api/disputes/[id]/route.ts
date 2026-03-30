import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserById, updateDisputeStatus } from "@/lib/db";
import type { DisputeStatus } from "@/types/post";

/**
 * PATCH /api/disputes/[id]
 * Admin-only: advance dispute status (open → under_review → resolved).
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const user = await getUserById(session.userId);
  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const { status, resolution } = body as { status?: DisputeStatus; resolution?: string };
  const VALID: DisputeStatus[] = ["open", "under_review", "resolved"];
  if (!status || !VALID.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID.join(", ")}` }, { status: 400 });
  }

  const updated = await updateDisputeStatus(id, status, resolution);
  if (!updated) return NextResponse.json({ error: "Dispute not found." }, { status: 404 });

  return NextResponse.json({ dispute: updated });
}
