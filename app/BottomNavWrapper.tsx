"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "../components/BottomNav";

/** Thin App Router wrapper that reads the current path and feeds BottomNav. */
export function BottomNavWrapper() {
  const path = usePathname() ?? "/";
  return <BottomNav currentPath={path} />;
}
