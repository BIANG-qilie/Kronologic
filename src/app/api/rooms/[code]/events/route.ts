import { getRoom, projectRoom, subscribeRoom } from "@/lib/server/rooms";

type Ctx = { params: Promise<{ code: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const room = getRoom(code);
  if (!room) {
    return new Response("房间不存在", { status: 404 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        try {
          const view = projectRoom(room, token);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ view })}\n\n`)
          );
        } catch {
          /* closed */
        }
      };

      send();
      cleanup = subscribeRoom(code, () => send());
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        cleanup?.();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
