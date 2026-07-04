import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Design Diplomat",
  description: "Cross-platform iOS/Android sync console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
