import type { NotesPayloadV3 } from "./notes-format";
import type { PersonId, PlaceId, QueryKind, QueryLogEntry, QueryTarget, TimeId } from "./types";

/**
 * The six guided steps of 第 0 关 · 序幕. Each step is a short run of beats;
 * every beat opens exactly one thing to tap and says why in one or two lines.
 */

export type TutorialTab = "desk" | "ask";

export type TutorialProgress = {
  queryLog: QueryLogEntry[];
  notes: NotesPayloadV3;
};

/** Read a line, then press 下一步. `target` is the `data-tutorial` anchor to light up. */
export type ReadBeat = {
  kind: "read";
  id: string;
  tab: TutorialTab;
  text: string;
  target?: string;
  focusTime?: TimeId;
  cta?: string;
};

/** Put together and ask exactly this question. */
export type AskBeat = {
  kind: "ask";
  id: string;
  text: string;
  ask: QueryTarget;
};

/** Pencil one person into or out of one room × time cell. */
export type MarkBeat = {
  kind: "mark";
  id: string;
  text: string;
  cell: { time: TimeId; place: PlaceId };
  person: PersonId;
  state: "in" | "out";
};

export type SubmitBeat = { kind: "submit"; id: string; text: string };

export type Beat = ReadBeat | AskBeat | MarkBeat | SubmitBeat;

export type TutorialStep = { id: string; title: string; beats: Beat[] };

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "brief",
    title: "案卷开场",
    beats: [
      {
        kind: "read",
        id: "brief",
        tab: "desk",
        text: "开演前，道具师裴砚（P）报告：妆室的一把钥匙被人换了。值班表记着，这三个时刻里只有一个人单独进过妆室——找出是谁、在时间几。",
        cta: "开始调查",
      },
    ],
  },
  {
    id: "ask-time",
    title: "第一次提问",
    beats: [
      {
        kind: "ask",
        id: "ask-dress-2",
        text: "每次提问选一个房间，再配一个时间或一个人物。先问「妆室 × 时间 2」。",
        ask: { kind: "place_time", placeId: "dress", timeId: 2 },
      },
      {
        kind: "read",
        id: "read-dress-2",
        tab: "desk",
        target: "latest-clue",
        focusTime: 2,
        text: "绿窗：时间 2 的妆室里有 1 人，全桌都看得见。白窗：其中有 P，只亮给你一个人。",
      },
    ],
  },
  {
    id: "notes",
    title: "记笔记",
    beats: [
      {
        kind: "read",
        id: "read-shapes",
        tab: "desk",
        target: "cell-2-dress",
        focusTime: 2,
        text: "线索已经自动记在桌上：圆圈是绿窗的人数，方框是白窗告诉你的人。",
      },
      {
        kind: "mark",
        id: "mark-hall-2",
        text: "妆室里只有 P 一个人，所以 P 不在正厅。点开时间 2 的正厅，把 P 点两下，标成「不在」。",
        cell: { time: 2, place: "hall" },
        person: "P",
        state: "out",
      },
    ],
  },
  {
    id: "ask-person",
    title: "第二种问法",
    beats: [
      {
        kind: "ask",
        id: "ask-hall-p",
        text: "房间也可以配人物：绿窗是这个人整晚来过几次。问「正厅 × P」。",
        ask: { kind: "place_person", placeId: "hall", personId: "P" },
      },
      {
        kind: "read",
        id: "read-hall-p",
        tab: "desk",
        target: "latest-clue",
        focusTime: 2,
        text: "绿窗 0 次：P 从没进过正厅，白窗也就没有内容。白窗为空时不计次，马上再问一次。",
      },
      {
        kind: "ask",
        id: "ask-dress-p",
        text: "再问「妆室 × P」。",
        ask: { kind: "place_person", placeId: "dress", personId: "P" },
      },
      {
        kind: "read",
        id: "read-dress-p",
        tab: "desk",
        target: "latest-clue",
        focusTime: 2,
        text: "绿窗 1 次：P 整晚只进过妆室一次。白窗：那一次就是时间 2。",
      },
    ],
  },
  {
    id: "infer",
    title: "推理层",
    beats: [
      {
        kind: "read",
        id: "read-move",
        tab: "desk",
        target: "floor",
        focusTime: 3,
        text: "每到下一个时间，每个人都必须走进相邻的房间，不能原地不动。妆室只和舞台相连。",
      },
      {
        kind: "mark",
        id: "mark-stage-3",
        text: "所以时间 3 的 P 只能在舞台。点开时间 3 的舞台，把 P 点一下标成「在」——菱形就是你自己的推理。",
        cell: { time: 3, place: "stage" },
        person: "P",
        state: "in",
      },
    ],
  },
  {
    id: "submit",
    title: "交卷",
    beats: [
      {
        kind: "submit",
        id: "submit",
        text: "先选人物，再选时间。答错不会出局，这里会给提示。",
      },
    ],
  },
];

