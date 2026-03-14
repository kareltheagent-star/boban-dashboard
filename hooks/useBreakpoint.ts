import { useState, useEffect } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

/**
 * Returns current breakpoint: mobile (<768), tablet (<1024), desktop (≥1024).
 * Defaults to "desktop" on the server to avoid layout shift on SSR pages.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>("desktop");

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      setBp(w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop");
    }
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  return bp;
}
