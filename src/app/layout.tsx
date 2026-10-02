import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans, Noto_Serif_SC } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const serifSC = Noto_Serif_SC({
  weight: ["500", "700", "900"],
  variable: "--font-serif-sc",
  display: "swap",
  preload: false,
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "灯序 · 时间推理",
  description: "六时、六地、六人。绿窗共享，白窗独见。房间码开局。",
};

export const viewport: Viewport = {
  themeColor: "#121a17",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${fraunces.variable} ${serifSC.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="grain">{children}</body>
    </html>
  );
}
