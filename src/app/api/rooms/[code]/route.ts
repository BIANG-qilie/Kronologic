import { NextResponse } from "next/server";
import {
  getRoom,
  joinRoom,
  projectRoom,
  reconnect,
  startGame,
  setScenario,
  kickPlayer,
} from "@/lib/server/rooms";
import { currentUser } from "@/lib/server/auth/current";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const room = getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "没找到这个房间，核对一下房间码" }, { status: 404 });
  }
  const token = new URL(req.url).searchParams.get("token");
  return NextResponse.json({ view: projectRoom(room, token) });
}

export async function POST(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  try {
    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "join") {
      const user = await currentUser();
      const { room, player, token } = joinRoom(code, String(body.nickname ?? ""), user?.id ?? null);
      return NextResponse.json({
        code: room.code,
        token,
        playerId: player.id,
        view: projectRoom(room, token),
      });
    }

    if (action === "reconnect") {
      const { room, player } = reconnect(code, String(body.token ?? ""));
      return NextResponse.json({
        code: room.code,
        token: player.token,
        playerId: player.id,
        view: projectRoom(room, player.token),
      });
    }

    if (action === "start") {
      const room = startGame(code, String(body.token ?? ""));
      return NextResponse.json({ view: projectRoom(room, body.token) });
    }

    if (action === "setScenario") {
      const room = setScenario(
        code,
        String(body.token ?? ""),
        String(body.scenarioId ?? "")
      );
      return NextResponse.json({ view: projectRoom(room, body.token) });
    }

    if (action === "kick") {
      const room = kickPlayer(
        code,
        String(body.token ?? ""),
        String(body.targetId ?? "")
      );
      return NextResponse.json({ view: projectRoom(room, body.token) });
    }

    return NextResponse.json({ error: "操作无效" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "操作失败，请重试" },
      { status: 400 }
    );
  }
}
