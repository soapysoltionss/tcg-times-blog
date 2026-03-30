"use client";

import { useState } from "react";

/**
 * FlipCard
 *
 * Renders a card image that flips 180° on click to reveal the card back.
 * Uses CSS 3D perspective transforms — no extra dependencies.
 *
 * Props:
 *   frontSrc  — URL of the card face image
 *   backSrc   — URL of the card back image (defaults to standard FaB card back)
 *   alt       — alt text for the front image
 *   className — extra classes applied to the outer wrapper (controls sizing)
 */

const FAB_CARD_BACK = "/fab-card-back.png";

// Served from /public — always available, no external dependency.

export default function FlipCard({
  frontSrc,
  backSrc = FAB_CARD_BACK,
  alt,
  className = "",
}: {
  frontSrc: string;
  backSrc?: string;
  alt: string;
  className?: string;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className={`relative cursor-pointer select-none ${className}`}
      style={{ perspective: "1000px" }}
      onClick={() => setFlipped((f) => !f)}
      title={flipped ? "Click to flip back" : "Click to flip"}
    >
      {/* flip container */}
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: "139.6%", // standard card aspect ratio 63×88mm ≈ 1:1.396
          transformStyle: "preserve-3d",
          transition: "transform 0.55s cubic-bezier(0.45, 0.05, 0.55, 0.95)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front face */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={frontSrc}
            alt={alt}
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>

        {/* Back face */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backSrc}
            alt="Card back"
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      </div>

      {/* Flip hint badge — fades out after first flip */}
      {!flipped && (
        <span
          style={{ pointerEvents: "none" }}
          className="absolute bottom-2 right-2 label-upper text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded-sm opacity-70"
        >
          flip ↺
        </span>
      )}
    </div>
  );
}
