import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GapCheck — Find the gaps before recruiters do.",
  description: "GapCheck analyzes your resume, GitHub projects, and target job requirements to reveal evidence gaps — and provides an actionable roadmap before technical interviews.",
  keywords: ["placement readiness", "gap check", "resume analyzer", "github analyzer", "skill verification", "proof of skill"],
};

import CrystalGlassEffect from "@/components/CrystalGlassEffect";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className} data-scroll-behavior="smooth">
      <body className="antialiased">
        <CrystalGlassEffect />
        {children}
      </body>
    </html>
  );
}
