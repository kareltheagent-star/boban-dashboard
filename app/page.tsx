"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "../components/AuthGate";
import { supabase } from "../lib/supabaseClient";

interface AgentStatusRow {
  id?: number;
  timestamp: string;
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
  type: string;
  message: string;
  timestamp: string;
}

export default function HomePage() {
  const [status, setStatus] = useState<AgentStatusRow | null>(null);
  const [events, setEvents] = useState<AgentEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const [statusResult, eventsResult] = await Promise.all([
          supabase
            .from("agent_status")
            .select("*")
            .order("timestamp", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("agent_events")
            .select("*")
            .order("timestamp", { ascending: false })
            .limit(10),
        ]);

        if (statusResult.error) throw statusResult.error;
        if (eventsResult.error) throw eventsResult.error;

        setStatus(statusResult.data ?? null);
        setEvents(eventsResult.data ?? []);
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
  }, []);

  const lastUpdated = status ? new Date(status.timestamp) : null;

  return (
    <AuthGate>
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
          <header className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Boban Status</h1>
              <p className="text-sm text-slate-400">
                Live view of what your agent is doing and how the Mac mini is feeling.
              </p>
            </div>
            {lastUpdated && (
              <p className="text-xs text-slate-500">
                Last updated {lastUpdated.toLocaleString()}
              </p>
            )}
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
            <div className="text-sm text-slate-400">Loading status…</div>
          )}

          {!loading && !error && status && (
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h2 className="text-sm font-medium text-slate-200">Current task</h2>
                <p className="mt-1 text-sm text-slate-100">
                  {status.current_task || "Idle"}
                </p>
                {status.last_message && (
                  <p className="mt-2 text-xs text-slate-400">
                    Last message: {status.last_message}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h2 className="text-sm font-medium text-slate-200">Mac mini health</h2>
                <div className="mt-2 space-y-1 text-xs text-slate-300">
                  <p>
                    RAM:
                    {" "}
                    <span className="font-mono">
                      {status.mac_ram_pct != null
                        ? `${status.mac_ram_pct.toFixed(1)}%`
                        : "–"}
                    </span>
                  </p>
                  <p>
                    CPU:
                    {" "}
                    <span className="font-mono">
                      {status.mac_cpu_pct != null
                        ? `${status.mac_cpu_pct.toFixed(1)}%`
                        : "–"}
                    </span>
                  </p>
                  <p>
                    Disk:
                    {" "}
                    <span className="font-mono">
                      {status.mac_disk_pct != null
                        ? `${status.mac_disk_pct.toFixed(1)}%`
                        : "–"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h2 className="text-sm font-medium text-slate-200">Gateway & OAuth</h2>
                <p className="mt-2 text-sm">
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
                <p className="mt-2 text-xs text-slate-300">
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
                    key={evt.id ?? `${evt.type}-${evt.timestamp}`}
                    className="flex flex-col gap-0.5 border-l border-slate-800 pl-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-slate-500">
                        {new Date(evt.timestamp).toLocaleString()}
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
