import { NextResponse } from "next/server";
import { getRoom, projectRoom, saveNotes } from "@/lib/server/rooms";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  try {
    const body = await req.json();
    const token = String(body.token ?? "");
    const notes = saveNotes(code, token, String(body.text ?? ""));
    const room = getRoom(code)!;
    return NextResponse.json({ notes, view: projectRoom(room, token) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "笔记没存上，请重试" },
      { status: 400 }
    );
  }
}
