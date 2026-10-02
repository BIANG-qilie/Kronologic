import { NextResponse } from "next/server";
import { askQuery, getRoom, projectRoom } from "@/lib/server/rooms";
import type { PlaceId, PersonId, QueryKind, TimeId } from "@/lib/game/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  try {
    const body = await req.json();
    const token = String(body.token ?? "");
    const result = askQuery(code, token, {
      kind: body.kind as QueryKind,
      placeId: body.placeId as PlaceId,
      timeId: body.timeId as TimeId | undefined,
      personId: body.personId as PersonId | undefined,
    });
    const room = getRoom(code)!;
    return NextResponse.json({
      ...result,
      view: projectRoom(room, token),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "提问失败，请重试" },
      { status: 400 }
    );
  }
}
