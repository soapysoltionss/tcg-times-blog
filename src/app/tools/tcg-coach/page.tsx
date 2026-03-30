"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MODEL_OPTIONS, TIER_META, type ModelChoice } from "@/lib/ai-coach";

type Message = { role: "user" | "assistant"; content: string };
type Intent = "rules" | "deckbuilding" | "prices" | "matchup" | "general";

// TIER_LABELS is derived from TIER_META (imported from @/lib/ai-coach)
const TIER_LABELS: Record<number, { label: string; color: string; limit: number }> = {
  0: { label: TIER_META[0].name, color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300", limit: TIER_META[0].dailyLimit },
  1: { label: TIER_META[1].name, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300", limit: TIER_META[1].dailyLimit },
  2: { label: TIER_META[2].name, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", limit: TIER_META[2].dailyLimit },
  3: { label: TIER_META[3].name, color: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300", limit: TIER_META[3].dailyLimit },
};

const INTENT_META: Record<Intent, { emoji: string; label: string }> = {
  rules: { emoji: "📜", label: "Rules" },
  deckbuilding: { emoji: "🃏", label: "Deckbuilding" },
  prices: { emoji: "💰", label: "Prices" },
  matchup: { emoji: "⚔️", label: "Matchup" },
  general: { emoji: "💬", label: "General" },
};

const QUICK_PROMPTS = [
  { text: "What should a new FaB player buy first?", intent: "prices" as Intent },
  { text: "How do I build a budget Fai deck?", intent: "deckbuilding" as Intent },
  { text: "How does Fai's hero ability work?", intent: "rules" as Intent },
  { text: "What's the Dromai matchup strategy?", intent: "matchup" as Intent },
  { text: "How do I start One Piece TCG on a budget?", intent: "prices" as Intent },
  { text: "What cards should I cut vs Verdance?", intent: "matchup" as Intent },
];

export default function TcgCoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState<number>(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [lastIntent, setLastIntent] = useState<Intent | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [modelChoice, setModelChoice] = useState<ModelChoice>("claude");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch tier from session
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        const lvl = data?.tierLevel ?? 0;
        setTier(lvl);
        setRemaining(TIER_LABELS[lvl]?.limit ?? 5);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading || rateLimited) return;
    const userMessage: Message = { role: "user", content: text };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/tcg-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, modelChoice }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setRateLimited(true);
        setRemaining(0);
        setMessages([
          ...next,
          {
            role: "assistant",
            content:
              tier === 0
                ? `You've used all ${data.limit} free questions for today. Resets at midnight UTC.\n\nUpgrade to Starter for 10 questions/day (SGD 6/mo), Basic for 30/day (SGD 18/mo), or Pro for 100/day with premium models (SGD 48/mo).`
                : `You've reached your daily limit of ${data.limit} questions. Resets at midnight UTC.\n\nUpgrade to unlock more daily questions.`,
          },
        ]);
        return;
      }

      const data = await res.json();
      if (data.intent) setLastIntent(data.intent as Intent);
      if (data.provider) setLastProvider(data.provider as string);
      if (data.usage) setRemaining(data.usage.remaining);

      setMessages([
        ...next,
        {
          role: "assistant",
          content: data.reply ?? data.error ?? "Something went wrong.",
        },
      ]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  const tierMeta = TIER_LABELS[tier] ?? TIER_LABELS[0];
  const activeModel = MODEL_OPTIONS.find((m) => m.id === modelChoice) ?? MODEL_OPTIONS[0];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <span className="text-3xl">{activeModel.badge}</span>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
            TCG AI Coach
          </h1>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tierMeta.color}`}>
            {tierMeta.label}
          </span>
          {lastIntent && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              {INTENT_META[lastIntent].emoji} {INTENT_META[lastIntent].label} agent
            </span>
          )}
        </div>
        <div className="flex items-center justify-between ml-12 flex-wrap gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Flesh and Blood · Grand Archive · One Piece TCG
          </p>
          <div className="flex items-center gap-3">
            {remaining !== null && !rateLimited && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {remaining} / {tierMeta.limit} today
              </p>
            )}
            {tier < 3 && (
              <Link
                href="/subscribe"
                className="text-xs text-violet-600 dark:text-violet-400 hover:underline font-medium"
              >
                Upgrade →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Model picker */}
      <div className="mb-5 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowModelPicker((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="flex items-center gap-2 font-medium">
            <span>{activeModel.badge}</span>
            <span>{activeModel.label}</span>
            <span className="text-xs font-normal text-gray-400 dark:text-gray-500 hidden sm:inline">
              — {activeModel.tagline}
            </span>
          </span>
          <span className="text-xs text-gray-400">{showModelPicker ? "▲ Hide" : "▼ Switch model"}</span>
        </button>

        {showModelPicker && (
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-gray-700 border-t border-gray-200 dark:border-gray-700">
            {MODEL_OPTIONS.map((m) => {
              const locked = tier < m.tierRequired;
              const active = modelChoice === m.id;
              return (
                <button
                  key={m.id}
                  disabled={locked}
                  onClick={() => { setModelChoice(m.id); setShowModelPicker(false); }}
                  className={`flex flex-col gap-2 p-4 text-left transition-colors ${
                    active
                      ? "bg-violet-50 dark:bg-violet-950/40"
                      : locked
                      ? "opacity-40 cursor-not-allowed bg-white dark:bg-gray-900"
                      : "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{m.badge}</span>
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{m.label}</span>
                    {active && <span className="text-[10px] text-violet-600 dark:text-violet-400 font-bold ml-auto">ACTIVE</span>}
                    {locked && <span className="text-[10px] text-gray-400 font-semibold ml-auto">BASIC+</span>}
                  </div>
                  <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">{m.tagline}</p>
                  <ul className="space-y-0.5">
                    {m.strengths.map((s) => (
                      <li key={s} className="text-[11px] text-gray-500 dark:text-gray-400 flex gap-1">
                        <span className="text-gray-300 dark:text-gray-600 shrink-0">—</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-medium uppercase tracking-wide">
                    Best for: {m.bestFor}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-2 mb-6">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q.text}
            onClick={() => sendMessage(q.text)}
            disabled={loading || rateLimited}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            {INTENT_META[q.intent].emoji} {q.text}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[28rem] max-h-[60vh] bg-gray-50 dark:bg-gray-900/50">
          {messages.length === 0 && (
            <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-16">
              <p className="text-4xl mb-3">🤖</p>
              <p className="font-semibold mb-1 text-gray-600 dark:text-gray-300">TCG AI Coach</p>
              <p className="text-xs mb-2">
                Rules · Deckbuilding · Prices · Matchup strategy
              </p>
              <p className="text-xs text-gray-400">
                Automatically routes your question to the right specialist.
              </p>
              <div className="mt-4 flex justify-center gap-3 flex-wrap">
                {(["rules", "deckbuilding", "prices", "matchup"] as Intent[]).map((i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500">
                    {INTENT_META[i].emoji} {INTENT_META[i].label}
                  </span>
                ))}
              </div>
              {tier === 0 && (
                <p className="text-xs mt-4 text-gray-400">
                  {tierMeta.limit} free questions/day · No account needed ·{" "}
                  <Link href="/subscribe" className="text-violet-500 hover:underline">
                    Upgrade for more
                  </Link>
                </p>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <span className="text-lg mr-2 mt-0.5 shrink-0">🤖</span>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-violet-600 text-white rounded-br-sm"
                    : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm border border-gray-200 dark:border-gray-700 shadow-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <span className="text-lg mr-2 mt-0.5">🤖</span>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <span className="flex gap-1 items-center h-5">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Rate-limit CTA */}
        {rateLimited && (
          <div className="border-t border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-5 py-5 text-sm text-center">
            <p className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
              Daily limit reached
            </p>
            <p className="text-amber-700 dark:text-amber-400 text-xs mb-4">
              Resets at midnight UTC
            </p>
            {tier === 0 && (
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Link
                  href="/subscribe#plans"
                  className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Starter — 10/day (SGD 6/mo) →
                </Link>
                <Link
                  href="/subscribe#plans"
                  className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Basic — 30/day (SGD 18/mo) →
                </Link>
                <Link
                  href="/subscribe#plans"
                  className="inline-block px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Pro — 100/day + premium models (SGD 48/mo) →
                </Link>
              </div>
            )}
            {tier === 1 && (
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Link
                  href="/subscribe#plans"
                  className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Basic — 30/day (SGD 18/mo) →
                </Link>
                <Link
                  href="/subscribe#plans"
                  className="inline-block px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Pro — 100/day + premium models (SGD 48/mo) →
                </Link>
              </div>
            )}
            {tier === 2 && (
              <Link
                href="/subscribe#plans"
                className="inline-block px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Upgrade to Pro — 100/day + Claude Sonnet (SGD 48/mo) →
              </Link>
            )}
          </div>
        )}

        {/* Input */}
        {!rateLimited && (
          <form
            onSubmit={handleSubmit}
            className="border-t border-gray-200 dark:border-gray-700 p-4 flex gap-3 bg-white dark:bg-gray-900"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about rules, deckbuilding, card prices, or matchups…"
              disabled={loading}
              className="flex-1 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 text-gray-900 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Send
            </button>
          </form>
        )}
      </div>

      {/* Tier info + clear */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-gray-400 dark:text-gray-500 space-x-3">
          <span>{activeModel.badge} Powered by {lastProvider ?? activeModel.provider}</span>
          {tier === 0 && <span>· Free tier uses {activeModel.id === "claude" ? "Haiku" : activeModel.label}</span>}
          {tier === 1 && <span>· Starter uses {activeModel.id === "claude" ? "Haiku" : activeModel.label}</span>}
          {tier === 2 && <span>· Basic uses {activeModel.id === "claude" ? "Haiku" : activeModel.label}</span>}
          {tier === 3 && <span>· Pro uses {activeModel.id === "claude" ? "Sonnet" : activeModel.label + " Pro"}</span>}
        </div>
        {messages.length > 0 && !rateLimited && (
          <button
            onClick={() => { setMessages([]); setLastIntent(null); setLastProvider(null); }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
