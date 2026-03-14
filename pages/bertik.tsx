import { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import { createClient } from "@supabase/supabase-js";
import type { ChartPoint } from "../components/BertikChart";

// Chart is client-only (recharts uses browser APIs)
const BertikChart = dynamic(() => import("../components/BertikChart"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#4d6a85", fontSize: 13 }}>
      Loading chart…
    </div>
  ),
});

// ── Types ──────────────────────────────────────────────────────────────────
export interface BettingRec {
  id: number;
  event_name: string;
  selection: string;
  odds: number;
  edge_pct: number | null;
  ev_pct: number | null;
  stake_pct: number | null;
  confidence: "high" | "medium" | "low" | null;
  status: "recommended" | "won" | "lost" | "push" | "void";
  profit_loss: number | null;
  recommended_at: string;
  settled_at: string | null;
  notes: string | null;
}

interface Props {
  active: BettingRec[];
  settled: BettingRec[];
  chartData: ChartPoint[];
  stats: {
    totalThisWeek: number;
    hitRate: number | null;
    roi: number | null;
    pending: number;
  };
  tableError: string | null;
}

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  pageBg:    "#0d1526",
  cardBg:    "#17243a",
  itemBg:    "#1c2d42",
  border:    "#263a55",
  borderSub: "#1e3050",
  badgeBg:   "#18283d",
  inputBg:   "#111e30",
  textMain:  "#dde9f8",
  textSec:   "#7a9ab8",
  textMuted: "#4d6a85",
  skeleton:  "#263a55",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number | null, decimals = 1, suffix = ""): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}${suffix}`;
}

function fmtOdds(n: number | null): string {
  if (n == null) return "—";
  return n.toFixed(2);
}

const CONF_STYLE: Record<string, { color: string; bg: string }> = {
  high:   { color: "#34d399", bg: "rgba(52,211,153,0.13)" },
  medium: { color: "#fde047", bg: "rgba(253,224,71,0.12)" },
  low:    { color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
};

const OUTCOME_STYLE: Record<string, { color: string; bg: string }> = {
  won:  { color: "#34d399", bg: "rgba(52,211,153,0.13)" },
  lost: { color: "#f87171", bg: "rgba(248,113,113,0.13)" },
  push: { color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  void: { color: "#475569", bg: "rgba(71,85,105,0.12)" },
};

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      borderRadius: 5,
      padding: "2px 8px",
      color,
      background: bg,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: C.textMuted, marginBottom: 10 }}>
        {label}
      </div>
      <div style={{
        fontSize: 32,
        fontWeight: 700,
        letterSpacing: "-0.03em",
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        color: color ?? C.textMain,
        lineHeight: 1,
        marginBottom: 6,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: C.textMuted }}>{sub}</div>}
    </div>
  );
}

// ── Table helpers ──────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: C.textMuted,
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: 13,
  color: C.textMain,
  borderBottom: `1px solid ${C.borderSub}`,
  verticalAlign: "middle",
};

const tdMuted: React.CSSProperties = {
  ...tdStyle,
  color: C.textSec,
  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
  fontSize: 12,
};

// ── Page component ─────────────────────────────────────────────────────────
export default function BertikPage({ active, settled, chartData, stats, tableError }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)", color: C.textMain }}>

      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: C.textMain }}>
          🎯 Bertik
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textSec }}>
          Betting intelligence — recommendations, results and ROI tracking.
        </p>
      </div>

      {/* Table missing warning */}
      {tableError && (
        <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, padding: "14px 18px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "#fcd34d" }}>
            ⚠ betting_recommendations table not found
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#fde68a" }}>
            Run this SQL in your Supabase SQL editor to create it:
          </p>
          <pre style={{
            margin: 0,
            padding: "12px 14px",
            background: "#0b1422",
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            fontSize: 11,
            color: "#93c5fd",
            overflowX: "auto",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            lineHeight: 1.6,
          }}>{`CREATE TABLE betting_recommendations (
  id bigserial PRIMARY KEY,
  event_name text NOT NULL,
  selection text NOT NULL,
  odds numeric(6,3) NOT NULL,
  edge_pct numeric(5,2),
  ev_pct numeric(5,2),
  stake_pct numeric(5,2),
  confidence text CHECK (confidence IN ('high','medium','low')) DEFAULT 'medium',
  status text NOT NULL
    CHECK (status IN ('recommended','won','lost','push','void'))
    DEFAULT 'recommended',
  profit_loss numeric(8,3),
  recommended_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  notes text
);`}</pre>
        </div>
      )}

      {/* ── STAT CARDS ─────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatCard
          label="Recs this week"
          value={String(stats.totalThisWeek)}
          sub="last 7 days"
        />
        <StatCard
          label="Hit rate"
          value={stats.hitRate != null ? `${stats.hitRate.toFixed(0)}%` : "—"}
          sub="wins / settled"
          color={stats.hitRate != null ? (stats.hitRate >= 55 ? "#34d399" : stats.hitRate >= 45 ? "#fde047" : "#f87171") : undefined}
        />
        <StatCard
          label="ROI"
          value={stats.roi != null ? `${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}%` : "—"}
          sub="net units / bets"
          color={stats.roi != null ? (stats.roi > 0 ? "#34d399" : stats.roi < 0 ? "#f87171" : C.textMain) : undefined}
        />
        <StatCard
          label="Pending"
          value={String(stats.pending)}
          sub="awaiting result"
          color={stats.pending > 0 ? "#60a5fa" : C.textSec}
        />
      </div>

      {/* ── ACTIVE RECOMMENDATIONS ─────────────────────────────────────── */}
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textMuted }}>
            Active Recommendations
          </h2>
          <span style={{ fontSize: 12, color: C.textSec, background: C.badgeBg, borderRadius: 6, padding: "2px 8px" }}>
            {active.length}
          </span>
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          {active.length === 0 ? (
            <p style={{ margin: 0, padding: "18px 16px", fontSize: 13, color: C.textMuted }}>
              No active recommendations right now.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.itemBg }}>
                    <th style={thStyle}>Event</th>
                    <th style={thStyle}>Selection</th>
                    <th style={thStyle}>Odds</th>
                    <th style={thStyle}>Edge %</th>
                    <th style={thStyle}>EV %</th>
                    <th style={thStyle}>Stake %</th>
                    <th style={thStyle}>Confidence</th>
                    <th style={thStyle}>Recommended at</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map(rec => {
                    const conf = rec.confidence ?? "medium";
                    const cs = CONF_STYLE[conf] ?? CONF_STYLE.medium;
                    return (
                      <tr key={rec.id} style={{ transition: "background 0.1s" }}>
                        <td style={tdStyle}>{rec.event_name}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{rec.selection}</td>
                        <td style={tdMuted}>{fmtOdds(rec.odds)}</td>
                        <td style={{ ...tdMuted, color: rec.edge_pct != null && rec.edge_pct > 0 ? "#34d399" : C.textSec }}>
                          {rec.edge_pct != null ? `${rec.edge_pct.toFixed(1)}%` : "—"}
                        </td>
                        <td style={{ ...tdMuted, color: rec.ev_pct != null && rec.ev_pct > 0 ? "#34d399" : C.textSec }}>
                          {rec.ev_pct != null ? `${rec.ev_pct.toFixed(1)}%` : "—"}
                        </td>
                        <td style={tdMuted}>
                          {rec.stake_pct != null ? `${rec.stake_pct.toFixed(1)}%` : "—"}
                        </td>
                        <td style={{ ...tdStyle }}>
                          <Badge label={conf} color={cs.color} bg={cs.bg} />
                        </td>
                        <td style={tdMuted}>
                          {new Date(rec.recommended_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── RECENT SETTLED BETS ────────────────────────────────────────── */}
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textMuted }}>
            Recent Settled Bets
          </h2>
          <span style={{ fontSize: 12, color: C.textSec, background: C.badgeBg, borderRadius: 6, padding: "2px 8px" }}>
            {settled.length}
          </span>
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          {settled.length === 0 ? (
            <p style={{ margin: 0, padding: "18px 16px", fontSize: 13, color: C.textMuted }}>
              No settled bets yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.itemBg }}>
                    <th style={thStyle}>Event</th>
                    <th style={thStyle}>Selection</th>
                    <th style={thStyle}>Odds</th>
                    <th style={thStyle}>Outcome</th>
                    <th style={thStyle}>Profit / Loss</th>
                    <th style={thStyle}>Edge was</th>
                    <th style={thStyle}>Settled at</th>
                  </tr>
                </thead>
                <tbody>
                  {settled.map(rec => {
                    const os = OUTCOME_STYLE[rec.status] ?? OUTCOME_STYLE.void;
                    const plColor = rec.profit_loss == null ? C.textSec : rec.profit_loss > 0 ? "#34d399" : rec.profit_loss < 0 ? "#f87171" : C.textSec;
                    return (
                      <tr key={rec.id}>
                        <td style={tdStyle}>{rec.event_name}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{rec.selection}</td>
                        <td style={tdMuted}>{fmtOdds(rec.odds)}</td>
                        <td style={tdStyle}>
                          <Badge label={rec.status} color={os.color} bg={os.bg} />
                        </td>
                        <td style={{ ...tdMuted, color: plColor, fontWeight: 600 }}>
                          {fmt(rec.profit_loss, 2, " u")}
                        </td>
                        <td style={{ ...tdMuted, color: rec.edge_pct != null && rec.edge_pct > 0 ? "#34d399" : C.textSec }}>
                          {rec.edge_pct != null ? `${rec.edge_pct.toFixed(1)}%` : "—"}
                        </td>
                        <td style={tdMuted}>
                          {rec.settled_at ? new Date(rec.settled_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── PERFORMANCE CHART ──────────────────────────────────────────── */}
      <section>
        <h2 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textMuted }}>
          Cumulative ROI
        </h2>
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 16px 10px" }}>
          <BertikChart data={chartData} />
        </div>
      </section>

    </div>
  );
}

// ── Server-side data fetching ──────────────────────────────────────────────
export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return {
      props: {
        active: [], settled: [], chartData: [],
        stats: { totalThisWeek: 0, hitRate: null, roi: null, pending: 0 },
        tableError: "Supabase not configured.",
      },
    };
  }

  const sb = createClient(url, key);

  const { data, error } = await sb
    .from("betting_recommendations")
    .select("*")
    .order("recommended_at", { ascending: false })
    .limit(200);

  if (error) {
    return {
      props: {
        active: [], settled: [], chartData: [],
        stats: { totalThisWeek: 0, hitRate: null, roi: null, pending: 0 },
        tableError: error.message,
      },
    };
  }

  const all = (data ?? []) as BettingRec[];

  const active  = all.filter(r => r.status === "recommended");
  const settled = all.filter(r => ["won", "lost", "push"].includes(r.status)).slice(0, 30);

  // Stats
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const totalThisWeek = all.filter(r => new Date(r.recommended_at) >= weekAgo).length;
  const pending = active.length;

  const wins   = all.filter(r => r.status === "won").length;
  const losses = all.filter(r => r.status === "lost").length;
  const hitRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : null;

  const settledWithPL = all.filter(r => r.profit_loss != null && ["won", "lost", "push"].includes(r.status));
  const netUnits = settledWithPL.reduce((s, r) => s + (r.profit_loss ?? 0), 0);
  const roi = settledWithPL.length > 0 ? (netUnits / settledWithPL.length) * 100 : null;

  // Chart: cumulative ROI sorted by settled_at
  const sortedSettled = [...settledWithPL]
    .filter(r => r.settled_at)
    .sort((a, b) => new Date(a.settled_at!).getTime() - new Date(b.settled_at!).getTime());

  let cum = 0;
  const chartData: ChartPoint[] = sortedSettled.map(r => {
    cum += r.profit_loss ?? 0;
    return {
      date: new Date(r.settled_at!).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      cumROI: parseFloat(cum.toFixed(3)),
    };
  });

  return {
    props: {
      active,
      settled,
      chartData,
      stats: { totalThisWeek, hitRate, roi, pending },
      tableError: null,
    },
  };
};
