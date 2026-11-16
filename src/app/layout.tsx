import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CoolCommons AI — Urban Heat Resilience Planner for Karachi",
  description:
    "Turning climate data into cooler, safer communities. Explainable heat-exposure analysis, community facility mapping, intervention simulation and AI-assisted adaptation planning for Karachi.",
  openGraph: { title: "CoolCommons AI", description: "Turning climate data into cooler, safer communities.", images: ["/cover.png"] },
};

export const viewport: Viewport = { themeColor: "#06101d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
