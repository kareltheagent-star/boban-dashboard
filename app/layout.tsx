import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Boban Dashboard",
  description: "Status dashboard for Boban agent",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex">
        <aside className="w-56 border-r border-slate-800 px-4 py-4 flex flex-col gap-4">
          <div className="font-mono text-sm text-slate-400">Boban Ops</div>
          <nav className="space-y-2 text-sm">
            <div>
              <Link href="/" className="hover:text-sky-400">Status</Link>
            </div>
            <div>
              <Link href="/backlog" className="hover:text-sky-400">Backlog</Link>
            </div>
            <div>
              <Link href="/learning" className="hover:text-sky-400">Learning</Link>
            </div>
          </nav>
        </aside>
        <main className="flex-1 px-4 py-4 max-w-5xl mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}

