"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const C = {
  drawerBg:  "#17243a",
  border:    "#263a55",
  textMain:  "#dde9f8",
  textSec:   "#7a9ab8",
  textMuted: "#4d6a85",
  accent:    "#5b5ef4",
};

const NAV_GROUPS = [
  {
    section: "🤖 Boban",
    links: [
      { href: "/",         label: "Status",   icon: "🏠" },
      { href: "/backlog",  label: "Tasks",    icon: "📋" },
      { href: "/learning", label: "Learning", icon: "📚" },
    ],
  },
  {
    section: "🎯 Bertik",
    links: [
      { href: "/bertik", label: "Dashboard", icon: "📊" },
    ],
  },
];

export function NavDrawer({ currentPath }: { currentPath: string }) {
  const [open, setOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* ── Hamburger FAB — fixed bottom-right, mobile only ── */}
      <button
        className="hamburger-btn"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
      >
        ☰
      </button>

      {/* ── Semi-transparent backdrop ── */}
      {open && (
        <div
          className="drawer-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Slide-in drawer ── */}
      <nav
        className={`nav-drawer${open ? " open" : ""}`}
        aria-label="Site navigation"
      >
        {/* Header row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 16px 14px",
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.textMuted,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            Navigation
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            style={{
              background: "transparent",
              border: "none",
              color: C.textMuted,
              fontSize: 20,
              lineHeight: 1,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 6,
              minWidth: 36,
              minHeight: 36,
            }}
          >
            ✕
          </button>
        </div>

        {/* Nav links */}
        <div style={{ padding: "12px 10px", overflowY: "auto", flex: 1 }}>
          {NAV_GROUPS.map(group => (
            <div key={group.section} style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.textMuted,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "4px 8px 8px",
              }}>
                {group.section}
              </div>
              {group.links.map(({ href, label, icon }) => {
                const active = currentPath === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 10px",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: active ? 600 : 400,
                      color: active ? C.textMain : C.textSec,
                      background: active ? "rgba(91,94,244,0.18)" : "transparent",
                      textDecoration: "none",
                      borderLeft: active ? `2px solid ${C.accent}` : "2px solid transparent",
                      marginBottom: 2,
                      minHeight: 44,
                      transition: "background 0.12s, color 0.12s",
                    }}
                  >
                    <span style={{ fontSize: 17, width: 24, textAlign: "center", flexShrink: 0 }}>
                      {icon}
                    </span>
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
