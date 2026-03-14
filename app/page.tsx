"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import type { CSSProperties } from "react";
import { AuthGate } from "../components/AuthGate";
import { supabase } from "../lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────
type BacklogStatus = "pending" | "in_progress" | "blocked" | "done";
type LearningStatus = "pending" | "in_progress" | "done" | "blocked";

interface AgentStatusRow {
  id?: number;
  ts: string;
  current_task: string | null;
  mac_ram_pct: number | null;
  mac_cpu_pct: number | null;
  mac_disk_pct: number | null;
  gateway_running: boolean | null;
  oauth_expires_days: number | null;
  last_message: string | null;
}

interface AgentEventRow {
  id?: number;
  ts: string;
  type: string;
  message: string;
}

interface BacklogItem {
  id: string;
  title: string;
  description?: string;
  priority: number;
  status: BacklogStatus;
  created_by?: string;
  tags?: string[];
  notes?: string;
  created_at: string;
}

interface LearningItem {
  id: number;
  topic: string;
  why: string | null;
  priority: number;
  status: LearningStatus;
  notes: string | null;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const KANBAN_COLUMNS: { key: BacklogStatus; label: string; dot: string }[] = [
  { key: "pending",     label: "Pending",     dot: "#94a3b8" },
  { key: "in_progress", label: "In Progress", dot: "#60a5fa" },
  { key: "blocked",     label: "Blocked",     dot: "#f87171" },
  { key: "done",        label: "Done",        dot: "#34d399" },
];

const PRIORITY_BADGE: Record<number, CSSProperties> = {
  1: { background: "rgba(239,68,68,0.2)",   color: "#fca5a5", outline: "1px solid rgba(239,68,68,0.4)" },
  2: { background: "rgba(249,115,22,0.2)",  color: "#fdba74", outline: "1px solid rgba(249,115,22,0.4)" },
  3: { background: "rgba(234,179,8,0.2)",   color: "#fde047", outline: "1px solid rgba(234,179,8,0.4)" },
  4: { background: "rgba(59,130,246,0.2)",  color: "#93c5fd", outline: "1px solid rgba(59,130,246,0.4)" },
  5: { background: "rgba(100,116,139,0.2)", color: "#94a3b8", outline: "1px solid rgba(100,116,139,0.4)" },
};

const BLANK_TASK: { title: string; description: string; priority: number; status: BacklogStatus; tags: string; notes: string } = {
  title: "", description: "", priority: 3, status: "pending", tags: "", notes: "",
};

const BLANK_LEARN: { topic: string; why: string; priority: number; status: LearningStatus; notes: string } = {
  topic: "", why: "", priority: 3, status: "pending", notes: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fixText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/Â·/g, "·")
    .replace(/â€"/g, "\u2014")
    .replace(/â€¦/g, "\u2026")
    .replace(/â€œ/g, "\u201C")
    .replace(/â€\u009D/g, "\u201D")
    .replace(/â€˜/g, "\u2018")
    .replace(/â€™/g, "\u2019");
}

function gaugeClass(val: number | null, warnAt: number, dangerAt: number): string {
  if (val == null) return "";
  if (val < warnAt) return "ok";
  if (val < dangerAt) return "warn";
  return "danger";
}

// ── Shared style objects ───────────────────────────────────────────────────
const card: CSSProperties = {
  background: "rgba(15,23,42,0.7)",
  border: "1px solid #1e293b",
  borderRadius: 10,
  padding: 14,
};

const labelSt: CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#475569",
  marginBottom: 4,
};

const btnPrimary: CSSProperties = {
  background: "#6366f1",
  color: "#fff",
  border: "none",
  padding: "7px 14px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.04em",
};

const btnGhost: CSSProperties = {
  background: "transparent",
  color: "#64748b",
  border: "1px solid #1e293b",
  padding: "7px 14px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
};

const btnDanger: CSSProperties = {
  background: "transparent",
  color: "#f87171",
  border: "1px solid #1e293b",
  padding: "6px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 11,
};

