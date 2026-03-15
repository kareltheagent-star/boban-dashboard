import Link from "next/link";

const C = {
  bg:       "#17243a",
  border:   "#263a55",
  active:   "#dde9f8",
  inactive: "#4d6a85",
  accent:   "#5b5ef4",
};

// Each entry is a direct navigation tab.
// Using individual pages (not groups) so every section is one tap away.
const TABS: { icon: string; label: string; href: string }[] = [
  { icon: "🏠", label: "Status",  href: "/"         },
  { icon: "📋", label: "Tasks",   href: "/backlog"  },
  { icon: "📚", label: "Learn",   href: "/learning" },
  { icon: "🎯", label: "Bertik",  href: "/bertik"   },
];

export function BottomNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map(tab => {
        const active = currentPath === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              textDecoration: "none",
              color: active ? C.active : C.inactive,
              fontSize: 10,
              fontWeight: active ? 600 : 400,
              paddingBottom: 2,
              borderTop: active ? `2px solid ${C.accent}` : "2px solid transparent",
              background: active ? "rgba(91,94,244,0.08)" : "transparent",
              transition: "all 0.12s",
              // Ensure every tab meets the 44×44px touch target minimum
              minHeight: 44,
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{ letterSpacing: "0.03em" }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
