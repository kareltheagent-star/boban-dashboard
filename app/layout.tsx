import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Boban Dashboard",
  description: "Status dashboard for Boban agent",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
