import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { currentUser } from "@/lib/server/auth/current";
import { unlockAchievement } from "@/lib/server/records";
import { PROLOGUE_ACHIEVEMENT } from "@/lib/game/achievements";
import type { TutorialCompleteResponse } from "@/lib/account/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Guests get `saved: false` and keep their progress in local storage. */
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ saved: false } satisfies TutorialCompleteResponse);
  try {
    const db = await getDb();
    if (!db) return NextResponse.json({ saved: false } satisfies TutorialCompleteResponse);
    const newlyUnlocked = await unlockAchievement(db, user.id, PROLOGUE_ACHIEVEMENT);
    return NextResponse.json({ saved: true, newlyUnlocked } satisfies TutorialCompleteResponse);
  } catch (e) {
    console.error("accounts: prologue achievement failed", e);
    return NextResponse.json({ error: "成就暂时记不上，稍后再走一遍序幕即可补上" }, { status: 503 });
  }
}
