import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClockNet",
  description: "Network-based attendance MVP"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
