"use client";

import { usePathname } from "next/navigation";
import { NavDrawer } from "../components/NavDrawer";

/** Thin App Router wrapper — reads the current path and passes it to NavDrawer. */
export function DrawerWrapper() {
  const path = usePathname() ?? "/";
  return <NavDrawer currentPath={path} />;
}
