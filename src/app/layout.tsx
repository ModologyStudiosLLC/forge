import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forge — AI Hardware Studio",
  description: "Sketch it, shoot it, or say it. Ship the part.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {children}
      </body>
    </html>
  );
}
