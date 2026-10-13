import type { Metadata } from "next";
import { MapLabClient } from "@/components/game/map-lab-client";

export const metadata: Metadata = {
  title: "随机地图实验室 · 灯序",
  description: "验收随机邻接矩阵：单向通道与可停留格可视化。",
};

export default function MapLabPage() {
  return <MapLabClient />;
}
