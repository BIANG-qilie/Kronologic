import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "灯序 · 时间推理",
  description: "六时、六地、六人。绿窗共享，白窗独见。房间码开局。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
