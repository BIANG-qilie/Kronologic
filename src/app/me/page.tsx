import type { Metadata } from "next";
import { RecordsPage } from "@/components/account/records-page";

export const metadata: Metadata = {
  title: "我的战绩 · 灯序",
};

export default function MePage() {
  return <RecordsPage />;
}
