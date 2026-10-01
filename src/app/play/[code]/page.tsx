import { PlayClient } from "@/components/game/play-client";

type Props = { params: Promise<{ code: string }> };

export default async function PlayPage({ params }: Props) {
  const { code } = await params;
  return <PlayClient initialCode={code.toUpperCase()} />;
}