// ── MetricCard ─────────────────────────────────────────────────────────────
function MetricCard({
  label, value, gaugeVal, warnAt, dangerAt, loading, warn,
}: {
  label: string;
  value: string;
  gaugeVal: number | null;
  warnAt: number;
  dangerAt: number;
  loading: boolean;
  warn?: boolean;
}) {
  const cls = gaugeClass(gaugeVal, warnAt, dangerAt);
  return (
    <div style={card}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>
        {label}
      </div>
      {loading ? (
        <div style={{ height: 24, borderRadius: 4, background: "#1e293b", marginBottom: 6 }} />
      ) : (
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            color: warn ? "#f87171" : "#f1f5f9",
            marginBottom: 8,
            lineHeight: 1,
          }}
        >
          {value}
        </div>
      )}
      <div className="gauge-track">
        <div
          className={`gauge-fill ${cls}`}
          style={{ width: `${Math.min(Math.max(gaugeVal ?? 0, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function HomePage() {
  const [agentStatus, setAgentStatus] = useState<AgentStatusRow | null>(null);
  const [events, setEvents] = useState<AgentEventRow[]>([]);
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([]);
  const [learningItems, setLearningItems] = useState<LearningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Kanban state
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<BacklogStatus | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editTask, setEditTask] = useState<BacklogItem | null>(null);
  const [taskForm, setTaskForm] = useState(BLANK_TASK);
  const [savingTask, setSavingTask] = useState(false);

  // Learning state
  const [learningExpanded, setLearningExpanded] = useState(false);
  const [showAddLearn, setShowAddLearn] = useState(false);
  const [learnForm, setLearnForm] = useState(BLANK_LEARN);
  const [savingLearn, setSavingLearn] = useState(false);
  const [learnError, setLearnError] = useState<string | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!supabase) {
      setError("Supabase not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const [statusRes, eventsRes, backlogRes, learnRes] = await Promise.all([
        supabase.from("agent_status").select("*").order("ts", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("agent_events").select("*").order("ts", { ascending: false }).limit(5),
        supabase.from("agent_backlog").select("*").order("priority", { ascending: true }).order("created_at", { ascending: false }),
        supabase.from("agent_learning_backlog").select("*").order("priority", { ascending: true }).order("created_at", { ascending: false }),
      ]);
      if (statusRes.error) throw statusRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (backlogRes.error) throw backlogRes.error;
      if (learnRes.error) throw learnRes.error;

      setAgentStatus(statusRes.data ?? null);
      setEvents(eventsRes.data ?? []);
      setBacklogItems(backlogRes.data ?? []);
      setLearningItems(learnRes.data ?? []);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  // ── Kanban handlers ───────────────────────────────────────────────────────
  const byStatus = (s: BacklogStatus) =>
    backlogItems.filter(i => i.status === s).sort((a, b) => a.priority - b.priority);

  const handleDrop = async (col: BacklogStatus) => {
    if (!dragging || !supabase) return;
    setDragOver(null);
    const item = backlogItems.find(i => i.id === dragging);
    if (!item || item.status === col) { setDragging(null); return; }
    setBacklogItems(prev => prev.map(i => i.id === dragging ? { ...i, status: col } : i));
    await supabase.from("agent_backlog").update({ status: col }).eq("id", dragging);
    setDragging(null);
  };

  const openEditTask = (item: BacklogItem) => {
    setEditTask(item);
    setTaskForm({
      title: item.title,
      description: item.description ?? "",
      priority: item.priority,
      status: item.status,
      tags: (item.tags ?? []).join(", "),
      notes: item.notes ?? "",
    });
    setShowTaskForm(true);
  };

  const handleSaveTask = async () => {
    if (!taskForm.title.trim() || !supabase) return;
    setSavingTask(true);
    const payload = {
      title: taskForm.title,
      description: taskForm.description,
      priority: taskForm.priority,
      status: taskForm.status,
      tags: taskForm.tags.split(",").map(t => t.trim()).filter(Boolean),
      notes: taskForm.notes,
    };
    if (editTask) {
      await supabase.from("agent_backlog").update(payload).eq("id", editTask.id);
      setBacklogItems(prev => prev.map(i => i.id === editTask.id ? { ...i, ...payload } : i));
    } else {
      const { data } = await supabase.from("agent_backlog").insert({ ...payload, created_by: "human" }).select().single();
      if (data) setBacklogItems(prev => [...prev, data]);
    }
    setSavingTask(false);
    setShowTaskForm(false);
    setEditTask(null);
    setTaskForm(BLANK_TASK);
  };

  const handleDeleteTask = async (id: string) => {
    if (!supabase) return;
    await supabase.from("agent_backlog").delete().eq("id", id);
    setBacklogItems(prev => prev.filter(i => i.id !== id));
    setShowTaskForm(false);
    setEditTask(null);
  };

  // ── Learning handlers ─────────────────────────────────────────────────────
  const handleAddLearn = async (e: FormEvent) => {
    e.preventDefault();
    setLearnError(null);
    if (!supabase) { setLearnError("Supabase not configured."); return; }
    if (!learnForm.topic.trim()) { setLearnError("Topic is required."); return; }
    setSavingLearn(true);
    try {
      const { data, error: err } = await supabase
        .from("agent_learning_backlog")
        .insert({
          topic: learnForm.topic.trim(),
          why: learnForm.why.trim() || null,
          priority: learnForm.priority,
          status: learnForm.status,
          notes: learnForm.notes.trim() || null,
        })
        .select().single();
      if (err) { setLearnError(err.message); }
      else if (data) {
        setLearningItems(prev =>
          [...prev, data].sort((a, b) =>
            a.priority !== b.priority
              ? a.priority - b.priority
              : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        );
        setLearnForm(BLANK_LEARN);
        setShowAddLearn(false);
      }
    } catch (err: unknown) {
      setLearnError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingLearn(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const activeTask =
    backlogItems.find(i => i.status === "in_progress") ??
    backlogItems.find(i => i.status === "pending") ??
    null;

  const pendingLearn = learningItems.filter(i => i.status !== "done").length;
  const doneLearn = learningItems.filter(i => i.status === "done").length;
  const oauthWarn =
    agentStatus?.oauth_expires_days != null && agentStatus.oauth_expires_days < 3;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AuthGate>
      <div style={{ minHeight: "100vh", background: "#020617", color: "#f1f5f9", fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)" }}>

        {/* OAuth expiry warning banner */}
        {oauthWarn && (
          <div style={{
            background: "rgba(239,68,68,0.12)",
            borderBottom: "1px solid rgba(239,68,68,0.35)",
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span style={{ color: "#fca5a5", fontSize: 13, fontWeight: 500 }}>
              ⚠️ OAuth token expires in {agentStatus!.oauth_expires_days!.toFixed(1)} days — renew now!
            </span>
          </div>
        )}

        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── HEADER ─────────────────────────────────────────────────────── */}
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", color: "#f1f5f9" }}>
              Boban 🤖
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {agentStatus && (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 999,
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  background: agentStatus.gateway_running
                    ? "rgba(16,185,129,0.12)"
                    : "rgba(239,68,68,0.12)",
                  color: agentStatus.gateway_running ? "#6ee7b7" : "#fca5a5",
                  border: `1px solid ${agentStatus.gateway_running ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
                  {agentStatus.gateway_running ? "Gateway running" : "Gateway stopped"}
                </span>
              )}
              {lastUpdated && (
                <span style={{ fontSize: 11, color: "#334155", fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>
                  {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </header>

          {/* Supabase / general errors */}
          {!supabase && (
            <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#fcd34d" }}>
              Supabase client not configured. Set{" "}
              <code style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
            </div>
          )}
          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#fca5a5" }}>
              {error}
            </div>
          )}

          {/* ── METRICS ROW ────────────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <MetricCard label="RAM" value={agentStatus?.mac_ram_pct != null ? `${agentStatus.mac_ram_pct.toFixed(1)}%` : "—"} gaugeVal={agentStatus?.mac_ram_pct ?? null} warnAt={70} dangerAt={90} loading={loading} />
            <MetricCard label="CPU" value={agentStatus?.mac_cpu_pct != null ? `${agentStatus.mac_cpu_pct.toFixed(1)}%` : "—"} gaugeVal={agentStatus?.mac_cpu_pct ?? null} warnAt={70} dangerAt={90} loading={loading} />
            <MetricCard label="Disk" value={agentStatus?.mac_disk_pct != null ? `${agentStatus.mac_disk_pct.toFixed(1)}%` : "—"} gaugeVal={agentStatus?.mac_disk_pct ?? null} warnAt={80} dangerAt={95} loading={loading} />
            {/* OAuth card */}
            <div style={card}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>OAuth</div>
              {loading ? (
                <div style={{ height: 24, borderRadius: 4, background: "#1e293b", marginBottom: 8 }} />
              ) : (
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", color: oauthWarn ? "#f87171" : "#f1f5f9", marginBottom: 8, lineHeight: 1 }}>
                  {agentStatus?.oauth_expires_days != null ? `${agentStatus.oauth_expires_days.toFixed(1)}d` : "—"}
                </div>
              )}
              <div style={{ fontSize: 10, color: "#334155" }}>days until expiry</div>
            </div>
          </div>

          {/* ── TWO COLUMN SECTION ──────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, alignItems: "start" }}>

            {/* LEFT: Kanban board */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#475569" }}>
                  Backlog · {backlogItems.length} tasks
                </span>
                <button
                  style={btnPrimary}
                  onClick={() => { setEditTask(null); setTaskForm(BLANK_TASK); setShowTaskForm(true); }}
                >
                  + New Task
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {KANBAN_COLUMNS.map(col => {
                  const colItems = byStatus(col.key);
                  const isOver = dragOver === col.key;
                  return (
                    <div
                      key={col.key}
                      onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={() => handleDrop(col.key)}
                      style={{
                        background: isOver ? "rgba(99,102,241,0.06)" : "#080f1f",
                        border: `1px solid ${isOver ? "rgba(99,102,241,0.4)" : "#1a2540"}`,
                        borderRadius: 8,
                        padding: 10,
                        minHeight: 120,
                        transition: "all 0.12s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: col.dot, display: "inline-block", flexShrink: 0 }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          {col.label}
                        </span>
                        <span style={{ marginLeft: "auto", fontSize: 10, color: "#334155", background: "#111827", borderRadius: 6, padding: "1px 6px" }}>
                          {colItems.length}
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {colItems.length === 0 && (
                          <div style={{ textAlign: "center", padding: "14px 0", color: "#1e293b", fontSize: 11 }}>
                            drop here
                          </div>
                        )}
                        {colItems.map(item => (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={() => setDragging(item.id)}
                            onDragEnd={() => { setDragging(null); setDragOver(null); }}
                            onClick={() => openEditTask(item)}
                            style={{
                              background: dragging === item.id ? "#1e293b" : "#0f172a",
                              border: "1px solid #1a2540",
                              borderRadius: 6,
                              padding: "8px 10px",
                              opacity: dragging === item.id ? 0.45 : 1,
                              cursor: "grab",
                              transition: "all 0.12s",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 5, marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 500, color: "#e2e8f0", lineHeight: 1.4, flex: 1 }}>
                                {fixText(item.title)}
                              </span>
                              <span style={{ fontSize: 9, fontWeight: 600, borderRadius: 3, padding: "2px 5px", flexShrink: 0, ...(PRIORITY_BADGE[item.priority] ?? PRIORITY_BADGE[5]) }}>
                                P{item.priority}
                              </span>
                            </div>
                            {item.description && (
                              <p style={{ margin: "0 0 5px", fontSize: 10, color: "#334155", lineHeight: 1.5 }}>
                                {fixText(item.description).slice(0, 65)}{item.description.length > 65 ? "…" : ""}
                              </p>
                            )}
                            {item.tags && item.tags.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                                {item.tags.map(tag => (
                                  <span key={tag} style={{ fontSize: 9, color: "#818cf8", background: "rgba(99,102,241,0.1)", borderRadius: 3, padding: "1px 5px", border: "1px solid rgba(99,102,241,0.2)" }}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Current task + Events */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Current task card */}
              <div style={card}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: 10 }}>
                  Current Task
                </div>
                {loading ? (
                  <div style={{ height: 52, borderRadius: 6, background: "#1e293b" }} />
                ) : (
                  <>
                    <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 500, color: "#f1f5f9", lineHeight: 1.55 }}>
                      {fixText(activeTask?.title || agentStatus?.current_task || "Idle")}
                    </p>
                    {activeTask && (
                      <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>
                        P{activeTask.priority} · {activeTask.status.replace("_", " ")}
                        {activeTask.created_by ? ` · ${activeTask.created_by}` : ""}
                      </p>
                    )}
                    {agentStatus?.last_message && (
                      <p style={{ margin: "6px 0 0", fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
                        {fixText(agentStatus.last_message)}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Last 5 events */}
              <div style={card}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: 10 }}>
                  Recent Events
                </div>
                {loading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ height: 28, borderRadius: 4, background: "#1e293b" }} />
                    ))}
                  </div>
                ) : events.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#334155", margin: 0 }}>No recent events.</p>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
                    {events.map(evt => (
                      <li
                        key={evt.id ?? `${evt.type}-${evt.ts}`}
                        style={{ borderLeft: "2px solid #1a2540", paddingLeft: 10, display: "flex", flexDirection: "column", gap: 2 }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 10, color: "#334155", fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>
                            {new Date(evt.ts).toLocaleString()}
                          </span>
                          <span style={{ fontSize: 9, background: "#111827", color: "#64748b", borderRadius: 4, padding: "1px 6px", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
                            {evt.type}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.45 }}>
                          {fixText(evt.message)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* ── LEARNING SECTION ─────────────────────────────────────────────── */}
          <div style={{ border: "1px solid #1a2540", borderRadius: 10, overflow: "hidden" }}>
            <button
              onClick={() => setLearningExpanded(v => !v)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#475569" }}>
                  Learning Backlog
                </span>
                <span style={{ fontSize: 11, color: "#334155", background: "#111827", borderRadius: 6, padding: "2px 8px" }}>
                  {pendingLearn} pending · {doneLearn} done
                </span>
              </div>
              <span style={{ fontSize: 11, color: "#334155", transform: learningExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>
                ▼
              </span>
            </button>

            {learningExpanded && (
              <div style={{ borderTop: "1px solid #1a2540", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <button
                    onClick={() => { setShowAddLearn(v => !v); setLearnError(null); }}
                    style={showAddLearn ? { ...btnGhost, color: "#e2e8f0", borderColor: "#334155" } : btnGhost}
                  >
                    {showAddLearn ? "Cancel" : "+ Add topic"}
                  </button>
                </div>

                {showAddLearn && (
                  <form
                    onSubmit={handleAddLearn}
                    style={{ background: "#080f1f", border: "1px solid #1a2540", borderRadius: 8, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={labelSt}>Topic *</label>
                        <input className="input-dark" placeholder="e.g. Supabase RLS" value={learnForm.topic} onChange={e => setLearnForm(f => ({ ...f, topic: e.target.value }))} />
                      </div>
                      <div>
                        <label style={labelSt}>Priority (1 = highest)</label>
                        <input type="number" min={1} max={9} className="input-dark" value={learnForm.priority} onChange={e => setLearnForm(f => ({ ...f, priority: Number(e.target.value) || 3 }))} />
                      </div>
                    </div>
                    <div>
                      <label style={labelSt}>Why this matters</label>
                      <textarea className="input-dark" placeholder="Context, project, or risk..." value={learnForm.why} onChange={e => setLearnForm(f => ({ ...f, why: e.target.value }))} style={{ minHeight: 60, resize: "vertical" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={labelSt}>Status</label>
                        <select className="input-dark" value={learnForm.status} onChange={e => setLearnForm(f => ({ ...f, status: e.target.value as LearningStatus }))}>
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelSt}>Notes</label>
                        <textarea className="input-dark" placeholder="Links, repos, constraints..." value={learnForm.notes} onChange={e => setLearnForm(f => ({ ...f, notes: e.target.value }))} style={{ minHeight: 60, resize: "vertical" }} />
                      </div>
                    </div>
                    {learnError && <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{learnError}</p>}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button type="submit" disabled={savingLearn} style={btnPrimary}>
                        {savingLearn ? "Saving…" : "Add topic"}
                      </button>
                    </div>
                  </form>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {learningItems.length === 0 && (
                    <p style={{ fontSize: 13, color: "#334155", margin: 0 }}>No learning items yet.</p>
                  )}
                  {learningItems.map(item => {
                    const isDone = item.status === "done";
                    const statusColor =
                      isDone ? "#34d399" :
                      item.status === "in_progress" ? "#60a5fa" :
                      item.status === "blocked" ? "#f87171" :
                      "#64748b";
                    const statusBg =
                      isDone ? "rgba(52,211,153,0.1)" :
                      item.status === "in_progress" ? "rgba(96,165,250,0.1)" :
                      item.status === "blocked" ? "rgba(248,113,113,0.1)" :
                      "rgba(100,116,139,0.1)";
                    return (
                      <div key={item.id} style={{ background: "#080f1f", border: "1px solid #1a2540", borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: isDone ? "#334155" : "#e2e8f0", textDecoration: isDone ? "line-through" : "none", flex: 1 }}>
                            {fixText(item.topic)}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            <span style={{ fontSize: 10, color: "#334155" }}>P{item.priority}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, borderRadius: 4, padding: "2px 7px", background: statusBg, color: statusColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              {item.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                        {item.why && (
                          <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{fixText(item.why)}</p>
                        )}
                        {item.notes && (
                          <p style={{ margin: 0, fontSize: 11, color: "#334155", whiteSpace: "pre-wrap" }}>{fixText(item.notes)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── Task modal ──────────────────────────────────────────────────── */}
        {showTaskForm && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={e => { if (e.target === e.currentTarget) { setShowTaskForm(false); setEditTask(null); } }}
          >
            <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 12, padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>
                  {editTask ? "Edit Task" : "New Task"}
                </h2>
                <button style={{ ...btnGhost, padding: "4px 10px" }} onClick={() => { setShowTaskForm(false); setEditTask(null); }}>✕</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={labelSt}>Title *</label>
                  <input className="input-dark" placeholder="Task title" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelSt}>Priority</label>
                    <select className="input-dark" value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: +e.target.value }))}>
                      {[1, 2, 3, 4, 5].map(p => (
                        <option key={p} value={p}>P{p} {p === 1 ? "(highest)" : p === 5 ? "(lowest)" : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelSt}>Status</label>
                    <select className="input-dark" value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value as BacklogStatus }))}>
                      {KANBAN_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelSt}>Description</label>
                  <textarea className="input-dark" placeholder="Details, acceptance criteria…" value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: 80, resize: "vertical" }} />
                </div>
                <div>
                  <label style={labelSt}>Tags</label>
                  <input className="input-dark" placeholder="infra, dashboard, api" value={taskForm.tags} onChange={e => setTaskForm(f => ({ ...f, tags: e.target.value }))} />
                </div>
                <div>
                  <label style={labelSt}>Notes</label>
                  <textarea className="input-dark" placeholder="Additional notes…" value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))} style={{ minHeight: 60, resize: "vertical" }} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
                <div>
                  {editTask && (
                    <button style={btnDanger} onClick={() => handleDeleteTask(editTask.id)}>Delete</button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={btnGhost} onClick={() => { setShowTaskForm(false); setEditTask(null); }}>Cancel</button>
                  <button style={btnPrimary} onClick={handleSaveTask} disabled={savingTask}>
                    {savingTask ? "Saving…" : editTask ? "Save changes" : "Add task"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </AuthGate>
  );
}
