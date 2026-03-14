import Link from "next/link";

const C = {
  cardBg:   "#17243a",
  border:   "#263a55",
  textMain: "#dde9f8",
  textMuted:"#4d6a85",
};

const TABS: { emoji: string; label: string; href: string; match: string[] }[] = [
  { emoji: "🤖", label: "Boban",  href: "/",       match: ["/", "/backlog", "/learning"] },
  { emoji: "🎯", label: "Bertik", href: "/bertik", match: ["/bertik"] },
];

export function BottomNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map(tab => {
        const active = tab.match.includes(currentPath);
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
              color: active ? C.textMain : C.textMuted,
              fontSize: 10,
              fontWeight: active ? 600 : 400,
              paddingBottom: 2,
              borderTop: active ? "2px solid #5b5ef4" : "2px solid transparent",
              background: active ? "rgba(91,94,244,0.08)" : "transparent",
              transition: "all 0.12s",
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.emoji}</span>
            <span style={{ letterSpacing: "0.03em" }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
