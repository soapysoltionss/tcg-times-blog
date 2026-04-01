import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Local Meetup Safety Guide · TCG Times",
  description:
    "Tips for safely buying and selling TCG cards in person. Protect yourself when meeting a stranger for a local pickup or card trade.",
};

const tips = [
  {
    icon: "📍",
    title: "Meet in a public place",
    body: "Always meet in a busy, well-lit public location — a local game store, a café, or a shopping-centre food court. Avoid meeting at home addresses, especially for a first transaction.",
  },
  {
    icon: "🕑",
    title: "Go during daylight hours",
    body: "Daytime meetings are safer. If evening is the only option, choose a well-lit indoor venue with plenty of other people around.",
  },
  {
    icon: "👥",
    title: "Bring a friend",
    body: "Whenever possible, bring a friend or family member with you. Two people are far less likely to be targeted, and having a witness protects both parties.",
  },
  {
    icon: "📱",
    title: "Tell someone where you're going",
    body: "Let a trusted person know the time, location, and the username of who you're meeting. Share your live location with them if you feel more comfortable doing so.",
  },
  {
    icon: "🔍",
    title: "Verify the cards before paying",
    body: "Inspect every card carefully under good lighting. Check for fakes (proxy printing, uneven texture, font inconsistencies), wrong condition, or missing cards. Never pay before you've checked the goods.",
  },
  {
    icon: "💳",
    title: "Use a traceable payment method",
    body: "Pay via PayNow, PayLah!, PayID, Revolut, or a similar traceable transfer rather than cash if possible. Keep a screenshot of the transaction as proof.",
  },
  {
    icon: "💬",
    title: "Keep all communication on-platform",
    body: "Use the TCG Times messaging system so there's a record of what was agreed. Be wary of anyone who insists on moving to a private channel before the deal is done.",
  },
  {
    icon: "🚩",
    title: "Watch for red flags",
    body: "Be cautious if the seller is rushing you, refuses to meet in public, asks you to bring extra cash, or the price is suspiciously low. Trust your instincts — it's okay to walk away.",
  },
  {
    icon: "🛡️",
    title: "Report problems",
    body: "If something goes wrong, use the Dispute feature on the listing page and contact us at support@tcgtimes.blog. For safety emergencies, contact your local emergency services.",
  },
];

export default function LocalMeetupSafetyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 lg:px-10 py-14">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <Link
          href="/marketplace"
          className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          ← Back to Marketplace
        </Link>
      </nav>

      {/* Header */}
      <div className="border-b-2 border-[var(--border-strong)] pb-6 mb-10">
        <p className="label-upper text-[var(--text-muted)] mb-2">Tools</p>
        <h1
          className="text-4xl font-black text-[var(--foreground)] leading-tight mb-3"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          Local Meetup Safety Guide
        </h1>
        <p className="text-[var(--text-muted)] text-sm leading-relaxed">
          Buying or selling cards in person is a great way to get fair prices without shipping
          costs — but it pays to be prepared. Follow these guidelines to keep every transaction
          safe and stress-free.
        </p>
      </div>

      {/* Tips */}
      <div className="flex flex-col divide-y divide-[var(--border)]">
        {tips.map((tip) => (
          <div key={tip.title} className="py-6 flex gap-5">
            <span className="text-2xl shrink-0 mt-0.5">{tip.icon}</span>
            <div>
              <h2 className="font-bold text-[var(--foreground)] mb-1.5">{tip.title}</h2>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">{tip.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="mt-12 border border-[var(--border)] p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-bold text-[var(--foreground)] mb-1">Ready to buy or sell locally?</p>
          <p className="text-sm text-[var(--text-muted)]">
            Browse local pickup listings in the community marketplace.
          </p>
        </div>
        <Link
          href="/marketplace?localOnly=true"
          className="label-upper px-5 py-2.5 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity shrink-0 text-[10px]"
        >
          📍 Browse Local Listings →
        </Link>
      </div>
    </div>
  );
}
