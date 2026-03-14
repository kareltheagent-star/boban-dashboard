import { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import { createClient } from "@supabase/supabase-js";
import type { ChartPoint } from "../components/BertikChart";
import { useBreakpoint } from "../hooks/useBreakpoint";

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
  // Legacy plain-text fields (still used as fallback)
  event_name: string | null;
  selection: string | null;
  // Structured fields
  sport: string | null;          // "soccer" | "basketball" | …
  league: string | null;         // "EPL" | "NBA" | "UCL" | …
  event_id: string | null;       // "soccer-epl-2026-03-15-ars-che"
  market_type: string | null;    // "h2h" | "totals" | "btts" | "spreads"
  selection_name: string | null; // "Arsenal" | "Over 2.5" | "Yes"
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

// ── Sport metadata ─────────────────────────────────────────────────────────
const SPORT_INFO: Record<string, { icon: string; color: string; bg: string }> = {
  soccer:     { icon: "⚽", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  football:   { icon: "🏈", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  basketball: { icon: "🏀", color: "#fb923c", bg: "rgba(251,146,60,0.12)" },
  tennis:     { icon: "🎾", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  baseball:   { icon: "⚾", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  hockey:     { icon: "🏒", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
};

// ── Team abbreviation → full name lookup ────────────────────────────────────
const TEAM_NAMES: Record<string, string> = {
  // EPL
  ars: "Arsenal",    che: "Chelsea",    mci: "Man City",    mun: "Man Utd",
  liv: "Liverpool",  tot: "Spurs",      avl: "Aston Villa", new: "Newcastle",
  eve: "Everton",    whu: "West Ham",   bha: "Brighton",    bur: "Burnley",
  wol: "Wolves",     bou: "Bournemouth",ful: "Fulham",      cry: "Crystal P.",
  // La Liga
  bar: "Barcelona",  rma: "Real Madrid",atm: "Atlético",    sev: "Sevilla",
  val: "Valencia",   bet: "Betis",      ath: "Athletic",
  // Bundesliga
  bay: "Bayern",     dor: "Dortmund",   rbl: "Leipzig",     bayer: "Leverkusen",
  // Serie A
  juv: "Juventus",   int: "Inter",      acm: "AC Milan",    nap: "Napoli",
  rom: "Roma",       laz: "Lazio",
  // Ligue 1
  psg: "PSG",        mar: "Marseille",  oly: "Lyon",
  // NBA
  lal: "Lakers",     bos: "Celtics",    gsw: "Warriors",    mil: "Bucks",
  bkn: "Nets",       phi: "76ers",      mia: "Heat",        den: "Nuggets",
  phx: "Suns",       dal: "Mavericks",  mem: "Grizzlies",   nop: "Pelicans",
  // NFL
  kcc: "Chiefs",     buf: "Bills",      sfo: "49ers",       phi_e: "Eagles",
};

function capWords(s: string): string {
  return s.split(/[\s_-]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ── Parse "soccer-epl-2026-03-15-ars-che" → { sport, league, matchLabel } ──
function parseEventId(eventId: string | null): { sport: string; league: string; matchLabel: string } {
  if (!eventId) return { sport: "", league: "", matchLabel: "" };

  const parts = eventId.split("-");
  let idx = 0;

  // Part 0: sport
  const sport = parts[idx++] ?? "";

  // Part 1: league code if it doesn't look like a year (4-digit number)
  let league = "";
  if (parts[idx] && !/^\d{4}$/.test(parts[idx])) {
    league = (parts[idx++] ?? "").toUpperCase();
  }

  // Skip YYYY-MM-DD (3 parts)
  idx += 3;

  // Remaining: team codes — expect exactly 2 tokens (each may be multi-word)
  const teamParts = parts.slice(idx);
  let t1 = "", t2 = "";
  if (teamParts.length >= 2) {
    t1 = teamParts[0];
    t2 = teamParts.slice(1).join("-");
  } else if (teamParts.length === 1) {
    t1 = teamParts[0];
  }

  const name1 = TEAM_NAMES[t1] ?? capWords(t1);
  const name2 = t2 ? (TEAM_NAMES[t2] ?? capWords(t2)) : "";
  const matchLabel = name2 ? `${name1} v ${name2}` : name1;

  return { sport, league, matchLabel };
}

// ── Parse market_type + selection_name → human-readable bet type ───────────
function parseBetType(marketType: string | null, selectionName: string | null): string {
  const sel = (selectionName ?? "").trim();
  switch ((marketType ?? "").toLowerCase()) {
    case "h2h":
    case "moneyline":
      return sel || "Match Result";
    case "totals":
    case "over_under":
      return sel || "Over/Under";
    case "btts":
    case "both_teams_score":
      return sel ? `BTTS ${sel}` : "BTTS";
    case "spreads":
    case "handicap":
      return sel || "Handicap";
    case "draw_no_bet":
      return sel ? `DNB: ${sel}` : "Draw No Bet";
    case "first_goalscorer":
      return sel ? `FGS: ${sel}` : "First Goal";
    default:
      return sel || (marketType ? capWords(marketType) : "—");
  }
}

// ── Resolve display fields from a rec (handles old vs new schema) ───────────
interface ParsedRec {
  sport: string;
  league: string;
  matchLabel: string;
  betType: string;
}

function parsedRec(rec: BettingRec): ParsedRec {
  // Start with explicit DB columns
  let sport  = rec.sport ?? "";
  let league = rec.league ?? "";

  // Fall back to parsing event_id
  const fromId = parseEventId(rec.event_id);
  if (!sport)  sport  = fromId.sport;
  if (!league) league = fromId.league;

  // Match label: prefer parsed event_id, fall back to legacy event_name
  const matchLabel = fromId.matchLabel || (rec.event_name ?? "—");

  // Bet type: prefer structured fields, fall back to legacy selection
  const betType =
    (rec.market_type || rec.selection_name)
      ? parseBetType(rec.market_type, rec.selection_name)
      : (rec.selection ?? "—");

  return { sport, league, matchLabel, betType };
}

// ── Sport pill ──────────────────────────────────────────────────────────────
function SportTag({ sport, league }: { sport: string; league: string }) {
  const info = SPORT_INFO[sport.toLowerCase()] ?? { icon: "🎲", color: "#7a9ab8", bg: "rgba(122,154,184,0.12)" };
  const label = league
    ? `${info.icon} ${league}`
    : sport ? `${info.icon} ${capWords(sport)}` : "—";
  return (
    <span style={{
      display: "inline-block",
      fontSize: 11,
      fontWeight: 600,
      borderRadius: 5,
      padding: "2px 8px",
      color: info.color,
      background: info.bg,
      whiteSpace: "nowrap",
      letterSpacing: "0.04em",
    }}>
      {label}
    </span>
  );
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
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";

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
  id             bigserial PRIMARY KEY,
  -- Structured fields (preferred)
  sport          text,                  -- "soccer", "basketball"
  league         text,                  -- "EPL", "NBA", "UCL"
  event_id       text,                  -- "soccer-epl-2026-03-15-ars-che"
  market_type    text,                  -- "h2h", "totals", "btts"
  selection_name text,                  -- "Arsenal", "Over 2.5", "Yes"
  -- Legacy plain-text fallbacks
  event_name     text,
  selection      text,
  -- Core fields
  odds           numeric(6,3) NOT NULL,
  edge_pct       numeric(5,2),
  ev_pct         numeric(5,2),
  stake_pct      numeric(5,2),
  confidence     text CHECK (confidence IN ('high','medium','low')) DEFAULT 'medium',
  status         text NOT NULL
                   CHECK (status IN ('recommended','won','lost','push','void'))
                   DEFAULT 'recommended',
  profit_loss    numeric(8,3),
  recommended_at timestamptz NOT NULL DEFAULT now(),
  settled_at     timestamptz,
  notes          text
);

-- If table already exists, add missing columns:
-- ALTER TABLE betting_recommendations
--   ADD COLUMN IF NOT EXISTS sport text,
--   ADD COLUMN IF NOT EXISTS league text,
--   ADD COLUMN IF NOT EXISTS event_id text,
--   ADD COLUMN IF NOT EXISTS market_type text,
--   ADD COLUMN IF NOT EXISTS selection_name text;`}</pre>
        </div>
      )}

      {/* ── STAT CARDS ─────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
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
              <table style={{ width: "100%", minWidth: 700, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.itemBg }}>
                    <th style={thStyle}>Sport</th>
                    <th style={thStyle}>Match</th>
                    <th style={thStyle}>Bet type</th>
                    <th style={thStyle}>Odds</th>
                    <th style={thStyle}>Edge %</th>
                    <th style={thStyle}>EV %</th>
                    <th style={thStyle}>Stake %</th>
                    <th style={thStyle}>Confidence</th>
                    <th style={thStyle}>Rec&apos;d at</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map(rec => {
                    const p    = parsedRec(rec);
                    const conf = rec.confidence ?? "medium";
                    const cs   = CONF_STYLE[conf] ?? CONF_STYLE.medium;
                    return (
                      <tr key={rec.id} style={{ transition: "background 0.1s" }}>
                        <td style={tdStyle}>
                          <SportTag sport={p.sport} league={p.league} />
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 200 }}>
                          {p.matchLabel}
                        </td>
                        <td style={{ ...tdStyle, color: C.textSec }}>
                          {p.betType}
                        </td>
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
                        <td style={tdStyle}>
                          <Badge label={conf} color={cs.color} bg={cs.bg} />
                        </td>
                        <td style={{ ...tdMuted, whiteSpace: "nowrap" }}>
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
              <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.itemBg }}>
                    <th style={thStyle}>Sport</th>
                    <th style={thStyle}>Match</th>
                    <th style={thStyle}>Bet type</th>
                    <th style={thStyle}>Odds</th>
                    <th style={thStyle}>Outcome</th>
                    <th style={thStyle}>P / L</th>
                    <th style={thStyle}>Edge was</th>
                    <th style={thStyle}>Settled at</th>
                  </tr>
                </thead>
                <tbody>
                  {settled.map(rec => {
                    const p       = parsedRec(rec);
                    const os      = OUTCOME_STYLE[rec.status] ?? OUTCOME_STYLE.void;
                    const plColor = rec.profit_loss == null ? C.textSec
                      : rec.profit_loss > 0 ? "#34d399"
                      : rec.profit_loss < 0 ? "#f87171"
                      : C.textSec;
                    return (
                      <tr key={rec.id}>
                        <td style={tdStyle}>
                          <SportTag sport={p.sport} league={p.league} />
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 180 }}>
                          {p.matchLabel}
                        </td>
                        <td style={{ ...tdStyle, color: C.textSec }}>
                          {p.betType}
                        </td>
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
                        <td style={{ ...tdMuted, whiteSpace: "nowrap" }}>
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
