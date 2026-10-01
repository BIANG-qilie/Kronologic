import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "灯序 · 线上时间推理",
  description:
    "非商业原创调查：六时六地六人，绿窗共享、白窗独见。房间码开局，无需账号。",
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
