/**
 * ai-coach.ts — backward-compatibility re-export shim.
 *
 * All logic has been moved to src/lib/coach/ for debuggability.
 * Import from "@/lib/ai-coach" as before — nothing breaks.
 */

export * from "./coach/index";
