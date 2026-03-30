import { NextRequest, NextResponse } from "next/server";
import { getListings, createListing } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/db";
import type { Listing, ListingCondition, ListingType } from "@/types/post";

const VALID_CONDITIONS: ListingCondition[] = [
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
];

const VALID_LISTING_TYPES: ListingType[] = ["card", "sealed"];

// GET /api/marketplace?marketplace=store|community&game=...&card=...&listingType=card|sealed
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const marketplace = searchParams.get("marketplace") as "store" | "community" | null;
  const game = searchParams.get("game") ?? undefined;
  const cardName = searchParams.get("card") ?? undefined;
  const listingType = searchParams.get("listingType") as ListingType | null;

  const listings = await getListings({
    marketplace: marketplace ?? undefined,
    game,
    cardName,
    listingType: listingType ?? undefined,
  });

  return NextResponse.json({ listings });
}

// POST /api/marketplace — create a listing
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { cardName, setName, game, condition, conditionNotes, priceCents, quantity, imageUrl, description, listingType } = body;

  if (!cardName || typeof cardName !== "string" || cardName.trim().length < 1) {
    return NextResponse.json({ error: "Card/product name is required" }, { status: 400 });
  }
  if (!game || typeof game !== "string") {
    return NextResponse.json({ error: "Game is required" }, { status: 400 });
  }
  // For sealed products, set name and condition are optional
  const resolvedListingType: ListingType =
    VALID_LISTING_TYPES.includes(listingType as ListingType) ? (listingType as ListingType) : "card";

  if (resolvedListingType === "card") {
    if (!setName || typeof setName !== "string") {
      return NextResponse.json({ error: "Set name is required for singles" }, { status: 400 });
    }
    if (!VALID_CONDITIONS.includes(condition as ListingCondition)) {
      return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
    }
  }
  if (typeof priceCents !== "number" || priceCents < 1) {
    return NextResponse.json({ error: "Price must be at least 1 cent" }, { status: 400 });
  }
  if (typeof quantity !== "number" || quantity < 1) {
    return NextResponse.json({ error: "Quantity must be at least 1" }, { status: 400 });
  }

  // Derive marketplace from seller's role
  const marketplace: "store" | "community" = user.role === "store" ? "store" : "community";

  const { v4: uuidv4 } = await import("uuid");

  const listing = await createListing({
    id: uuidv4(),
    sellerId: user.id,
    marketplace,
    listingType: resolvedListingType,
    cardName: (cardName as string).trim(),
    setName: typeof setName === "string" && setName.trim() ? setName.trim() : "Sealed Product",
    game: game as string,
    condition: (resolvedListingType === "sealed" ? ("Near Mint" as ListingCondition) : condition) as ListingCondition,
    conditionNotes: typeof conditionNotes === "string" && conditionNotes.trim() ? conditionNotes.trim() : undefined,
    priceCents: priceCents as number,
    quantity: quantity as number,
    imageUrl: typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : undefined,
    description: typeof description === "string" && description.trim() ? description.trim() : undefined,
    sellerRegion: user.region ?? undefined,
    createdAt: new Date().toISOString(),
    sold: false,
  } satisfies Omit<Listing, "sellerUsername" | "sellerAvatarUrl">);

  return NextResponse.json({ listing }, { status: 201 });
}
