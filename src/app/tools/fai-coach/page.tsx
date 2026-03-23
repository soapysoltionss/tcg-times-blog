"use client";

import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "What's my optimal sideboard vs Verdance?",
  "When should I cut Enflame the Firebrand?",
  "Explain Fai's hero ability timing",
  "Calculate EV for my last turn",
  "What's my matchup vs Briar?",
  "When does Compounding Anger become free?",
];

export default function FaiCoachPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    // Optimistically unlock — server will reject with 401 if wrong
    setAuthed(true);
    setAuthError("");
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMessage: Message = { role: "user", content: text };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/fai-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, password }),
      });

      if (res.status === 401) {
        setAuthed(false);
        setAuthError("Incorrect password.");
        setMessages(messages); // revert
        setLoading(false);
        return;
      }

      const data = await res.json();
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

  // Auth gate
  if (!authed) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🩸</div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
              Fai Silver Age Coach
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Private coaching tool — enter password to continue
            </p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {authError && (
              <p className="text-sm text-red-500">{authError}</p>
            )}
            <button
              type="submit"
              disabled={!password.trim()}
              className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🩸</span>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
            Fai Silver Age Coach
          </h1>
          <span className="text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-2 py-0.5 rounded-full">
            Private
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 ml-12">
          Claude Sonnet · Lars Seebacher's list · Silver Age meta (March 2026)
        </p>
      </div>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-2 mb-6">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[28rem] max-h-[60vh] bg-gray-50 dark:bg-gray-900/50">
          {messages.length === 0 && (
            <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-16">
              <p className="text-3xl mb-3">⚔️</p>
              <p className="font-medium mb-1">Fai Silver Age Coaching</p>
              <p className="text-xs">Ask about sideboards, EV calculations, matchup lines, or card interactions.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <span className="text-lg mr-2 mt-0.5 shrink-0">🩸</span>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-red-600 text-white rounded-br-sm"
                    : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm border border-gray-200 dark:border-gray-700 shadow-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <span className="text-lg mr-2 mt-0.5">🩸</span>
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

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-gray-200 dark:border-gray-700 p-4 flex gap-3 bg-white dark:bg-gray-900"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about sideboards, EV, matchups, card interactions…"
            disabled={loading}
            className="flex-1 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 text-gray-900 dark:text-gray-100"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Send
          </button>
        </form>
      </div>

      {/* Clear */}
      {messages.length > 0 && (
        <div className="mt-3 text-right">
          <button
            onClick={() => setMessages([])}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Clear conversation
          </button>
        </div>
      )}
    </div>
  );
}
