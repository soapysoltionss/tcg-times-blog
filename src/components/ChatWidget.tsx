"use client";

import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
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

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open TCG assistant"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-xl flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95"
      >
        {open ? "✕" : "🃏"}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden bg-white dark:bg-gray-900">
          {/* Header */}
          <div className="bg-violet-600 px-4 py-3 flex items-center gap-2">
            <span className="text-xl">🃏</span>
            <div>
              <p className="text-white font-bold text-sm leading-none">TCG Assistant</p>
              <p className="text-violet-200 text-xs mt-0.5">Grand Archive · FaB · One Piece TCG</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80 min-h-[12rem]">
            {messages.length === 0 && (
              <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-6">
                <p className="text-2xl mb-2">👋</p>
                <p>Ask me anything about Grand Archive, Flesh and Blood, One Piece TCG, or general TCG strategy!</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-br-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-3 py-2">
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
            onSubmit={sendMessage}
            className="border-t border-gray-200 dark:border-gray-700 p-3 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a TCG question…"
              disabled={loading}
              className="flex-1 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 text-gray-900 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
