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
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-[#0a0a0a] hover:opacity-70 text-[#fafaf8] shadow-xl flex items-center justify-center text-lg transition-all active:scale-95"
      >
        {open ? "✕" : "🃏"}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 flex flex-col border-2 border-[#0a0a0a] shadow-2xl overflow-hidden bg-[#fafaf8]">
          {/* Header */}
          <div className="bg-[#0a0a0a] px-4 py-3 flex items-center gap-3">
            <span className="text-lg">🃏</span>
            <div>
              <p className="text-[#fafaf8] font-bold text-sm leading-none tracking-wide">TCG ASSISTANT</p>
              <p className="text-[#6b6860] text-xs mt-0.5 tracking-wider uppercase">Grand Archive · FaB · One Piece TCG</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80 min-h-[12rem]">
            {messages.length === 0 && (
              <div className="text-center text-sm text-[#6b6860] py-6">
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
                  className={`max-w-[85%] px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#0a0a0a] text-[#fafaf8]"
                      : "bg-[#f0efec] text-[#0a0a0a] border border-[#d6d3cc]"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#f0efec] border border-[#d6d3cc] px-3 py-2">
                  <span className="flex gap-1 items-center h-5">
                    <span className="w-1.5 h-1.5 bg-[#6b6860] rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-[#6b6860] rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-[#6b6860] rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="border-t border-[#d6d3cc] p-3 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a TCG question…"
              disabled={loading}
              className="flex-1 text-sm border border-[#d6d3cc] bg-[#fafaf8] px-3 py-2 focus:outline-none focus:border-[#0a0a0a] disabled:opacity-50 text-[#0a0a0a]"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-3 py-2 bg-[#0a0a0a] hover:opacity-70 disabled:opacity-30 text-[#fafaf8] text-sm font-bold tracking-wider uppercase transition-opacity"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
