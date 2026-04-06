"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import gsap from "gsap";

/**
 * FlipCard
 *
 * Renders a trading card with:
 *  - GSAP-powered 3D tilt on mouse move (like holding a real card)
 *  - Click to flip front → back (game-appropriate card back)
 *  - Grand Archive double-sided card support via backFaceUrl
 *  - Subtle glare overlay that tracks the cursor
 *
 * Props:
 *   frontSrc    — URL of the card face image
 *   alt         — alt text for the front image
 *   game        — slug of the TCG ("flesh-and-blood" | "grand-archive" | "one-piece" | "pokemon")
 *   backFaceUrl — for GA double-sided cards: URL of the actual back-face art
 *   backSrc     — explicit override for the card back image (legacy / FaB double-sided)
 *   className   — extra classes for the outer wrapper (controls sizing)
 */

// Game slug → card back image served from /public
const CARD_BACKS: Record<string, string> = {
  "flesh-and-blood": "/fab-card-back.png",
  "grand-archive":   "/ga-card-back.jpg",
  "one-piece":       "/op-card-back.svg",
  "pokemon":         "/pokemon-card-back.png",
};
const DEFAULT_BACK = "/fab-card-back.png";

function resolveBack(game?: string, backSrc?: string): string {
  if (backSrc) return backSrc;
  if (game) return CARD_BACKS[game] ?? DEFAULT_BACK;
  return DEFAULT_BACK;
}

interface FlipCardProps {
  frontSrc: string;
  alt: string;
  game?: string;
  /** For GA double-sided cards: the actual back-face art (overrides card back design on flip) */
  backFaceUrl?: string;
  /** Explicit card back override (e.g. FaB printing's own back art) */
  backSrc?: string;
  className?: string;
}

export default function FlipCard({
  frontSrc,
  alt,
  game,
  backFaceUrl,
  backSrc,
  className = "",
}: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);

  // Resolved back image: explicit backFaceUrl (GA double-sided) > backSrc override > game default
  const backImage = backFaceUrl ?? resolveBack(game, backSrc);

  // GSAP quickTo setters — created once on mount
  const rotXRef = useRef<ReturnType<typeof gsap.quickTo> | null>(null);
  const rotYRef = useRef<ReturnType<typeof gsap.quickTo> | null>(null);

  // Track flip angle accumulation separately so tilt stays clean
  const flipAngleRef = useRef(0);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    rotXRef.current = gsap.quickTo(inner, "rotateX", { duration: 0.35, ease: "power3.out" });
    rotYRef.current  = gsap.quickTo(inner, "rotateY", { duration: 0.35, ease: "power3.out" });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !rotXRef.current || !rotYRef.current) return;
    const rect = wrapper.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width  - 0.5; // -0.5 → 0.5
    const cy = (e.clientY - rect.top)  / rect.height - 0.5;

    // Tilt: max ±12° horizontal, ±9° vertical
    rotYRef.current(flipAngleRef.current + cx * 24);
    rotXRef.current(-cy * 18);

    // Move glare highlight
    if (glareRef.current) {
      glareRef.current.style.background = `radial-gradient(circle at ${(cx + 0.5) * 100}% ${(cy + 0.5) * 100}%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 65%)`;
      glareRef.current.style.opacity = "1";
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    const inner = innerRef.current;
    if (!inner) return;
    // Spring back: keep flip angle, remove tilt
    gsap.to(inner, {
      rotateX: 0,
      rotateY: flipAngleRef.current,
      duration: 0.7,
      ease: "elastic.out(1, 0.5)",
    });
    if (glareRef.current) {
      gsap.to(glareRef.current, { opacity: 0, duration: 0.4 });
    }
  }, []);

  const handleClick = useCallback(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const next = !flipped;
    flipAngleRef.current = next ? 180 : 0;
    gsap.to(inner, {
      rotateY: flipAngleRef.current,
      duration: 0.55,
      ease: "power3.inOut",
    });
    setFlipped(next);
  }, [flipped]);

  return (
    <div
      ref={wrapperRef}
      className={`relative cursor-pointer select-none ${className}`}
      style={{ perspective: "900px" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      title={flipped ? "Click to flip back" : "Click to flip"}
    >
      {/* 3D inner — GSAP animates rotateX / rotateY directly on this element */}
      <div
        ref={innerRef}
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: "139.6%", // standard card ratio 63×88 mm ≈ 1:1.396
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        {/* Front face */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            borderRadius: "4%",
            overflow: "hidden",
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
            borderRadius: "4%",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backImage}
            alt="Card back"
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>

        {/* Glare overlay — tracks cursor, on top of both faces */}
        <div
          ref={glareRef}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "4%",
            pointerEvents: "none",
            opacity: 0,
            zIndex: 10,
            mixBlendMode: "screen",
          }}
        />
      </div>

      {/* Flip hint badge */}
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
