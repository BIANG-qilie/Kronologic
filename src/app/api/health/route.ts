import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight probe for Railway healthcheckPath — no game/room state. */
export function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
