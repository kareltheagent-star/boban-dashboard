"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const C = {
  cardBg:    "#17243a",
  border:    "#263a55",
  textMain:  "#dde9f8",
  textSec:   "#7a9ab8",
  textMuted: "#4d6a85",
};

const NAV: { section: string; emoji: string; links: { href: string; label: string }[] }[] = [
  {
    section: "Boban",
    emoji: "🤖",
    links: [
      { href: "/",         label: "Status" },
      { href: "/backlog",  label: "Backlog" },
      { href: "/learning", label: "Learning" },
    ],
  },
  {
    section: "Bertik",
    emoji: "🎯",
    links: [
      { href: "/bertik", label: "Dashboard" },
    ],
  },
];

export function NavSidebar() {
  const path = usePathname();

  return (
    <aside className="nav-sidebar" style={{
      width: 200,
      minHeight: "100vh",
      background: C.cardBg,
      borderRight: `1px solid ${C.border}`,
      padding: "20px 12px",
      flexDirection: "column",
      gap: 8,
      flexShrink: 0,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.textMuted,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        padding: "0 10px 12px",
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 8,
      }}>
        Dashboard
      </div>

      {NAV.map(group => (
        <div key={group.section} style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.textMuted,
            padding: "4px 10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            {group.emoji} {group.section}
          </div>
          {group.links.map(({ href, label }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "block",
                  padding: "6px 10px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? C.textMain : C.textSec,
                  background: active ? "rgba(91,94,244,0.18)" : "transparent",
                  textDecoration: "none",
                  borderLeft: active ? "2px solid #5b5ef4" : "2px solid transparent",
                  transition: "all 0.12s",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
