import type { ReactNode } from "react";
import "./globals.css";
import { AuthGate } from "../components/AuthGate";

export const metadata = {
  title: "Boban Dashboard",
  description: "Status dashboard for Boban agent",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const requiredPassword = process.env.DASHBOARD_PASSWORD || "change-me";

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <AuthGate requiredPassword={requiredPassword}>{children}</AuthGate>
      </body>
    </html>
  );
}
 