export type BeatRef = { step: number; beat: number };

export const FIRST_BEAT: BeatRef = { step: 0, beat: 0 };

export function beatAt(ref: BeatRef): Beat {
  return TUTORIAL_STEPS[ref.step].beats[ref.beat];
}

export function nextBeat(ref: BeatRef): BeatRef | null {
  const step = TUTORIAL_STEPS[ref.step];
  if (ref.beat + 1 < step.beats.length) return { step: ref.step, beat: ref.beat + 1 };
  if (ref.step + 1 < TUTORIAL_STEPS.length) return { step: ref.step + 1, beat: 0 };
  return null;
}

export function sameQuery(a: QueryTarget, b: Pick<QueryLogEntry, "kind" | "placeId" | "timeId" | "personId">): boolean {
  return (
    a.kind === b.kind &&
    a.placeId === b.placeId &&
    (a.kind === "place_time" ? a.timeId === b.timeId : a.personId === b.personId)
  );
}

/** Whether the player has done what this beat asks. Read beats wait for 下一步. */
export function beatDone(beat: Beat, progress: TutorialProgress): boolean {
  switch (beat.kind) {
    case "ask":
      return progress.queryLog.some((q) => sameQuery(beat.ask, q));
    case "mark": {
      const mark = progress.notes.inference.cells[String(beat.cell.time)]?.[beat.cell.place];
      return !!mark && mark[beat.state].includes(beat.person);
    }
    default:
      return false;
  }
}

export type AskDraft = {
  kind: QueryKind;
  placeId: PlaceId | null;
  timeId: TimeId | null;
  personId: PersonId | null;
};

export type AskFocus = "kind" | "place" | "detail" | "send";

/** Which part of the question panel to light up next. */
export function askFocus(ask: QueryTarget, draft: AskDraft | null): AskFocus {
  if (!draft || draft.kind !== ask.kind) return "kind";
  if (draft.placeId !== ask.placeId) return "place";
  if (ask.kind === "place_time" ? draft.timeId !== ask.timeId : draft.personId !== ask.personId) return "detail";
  return "send";
}

export function askAnchor(ask: QueryTarget, focus: AskFocus): string {
  switch (focus) {
    case "kind":
      return `kind-${ask.kind}`;
    case "place":
      return `place-${ask.placeId}`;
    case "detail":
      return ask.kind === "place_time" ? `query-times` : `query-people`;
    case "send":
      return "query-send";
  }
}

export const MAX_HINTS = 2;

/** Two hints, light then plain; the third miss reveals the answer with the reason. */
export const SUBMIT_FEEDBACK: Record<string, { correct: string; hints: [string, string]; reveal: string }> = {
  who: {
    correct: "对，是裴砚（P）。",
    hints: [
      "白窗告诉过你：时间 2 的妆室里那个人是谁？",
      "时间 2 的妆室，绿窗是 1 人，白窗是 P。只有一个人，就是单独。",
    ],
    reveal: "答案是裴砚（P）。时间 2 的妆室只有他一个人；时间 1 和时间 3，妆室里都是安澄和唐珀两个人，不算单独。",
  },
  when: {
    correct: "对，是时间 2。",
    hints: [
      "再看一眼时间 2 的绿窗人数。",
      "时间 1 的妆室是安澄和唐珀两个人，不算单独；时间 2 的妆室只有 1 个人。",
    ],
    reveal: "答案是时间 2。只有这一刻，妆室里只有一个人——P。时间 1 和时间 3 都是安澄和唐珀一起在里面。",
  },
};

export type SubmitFeedback =
  | { type: "correct"; text: string }
  | { type: "hint"; text: string; left: number }
  | { type: "reveal"; text: string };

export function judgeAnswer(questionId: string, expected: string, picked: string, missesBefore: number): SubmitFeedback {
  const copy = SUBMIT_FEEDBACK[questionId];
  if (picked === expected) return { type: "correct", text: copy.correct };
  if (missesBefore < MAX_HINTS) {
    return { type: "hint", text: copy.hints[missesBefore], left: MAX_HINTS - missesBefore - 1 };
  }
  return { type: "reveal", text: copy.reveal };
}

export const DEBRIEF = {
  verdict: "钥匙是裴砚（P）在时间 2 换的。报案的人，正是换钥匙的人。",
  recap: [
    {
      title: "提问",
      body: "房间 × 时间：绿窗公布几人，白窗私下告诉你其中一位。房间 × 人物：绿窗公布来过几次，白窗告诉你其中一次。白窗为空不计次，再问一次。",
    },
    {
      title: "记笔记",
      body: "圆圈是绿窗，方框是白窗，菱形是你的推理。每到下一个时间，每个人都要走进相邻的房间，不能原地不动。",
    },
    {
      title: "交卷",
      body: "正式关卡是六时、六地、六人，要答谁、何时、何地。只有一次机会，答错出局。",
    },
  ],
};
