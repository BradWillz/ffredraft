import type { Metadata } from "next";
import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: {
    default: "Fourth & Forever Fantasy Football",
    template: "%s | Fourth & Forever",
  },
  description: "League history, records, rivalries, and weekly fantasy football glory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sourceSans.variable} ${barlowCondensed.variable} antialiased`}
      >
        <SiteHeader />
        <div className="site-content">{children}</div>
      </body>
    </html>
  );
}
