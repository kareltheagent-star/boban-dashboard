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
  decimal_odds: number | null;   // preferred odds field
  profit_loss: number | null;
  recommended_at: string;
  settled_at: string | null;
  notes: string | null;
  // JSONB from the odds-API event (home_team, away_team, sport_key, …)
  source_candidate: Record<string, unknown> | null;
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

// sport_key league-suffix → short display label
const LEAGUE_SHORT: Record<string, string> = {
  epl:                  "EPL",
  premier_league:       "EPL",
  uefa_champs_league:   "UCL",
  champions_league:     "UCL",
  europa_league:        "UEL",
  conference_league:    "UECL",
  bundesliga:           "Bundesliga",
  la_liga:              "La Liga",
  la_liga2:             "La Liga 2",
  serie_a:              "Serie A",
  ligue_1:              "Ligue 1",
  eredivisie:           "Eredivisie",
  primeira_liga:        "Liga NOS",
  scotland_premiership: "Premiership",
  nba:                  "NBA",
  ncaab:                "NCAA",
  mlb:                  "MLB",
  nfl:                  "NFL",
  nhl:                  "NHL",
  mls:                  "MLS",
};

function capWords(s: string): string {
  return s.split(/[\s_-]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ── Parse sport_key like "soccer_epl" or "basketball_nba" ──────────────────
// Also handles The Odds API event_id format "soccer_epl:abc123hash"
function parseSportKey(raw: string | null | undefined): { sport: string; league: string } {
  if (!raw) return { sport: "", league: "" };

  // Strip any trailing ":eventHash" suffix
  const key = raw.split(":")[0].toLowerCase();

  // Determine sport by prefix, then derive league suffix
  const PREFIXES: [RegExp, string][] = [
    [/^soccer_/, "soccer"],
    [/^football_/, "soccer"],          // some APIs use football_ for soccer
    [/^americanfootball_/, "football"],
    [/^american_football_/, "football"],
    [/^basketball_/, "basketball"],
    [/^baseball_/, "baseball"],
    [/^icehockey_/, "hockey"],
    [/^ice_hockey_/, "hockey"],
    [/^tennis_/, "tennis"],
    [/^rugby_/, "rugby"],
  ];

  let sport = "";
  let leagueRaw = "";

  for (const [re, s] of PREFIXES) {
    if (re.test(key)) {
      sport = s;
      leagueRaw = key.replace(re, "");
      break;
    }
  }

  if (!sport) {
    // Generic: first segment is sport
    const idx = key.indexOf("_");
    sport    = idx > -1 ? key.slice(0, idx) : key;
    leagueRaw = idx > -1 ? key.slice(idx + 1) : "";
  }

  const league = LEAGUE_SHORT[leagueRaw]
    ?? (leagueRaw ? leagueRaw.toUpperCase().replace(/_/g, " ") : "");

  return { sport, league };
}

// ── Short team names used in Czech bet labels ───────────────────────────────
const TEAM_SHORT: Record<string, string> = {
  "west ham united":         "West Ham",
  "manchester city":         "Man City",
  "manchester united":       "Man Utd",
  "tottenham hotspur":       "Spurs",
  "newcastle united":        "Newcastle",
  "wolverhampton wanderers": "Wolves",
  "sheffield united":        "Sheffield Utd",
  "nottingham forest":       "Nott'm Forest",
  "brighton & hove albion":  "Brighton",
  "los angeles lakers":      "Lakers",
  "boston celtics":          "Celtics",
  "golden state warriors":   "Warriors",
  "milwaukee bucks":         "Bucks",
};

function shortTeam(name: string): string {
  return TEAM_SHORT[name.toLowerCase()] ?? name;
}

// ── Czech bet type labels ───────────────────────────────────────────────────
function betTypeCZ(marketType: string | null, selectionName: string | null): string {
  const sel    = (selectionName ?? "").trim();
  const selLow = sel.toLowerCase();
  const isDraw = selLow === "draw" || selLow === "x" || selLow === "remíza";

  switch ((marketType ?? "").toLowerCase()) {
    case "h2h":
    case "moneyline":
    case "three_way_moneyline": {
      if (isDraw) return "Remíza";
      if (sel)    return `${shortTeam(sel)} výhra`;
      return "Výhra";
    }
    case "three_way_draw":
      return "Remíza";
    case "totals":
    case "over_under": {
      const m = sel.match(/^(over|under)\s*([\d.]+)/i);
      if (m) {
        const dir = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
        return `${dir} ${m[2]} gólů`;
      }
      return sel || "Over/Under";
    }
    case "btts":
    case "both_teams_score": {
      if (selLow === "yes" || selLow === "ano") return "Oba dají gól";
      if (selLow === "no"  || selLow === "ne")  return "Oba nedají gól";
      return "Oba dají gól";
    }
    case "spreads":
    case "handicap":
      return sel ? `Handicap ${sel}` : "Handicap";
    case "draw_no_bet":
      return sel ? `DNB: ${shortTeam(sel)}` : "Draw No Bet";
    case "first_goalscorer":
      return sel ? `1. gól: ${sel}` : "První gól";
    default:
      return sel || (marketType ? capWords(marketType) : "—");
  }
}

// ── source_candidate JSONB shape ────────────────────────────────────────────
interface SourceCandidate {
  home_team?: string;
  away_team?: string;
  sport_key?: string;   // "soccer_epl", "basketball_nba"
  sport_title?: string; // human title from the odds API
  commence_time?: string;
}

// ── Resolve all display fields from one rec ─────────────────────────────────
interface ParsedRec {
  sport: string;
  league: string;
  matchLabel: string;
  betType: string;
}

function parsedRec(rec: BettingRec): ParsedRec {
  const sc = rec.source_candidate as SourceCandidate | null | undefined;

  // Sport + league: source_candidate.sport_key is the most reliable source
  let sport  = rec.sport  ?? "";
  let league = rec.league ?? "";

  if (!sport || !league) {
    // Try sport_key from source_candidate first, then fall back to event_id prefix
    const raw = sc?.sport_key ?? rec.event_id ?? "";
    const fromKey = parseSportKey(raw);
    if (!sport)  sport  = fromKey.sport;
    if (!league) league = fromKey.league || (sc?.sport_title ?? "");
  }

  // Match label: source_candidate teams are authoritative
  let matchLabel = "";
  if (sc?.home_team && sc?.away_team) {
    matchLabel = `${sc.home_team} vs ${sc.away_team}`;
  } else if (rec.event_id) {
    // Strip hash suffix and humanise: "soccer_epl:abc123" → "Soccer Epl"
    const stripped = rec.event_id.split(":")[0];
    matchLabel = capWords(stripped.replace(/_/g, " "));
  }
  if (!matchLabel) matchLabel = rec.event_name ?? "—";

  // Bet type (Czech)
  const betType = (rec.market_type || rec.selection_name)
    ? betTypeCZ(rec.market_type, rec.selection_name)
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

        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "clip" }}>
          {active.length === 0 ? (
            <p style={{ margin: 0, padding: "18px 16px", fontSize: 13, color: C.textMuted }}>
              No active recommendations right now.
            </p>
          ) : (
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: 700, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.itemBg }}>
                    <th style={{ ...thStyle, position: "sticky", left: 0, background: C.itemBg, zIndex: 2, boxShadow: "2px 0 6px rgba(0,0,0,0.25)" }}>Sport</th>
                    <th style={{ ...thStyle, position: "sticky", left: 74, background: C.itemBg, zIndex: 2, boxShadow: "2px 0 6px rgba(0,0,0,0.15)" }}>Match</th>
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
                        <td style={{ ...tdStyle, position: "sticky", left: 0, background: C.cardBg, zIndex: 1, boxShadow: "2px 0 6px rgba(0,0,0,0.25)" }}>
                          <SportTag sport={p.sport} league={p.league} />
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 200, position: "sticky", left: 74, background: C.cardBg, zIndex: 1, boxShadow: "2px 0 6px rgba(0,0,0,0.15)" }}>
                          {p.matchLabel}
                        </td>
                        <td style={{ ...tdStyle, color: C.textSec }}>
                          {p.betType}
                        </td>
                        <td style={tdMuted}>{fmtOdds(rec.decimal_odds ?? rec.odds)}</td>
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

        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "clip" }}>
          {settled.length === 0 ? (
            <p style={{ margin: 0, padding: "18px 16px", fontSize: 13, color: C.textMuted }}>
              No settled bets yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.itemBg }}>
                    <th style={{ ...thStyle, position: "sticky", left: 0, background: C.itemBg, zIndex: 2, boxShadow: "2px 0 6px rgba(0,0,0,0.25)" }}>Sport</th>
                    <th style={{ ...thStyle, position: "sticky", left: 74, background: C.itemBg, zIndex: 2, boxShadow: "2px 0 6px rgba(0,0,0,0.15)" }}>Match</th>
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
                        <td style={{ ...tdStyle, position: "sticky", left: 0, background: C.cardBg, zIndex: 1, boxShadow: "2px 0 6px rgba(0,0,0,0.25)" }}>
                          <SportTag sport={p.sport} league={p.league} />
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 180, position: "sticky", left: 74, background: C.cardBg, zIndex: 1, boxShadow: "2px 0 6px rgba(0,0,0,0.15)" }}>
                          {p.matchLabel}
                        </td>
                        <td style={{ ...tdStyle, color: C.textSec }}>
                          {p.betType}
                        </td>
                        <td style={tdMuted}>{fmtOdds(rec.decimal_odds ?? rec.odds)}</td>
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
