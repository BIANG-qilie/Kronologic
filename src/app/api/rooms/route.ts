import { NextResponse } from "next/server";
import { createRoom } from "@/lib/server/rooms";
import { projectRoom } from "@/lib/server/rooms";
import { listScenariosPublic } from "@/lib/game/scenarios";

export async function GET() {
  return NextResponse.json({ scenarios: listScenariosPublic() });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const nickname = String(body.nickname ?? "");
    const scenarioId = body.scenarioId ? String(body.scenarioId) : undefined;
    const { room, player, token } = createRoom(nickname, scenarioId);
    return NextResponse.json({
      code: room.code,
      token,
      playerId: player.id,
      view: projectRoom(room, token),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "创建失败" },
      { status: 400 }
    );
  }
}
