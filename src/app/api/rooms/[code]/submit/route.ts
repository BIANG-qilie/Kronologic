import { NextResponse } from "next/server";
import { getRoom, projectRoom, submitAnswers } from "@/lib/server/rooms";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  try {
    const body = await req.json();
    const token = String(body.token ?? "");
    const answers = (body.answers ?? {}) as Record<string, string>;
    submitAnswers(code, token, answers);
    const room = getRoom(code)!;
    return NextResponse.json({ view: projectRoom(room, token) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "交卷失败" },
      { status: 400 }
    );
  }
}
