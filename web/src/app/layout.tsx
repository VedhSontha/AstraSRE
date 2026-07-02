import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentinelAI — Autonomous Chaos Engineering Platform",
  description: "AI-powered SRE agent: predicts failures, identifies root causes, and remediates automatically.",
  keywords: ["SRE", "chaos engineering", "AI", "Kubernetes", "SentinelAI", "observability"],
  openGraph: {
    title: "SentinelAI",
    description: "Autonomous chaos engineering and self-healing platform",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="noise antialiased">{children}</body>
    </html>
  );
}
