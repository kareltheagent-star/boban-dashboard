import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthGate } from "../components/AuthGate";
import { NavSidebar } from "./NavSidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "Boban Dashboard",
  description: "Status dashboard for Boban agent",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body style={{ margin: 0, background: "#0d1526", color: "#dde9f8" }}>
        <AuthGate>
          <div style={{ display: "flex", minHeight: "100vh" }}>
            <NavSidebar />
            <main style={{ flex: 1, minWidth: 0 }}>
              {children}
            </main>
          </div>
        </AuthGate>
      </body>
    </html>
  );
}
