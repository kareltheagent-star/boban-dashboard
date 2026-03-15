"use client";
import { useState, useEffect, useLayoutEffect } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

// On the client we use useLayoutEffect — it fires synchronously after DOM
// mutations but BEFORE the browser paints, so the correct breakpoint is
// applied on the very first frame and the user never sees a desktop flash.
// On the server there is no DOM, so we fall back to useEffect (which is a
// no-op there anyway, but avoids the "useLayoutEffect does nothing on server"
// React warning).
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function getBreakpoint(): Breakpoint {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  return w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

/**
 * Returns current breakpoint: mobile (<768), tablet (<1024), desktop (≥1024).
 *
 * Initialises as "desktop" for SSR, then synchronously corrects to the real
 * breakpoint on the client before the first paint — no layout flash.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>("desktop"); // SSR-safe default

  useIsomorphicLayoutEffect(() => {
    function update() {
      setBp(getBreakpoint());
    }
    update(); // synchronous read — runs before first paint
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  return bp;
}
