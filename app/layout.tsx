import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClockNet",
  description: "Network-based attendance MVP"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
