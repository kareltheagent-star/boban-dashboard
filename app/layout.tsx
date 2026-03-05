"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Boban Dashboard",
  description: "Status dashboard for Boban agent",
};

const STORAGE_KEY = "boban-dashboard-auth";

function AuthGate({ children }: { children: ReactNode }) {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requiredPassword =
    process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD || "change-me";

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    if (stored && stored === requiredPassword) {
      setAuthed(true);
    } else {
      setAuthed(false);
    }
  }, [requiredPassword]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === requiredPassword) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, requiredPassword);
      }
      setAuthed(true);
      setError(null);
    } else {
      setError("Invalid password");
    }
  };

  if (authed === null) {
    return null;
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-xs space-y-4 rounded-lg border border-slate-800 bg-slate-900/80 p-6 shadow-lg"
       >
          <h1 className="text-lg font-semibold">Boban Dashboard</h1>
          <p className="text-sm text-slate-400">
            Enter dashboard password to continue.
          </p>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Unlock
          </button>
          <p className="text-[11px] text-slate-500">
            Set <code className="font-mono">NEXT_PUBLIC_DASHBOARD_PASSWORD</code> in the
            environment for real protection.
          </p>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
