import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth/current";
import { createRoom, projectRoom } from "@/lib/server/rooms";
import { customLevelErrorResponse, ensureCustomLevel } from "@/lib/server/custom-levels";
import { assertDetectivePlayer, DetectiveAuthError } from "@/lib/server/detective";
import { CustomLevelError, customLevelId } from "@/lib/game/custom-level";
import { DETECTIVE_CASES, isDetectiveDifficulty, rollDetectiveRequest } from "@/lib/game/detective";

export const runtime = "nodejs";
export const maxDuration = 60;

const ATTEMPTS = 3;

/** Draw a random case and map for the signed-in player and open a room under their account name. */
export async function POST(req: Request) {
  let user;
  try {
    user = assertDetectivePlayer(await currentUser());
  } catch (e) {
    if (e instanceof DetectiveAuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  const body = await req.json().catch(() => ({}));
  const difficulty = body?.difficulty;
  if (!isDetectiveDifficulty(difficulty)) {
    return NextResponse.json({ error: "先选一个难度" }, { status: 400 });
  }

  let lastError: unknown = null;
  for (let i = 0; i < ATTEMPTS; i++) {
    const request = rollDetectiveRequest(difficulty);
    try {
      const bundle = await ensureCustomLevel(request, req.signal);
      const { room, player, token } = createRoom(user.username, undefined, user.id, bundle, {
        caseId: request.caseId,
        difficulty,
        levelId: customLevelId(request),
      });
      const c = DETECTIVE_CASES.find((x) => x.id === request.caseId)!;
      const custom = bundle.public.custom!;
      return NextResponse.json({
        code: room.code,
        token,
        playerId: player.id,
        view: projectRoom(room, token),
        draw: {
          caseId: c.id,
          caseTitle: c.title,
          nodeCount: request.nodeCount,
          oneWayCount: custom.oneWayCount,
          stayCount: custom.stayCount,
          difficulty,
          seed: request.seed,
        },
      });
    } catch (e) {
      lastError = e;
      if (!(e instanceof CustomLevelError && e.retryable)) break;
    }
  }
  return customLevelErrorResponse(lastError);
}
