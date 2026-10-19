import type { Metadata } from "next";
import { CustomLevelClient } from "@/components/custom/custom-level-client";

export const metadata: Metadata = {
  title: "自定义关卡 · 灯序",
  description: "随机地图、自选案件与难度的练习关卡；同一组设置和种子总会排出同一局。",
};

export default function CustomLevelPage() {
  return <CustomLevelClient />;
}
