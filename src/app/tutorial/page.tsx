import type { Metadata } from "next";
import { TutorialClient } from "@/components/tutorial/tutorial-client";

export const metadata: Metadata = {
  title: "第 0 关 · 序幕 · 灯序",
  description: "三个时刻、三间房、三个人：亲手走一遍提问、记笔记和交卷。",
};

export default function TutorialPage() {
  return <TutorialClient />;
}
