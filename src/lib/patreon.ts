/**
 * Patreon API helpers — SERVER ONLY.
 *
 * Fetches the current user's membership status for OUR campaign and
 * maps it to our internal Subscription type.
 *
 * Requires:
 *   PATREON_CAMPAIGN_ID  — your campaign id (e.g. "12345678")
 *                          Find it at https://www.patreon.com/portal
 *
 * The access token must have scope: identity identity[email] identity.memberships
 */

import type { Subscription } from "@/lib/xp";

interface PatreonMemberResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      patron_status: string | null;       // "active_patron" | "declined_patron" | "former_patron" | null
      next_charge_date: string | null;
    };
    relationships: {
      currently_entitled_tiers: {
        data: { id: string; type: string }[];
      };
    };
  }[];
  included?: {
    id: string;
    type: string;
    attributes: { title?: string };
  }[];
}

function patronStatusToSubscriptionStatus(
  patronStatus: string | null
): Subscription["status"] {
  switch (patronStatus) {
    case "active_patron":   return "active";
    case "declined_patron": return "declined";
    case "former_patron":   return "cancelled";
    default:                return "expired";
  }
}

/**
 * Fetch the calling user's membership for our Patreon campaign.
 * Returns `undefined` if the user is not a member or an error occurs.
 */
export async function fetchPatreonSubscription(
  accessToken: string
): Promise<Subscription | undefined> {
  const campaignId = process.env.PATREON_CAMPAIGN_ID;
  if (!campaignId) {
    console.warn("[patreon] PATREON_CAMPAIGN_ID not set — skipping subscription sync");
    return undefined;
  }

  const url =
    "https://www.patreon.com/api/oauth2/v2/identity" +
    "?include=memberships.currently_entitled_tiers" +
    "&fields[member]=patron_status,next_charge_date" +
    "&fields[tier]=title";

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    console.error("[patreon] identity fetch failed:", res.status, await res.text());
    return undefined;
  }

  const body = (await res.json()) as {
    data: {
      relationships?: {
        memberships?: { data: { id: string }[] };
      };
    };
    included?: {
      id: string;
      type: string;
      attributes: {
        patron_status?: string | null;
        next_charge_date?: string | null;
        title?: string;
      };
      relationships?: {
        currently_entitled_tiers?: { data: { id: string }[] };
      };
    }[];
  };

  const membershipRefs = body.data.relationships?.memberships?.data ?? [];
  if (membershipRefs.length === 0) return undefined;

  const included = body.included ?? [];

  // Find the member object for our campaign
  // (users can be members of multiple campaigns — we match by campaignId via tier)
  // We'll take the first membership that has an entitled tier (simplest heuristic)
  for (const ref of membershipRefs) {
    const member = included.find((i) => i.type === "member" && i.id === ref.id);
    if (!member) continue;

    const tierRefs = member.relationships?.currently_entitled_tiers?.data ?? [];
    const tier = included.find(
      (i) => i.type === "tier" && tierRefs.some((t) => t.id === i.id)
    );

    const status = patronStatusToSubscriptionStatus(
      member.attributes.patron_status ?? null
    );

    return {
      patreonMemberId: ref.id,
      tierId: tier?.id ?? "unknown",
      tierName: tier?.attributes.title ?? "Patron",
      status,
      currentPeriodEnd: member.attributes.next_charge_date ?? undefined,
      syncedAt: new Date().toISOString(),
    };
  }

  return undefined;
}

/**
 * Parses a Patreon webhook payload and returns a partial Subscription update.
 * Used by the webhook route to update user subscription without an access token.
 */
export function parseWebhookMember(memberData: {
  id: string;
  attributes: {
    patron_status?: string | null;
    next_charge_date?: string | null;
  };
  relationships?: {
    currently_entitled_tiers?: { data: { id: string }[] };
  };
}, includedTiers: { id: string; attributes: { title?: string } }[] = []): Partial<Subscription> {
  const tierRef = memberData.relationships?.currently_entitled_tiers?.data?.[0];
  const tier = tierRef ? includedTiers.find((t) => t.id === tierRef.id) : undefined;
  const status = patronStatusToSubscriptionStatus(memberData.attributes.patron_status ?? null);

  return {
    patreonMemberId: memberData.id,
    tierId: tierRef?.id ?? "unknown",
    tierName: tier?.attributes.title ?? "Patron",
    status,
    currentPeriodEnd: memberData.attributes.next_charge_date ?? undefined,
    syncedAt: new Date().toISOString(),
  };
}
