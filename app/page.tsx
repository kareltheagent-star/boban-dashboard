"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "../components/AuthGate";
import { supabase } from "../lib/supabaseClient";

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
  status: "pending" | "in_progress" | "blocked" | "done";
  created_by?: string;
  tags?: string[];
  notes?: string;
  created_at: string;
}

export default function HomePage() {
  const [status, setStatus] = useState<AgentStatusRow | null>(null);
  const [events, setEvents] = useState<AgentEventRow[]>([]);
  const [activeBacklog, setActiveBacklog] = useState<BacklogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"24h" | "7d" | "30d" | "all">("24h");

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setError(
          "Supabase client not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        let since: string | null = null;
        const now = Date.now();
        if (dateRange === "24h") {
          since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
        } else if (dateRange === "7d") {
          since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (dateRange === "30d") {
          since = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
        }

        const [statusResult, eventsResult, inProgressResult, pendingResult] = await Promise.all([
          supabase
            .from("agent_status")
            .select("*")
            .order("ts", { ascending: false })
            .limit(1)
            .maybeSingle(),
          (since
            ? supabase
                .from("agent_events")
                .select("*")
                .gte("ts", since)
            : supabase.from("agent_events").select("*"))
            .order("ts", { ascending: false })
            .limit(50),
          supabase
            .from("agent_backlog")
            .select("*")
            .eq("status", "in_progress")
            .order("priority", { ascending: true })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("agent_backlog")
            .select("*")
            .eq("status", "pending")
            .order("priority", { ascending: true })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (statusResult.error) throw statusResult.error;
        if (eventsResult.error) throw eventsResult.error;
        if (inProgressResult.error) throw inProgressResult.error;
        if (pendingResult.error) throw pendingResult.error;

        setStatus(statusResult.data ?? null);
        setEvents(eventsResult.data ?? []);

        // Decide which backlog task is "active": prefer in_progress, otherwise the top pending one.
        const active = (inProgressResult.data as BacklogItem | null) ?? (pendingResult.data as BacklogItem | null) ?? null;
        setActiveBacklog(active);
      } catch (err: any) {
        console.error("[boban-dashboard] Failed to load status page", err);
        setError(err.message ?? "Failed to load status data");
      } finally {
        setLoading(false);
      }
    }

    load();

    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [dateRange]);

  const lastUpdated = status ? new Date(status.ts) : null;

  return (
    <AuthGate>
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Boban Status</h1>
              <p className="text-sm text-slate-400">
                Live view of what your agent is doing and how the Mac mini is feeling.
              </p>
            </div>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              {lastUpdated && (
                <p className="text-xs text-slate-500">
                  Last updated {lastUpdated.toLocaleString()}
                </p>
              )}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="date-range"
                  className="text-xs font-medium text-slate-400"
                >
                  Date range
                </label>
                <select
                  id="date-range"
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as "24h" | "7d" | "30d" | "all")}
                >
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
            </div>
          </header>

          {!supabase && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
              Supabase client is not configured. Set
              {" "}
              <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code>
              {" "}
              and
              {" "}
              <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
              {" "}
              in the environment.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
              {error}
            </div>
          )}

          {loading && (
            <section className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 animate-pulse"
                >
                  <div className="h-3 w-24 rounded bg-slate-800" />
                  <div className="mt-3 h-3 w-full rounded bg-slate-900" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-slate-900" />
                </div>
              ))}
            </section>
          )}

          {!loading && !error && status && (
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h2 className="text-sm font-medium text-slate-200">Current task</h2>
                <p className="mt-1 text-sm text-slate-100">
                  {activeBacklog?.title || status.current_task || "Idle"}
                </p>
                {activeBacklog && (
                  <p className="mt-2 text-xs text-slate-400">
                    Backlog: P{activeBacklog.priority} · {activeBacklog.status.replace("_", " ")}
                    {activeBacklog.created_by ? ` · ${activeBacklog.created_by}` : ""}
                  </p>
                )}
                {status.last_message && (
                  <p className="mt-2 text-xs text-slate-400">
                    Last message: {status.last_message}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h2 className="text-sm font-medium text-slate-200">Mac mini health</h2>
                <div className="mt-3 space-y-3 text-xs text-slate-300">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-200">RAM</span>
                      <span className="font-mono">
                        {status.mac_ram_pct != null
                          ? `${status.mac_ram_pct.toFixed(1)}%`
                          : "–"}
                      </span>
                    </div>
                    <div className="gauge-track">
                      <div
                        className={`gauge-fill ${
                          status.mac_ram_pct == null
                            ? ""
                            : status.mac_ram_pct < 70
                            ? "ok"
                            : status.mac_ram_pct < 90
                            ? "warn"
                            : "danger"
                        }`}
                        style={{ width: `${Math.min(Math.max(status.mac_ram_pct ?? 0, 0), 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-200">CPU</span>
                      <span className="font-mono">
                        {status.mac_cpu_pct != null
                          ? `${status.mac_cpu_pct.toFixed(1)}%`
                          : "–"}
                      </span>
                    </div>
                    <div className="gauge-track">
                      <div
                        className={`gauge-fill ${
                          status.mac_cpu_pct == null
                            ? ""
                            : status.mac_cpu_pct < 70
                            ? "ok"
                            : status.mac_cpu_pct < 90
                            ? "warn"
                            : "danger"
                        }`}
                        style={{ width: `${Math.min(Math.max(status.mac_cpu_pct ?? 0, 0), 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-200">Disk</span>
                      <span className="font-mono">
                        {status.mac_disk_pct != null
                          ? `${status.mac_disk_pct.toFixed(1)}%`
                          : "–"}
                      </span>
                    </div>
                    <div className="gauge-track">
                      <div
                        className={`gauge-fill ${
                          status.mac_disk_pct == null
                            ? ""
                            : status.mac_disk_pct < 80
                            ? "ok"
                            : status.mac_disk_pct < 95
                            ? "warn"
                            : "danger"
                        }`}
                        style={{ width: `${Math.min(Math.max(status.mac_disk_pct ?? 0, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h2 className="text-sm font-medium text-slate-200">Gateway & OAuth</h2>
                <p className="mt-3 text-sm">
                  <span
                    className={
                      status.gateway_running
                        ? "inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300"
                        : "inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300"
                    }
                  >
                    <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />
                    {status.gateway_running ? "Gateway running" : "Gateway stopped"}
                  </span>
                </p>
                <p className="mt-3 text-xs text-slate-300">
                  OAuth expires in
                  {" "}
                  <span className="font-mono">
                    {status.oauth_expires_days != null
                      ? `${status.oauth_expires_days.toFixed(1)} days`
                      : "–"}
                  </span>
                </p>
              </div>
            </section>
          )}

          {!loading && !error && !status && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
              No status rows found yet. Once the push script runs, latest
              status will show up here.
            </div>
          )}

          {!loading && !error && events.length > 0 && (
            <section className="mt-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="text-sm font-medium text-slate-200">Recent events</h2>
              <ul className="mt-3 space-y-2 text-xs text-slate-300">
                {events.map((evt) => (
                  <li
                    key={evt.id ?? `${evt.type}-${evt.ts}`}
                    className="flex flex-col gap-0.5 border-l border-slate-800 pl-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-slate-500">
                        {new Date(evt.ts).toLocaleString()}
                      </span>
                      <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                        {evt.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200">{evt.message}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </AuthGate>
  );
}
