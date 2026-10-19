import { NextResponse } from "next/server";
import { parseCustomRequest } from "@/lib/game/custom-level";
import { customLevelErrorResponse, ensureCustomLevel } from "@/lib/server/custom-levels";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Build (or fetch) a custom level and return its public side for preview. */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const request = parseCustomRequest(body ?? {});
    const bundle = await ensureCustomLevel(request, req.signal);
    return NextResponse.json({ level: bundle.public });
  } catch (e) {
    return customLevelErrorResponse(e);
  }
}
