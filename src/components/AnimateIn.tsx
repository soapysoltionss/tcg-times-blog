"use client";

/**
 * AnimateIn — GSAP ScrollTrigger fade-up wrapper
 *
 * Wrap any content and it will fade + slide up into view as it enters
 * the viewport. Uses GSAP ScrollTrigger; each wrapped element triggers
 * independently.
 *
 * Usage:
 *   <AnimateIn delay={0.1}>
 *     <PostCard post={post} />
 *   </AnimateIn>
 */

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface AnimateInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  once?: boolean;
}

export default function AnimateIn({ children, delay = 0, className, once = true }: AnimateInProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const tween = gsap.fromTo(
      el,
      { opacity: 0, y: 32 },
      {
        opacity: 1,
        y: 0,
        duration: 0.55,
        delay,
        ease: "power2.out",
        clearProps: "transform,opacity",
        scrollTrigger: {
          trigger: el,
          start: "top 92%",
          once,
        },
      }
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [delay, once]);

  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}
