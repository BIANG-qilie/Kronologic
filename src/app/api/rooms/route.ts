import { NextResponse } from "next/server";
import { createRoom, projectRoom } from "@/lib/server/rooms";
import {
  listCaseBankMeta,
  listScenariosPublic,
  pickScenarioIdForLevel,
  pickScenarioIdForTier,
  getDefaultScenarioId,
} from "@/lib/game/scenarios";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    family: listCaseBankMeta(),
    scenarios: listScenariosPublic(),
    defaultScenarioId: getDefaultScenarioId(),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const nickname = String(body.nickname ?? "");
    let scenarioId = body.scenarioId ? String(body.scenarioId) : undefined;
    if (!scenarioId && body.level != null) {
      scenarioId = pickScenarioIdForLevel(Number(body.level));
    }
    if (!scenarioId && body.greedyMin != null) {
      scenarioId = pickScenarioIdForTier(Number(body.greedyMin));
    }
    const { room, player, token } = createRoom(nickname, scenarioId);
    return NextResponse.json({
      code: room.code,
      token,
      playerId: player.id,
      view: projectRoom(room, token),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "新建游戏失败，请重试" },
      { status: 400 }
    );
  }
}
