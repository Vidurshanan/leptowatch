import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeptoWatch",
  description:
    "Staging demonstration of Sri Lankan leptospirosis surveillance across 26 RDHS areas. Not approved for operational public-health use.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <body className="min-h-full bg-background font-sans text-foreground">{children}</body>
    </html>
  );
}
