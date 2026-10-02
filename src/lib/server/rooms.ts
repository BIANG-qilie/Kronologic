import { randomBytes } from "crypto";
import {
  checkAnswers,
  resolvePlacePerson,
  resolvePlaceTime,
  soloRating,
} from "@/lib/game/query";
import { getScenarioBundle, getDefaultScenarioId } from "@/lib/game/scenarios";
import type {
  PlaceId,
  PersonId,
  PlayerPublic,
  PrivateClue,
  QueryKind,
  QueryLogEntry,
  RoomPhase,
  RoomPublicView,
  ScenarioCase,
  ScenarioPublic,
  SubmitAnswer,
  TimeId,
} from "@/lib/game/types";

export interface NotesState {
  text: string;
  updatedAt: number;
}
const SUBMIT_WINDOW_MS = 12_000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface InternalPlayer {
  id: string;
  nickname: string;
  seat: number;
  token: string;
  eliminated: boolean;
  connected: boolean;
  isHost: boolean;
  queryCount: number;
  privateClues: PrivateClue[];
  notes: NotesState;
  pendingSubmit: SubmitAnswer | null;
}

export interface InternalRoom {
  code: string;
  phase: RoomPhase;
  scenarioId: string;
  scenario: ScenarioPublic;
  sealed: ScenarioCase | null;
  players: InternalPlayer[];
  currentTurnSeat: number;
  askAgainPending: boolean;
  queryLog: QueryLogEntry[];
  queryCountTotal: number;
  submitWindowEndsAt: number | null;
  winners: string[];
  createdAt: number;
  listeners: Set<(viewPlayerId: string | null) => void>;
}

declare global {
  // eslint-disable-next-line no-var
  var __lampRooms: Map<string, InternalRoom> | undefined;
}

function rooms(): Map<string, InternalRoom> {
  if (!globalThis.__lampRooms) {
    globalThis.__lampRooms = new Map();
  }
  return globalThis.__lampRooms;
}

function genCode(): string {
  let code = "";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

function genId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function genToken(): string {
  return randomBytes(24).toString("hex");
}

function getBundleOrThrow(id: string) {
  const b = getScenarioBundle(id);
  if (!b) throw new Error("场景不存在");
  return b;
}

export function createRoom(nickname: string, scenarioId?: string) {
  const id = scenarioId || getDefaultScenarioId();
  const resolved = getBundleOrThrow(id);

  let code = genCode();
  while (rooms().has(code)) code = genCode();

  const player: InternalPlayer = {
    id: genId("p"),
    nickname: nickname.trim().slice(0, 16) || "调查员",
    seat: 0,
    token: genToken(),
    eliminated: false,
    connected: true,
    isHost: true,
    queryCount: 0,
    privateClues: [],
    notes: { text: "", updatedAt: Date.now() },
    pendingSubmit: null,
  };

  const room: InternalRoom = {
    code,
    phase: "lobby",
    scenarioId: resolved.public.id,
    scenario: resolved.public,
    sealed: null,
    players: [player],
    currentTurnSeat: 0,
    askAgainPending: false,
    queryLog: [],
    queryCountTotal: 0,
    submitWindowEndsAt: null,
    winners: [],
    createdAt: Date.now(),
    listeners: new Set(),
  };

  rooms().set(code, room);
  return { room, player, token: player.token };
}

export function getRoom(code: string): InternalRoom | undefined {
  return rooms().get(code.toUpperCase());
}

export function findPlayerByToken(room: InternalRoom, token: string) {
  return room.players.find((p) => p.token === token);
}

function activePlayers(room: InternalRoom) {
  return room.players.filter((p) => !p.eliminated);
}

function nextActiveSeat(room: InternalRoom, fromSeat: number): number {
  const n = room.players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (fromSeat + i) % n;
    const p = room.players.find((x) => x.seat === seat);
    if (p && !p.eliminated) return seat;
  }
  return fromSeat;
}

function notify(room: InternalRoom) {
  for (const fn of room.listeners) {
    try {
      fn(null);
    } catch {
      /* ignore */
    }
  }
}

export function subscribeRoom(
  code: string,
  listener: (viewPlayerId: string | null) => void
) {
  const room = getRoom(code);
  if (!room) return () => undefined;
  room.listeners.add(listener);
  return () => {
    room.listeners.delete(listener);
  };
}

export function joinRoom(code: string, nickname: string) {
  const room = getRoom(code);
  if (!room) throw new Error("房间不存在");
  if (room.phase !== "lobby") throw new Error("对局已开始，无法加入");
  if (room.players.length >= 4) throw new Error("房间已满（最多 4 人）");

  const player: InternalPlayer = {
    id: genId("p"),
    nickname: nickname.trim().slice(0, 16) || "调查员",
    seat: room.players.length,
    token: genToken(),
    eliminated: false,
    connected: true,
    isHost: false,
    queryCount: 0,
    privateClues: [],
    notes: { text: "", updatedAt: Date.now() },
    pendingSubmit: null,
  };
  room.players.push(player);
  notify(room);
  return { room, player, token: player.token };
}

export function reconnect(code: string, token: string) {
  const room = getRoom(code);
  if (!room) throw new Error("房间不存在");
  const player = findPlayerByToken(room, token);
  if (!player) throw new Error("会话无效，请重新加入");
  player.connected = true;
  notify(room);
  return { room, player };
}

export function startGame(code: string, token: string) {
  const room = getRoom(code);
  if (!room) throw new Error("房间不存在");
  const player = findPlayerByToken(room, token);
  if (!player?.isHost) throw new Error("仅房主可开局");
  if (room.phase !== "lobby") throw new Error("已开局");
  if (room.players.length < 1) throw new Error("至少需要 1 名玩家");

  const bundle = getBundleOrThrow(room.scenarioId);
  room.sealed = structuredClone(bundle.sealed);
  room.phase = "playing";
  room.currentTurnSeat = 0;
  room.askAgainPending = false;
  room.queryLog = [];
  room.queryCountTotal = 0;
  room.winners = [];
  room.submitWindowEndsAt = null;
  for (const p of room.players) {
    p.eliminated = false;
    p.queryCount = 0;
    p.privateClues = [];
    p.pendingSubmit = null;
  }
  notify(room);
  return room;
}

export function kickPlayer(code: string, token: string, targetId: string) {
  const room = getRoom(code);
  if (!room) throw new Error("房间不存在");
  const host = findPlayerByToken(room, token);
  if (!host?.isHost) throw new Error("仅房主可踢人");
  if (room.phase !== "lobby") throw new Error("对局中不可踢人");
  if (host.id === targetId) throw new Error("不能踢自己");
  room.players = room.players
    .filter((p) => p.id !== targetId)
    .map((p, i) => ({ ...p, seat: i }));
  notify(room);
  return room;
}

function currentPlayer(room: InternalRoom): InternalPlayer | undefined {
  return room.players.find((p) => p.seat === room.currentTurnSeat);
}

export function askQuery(
  code: string,
  token: string,
  input: {
    kind: QueryKind;
    placeId: PlaceId;
    timeId?: TimeId;
    personId?: PersonId;
  }
) {
  const room = getRoom(code);
  if (!room) throw new Error("房间不存在");
  if (room.phase !== "playing") throw new Error("当前不可提问");
  if (!room.sealed) throw new Error("案件未封存");

  const player = findPlayerByToken(room, token);
  if (!player) throw new Error("会话无效");
  if (player.eliminated) throw new Error("你已淘汰，不能提问");
  const turn = currentPlayer(room);
  if (!turn || turn.id !== player.id) throw new Error("还没轮到你");

  const placeOk = room.scenario.places.some((p) => p.id === input.placeId);
  if (!placeOk) throw new Error("地点无效");

  let shared;
  let priv;
  const salt = `${room.code}:${room.queryLog.length}`;

  if (input.kind === "place_time") {
    if (!input.timeId || input.timeId < 1 || input.timeId > 6) {
      throw new Error("时间无效");
    }
    ({ shared, private: priv } = resolvePlaceTime(
      room.sealed,
      input.placeId,
      input.timeId,
      salt
    ));
  } else {
    if (!input.personId) throw new Error("人物无效");
    if (!room.scenario.people.some((p) => p.id === input.personId)) {
      throw new Error("人物无效");
    }
    ({ shared, private: priv } = resolvePlacePerson(
      room.sealed,
      input.placeId,
      input.personId,
      salt
    ));
  }

  const queryId = genId("q");
  const entry: QueryLogEntry = {
    id: queryId,
    askerId: player.id,
    askerNickname: player.nickname,
    kind: input.kind,
    placeId: input.placeId,
    timeId: input.timeId,
    personId: input.personId,
    sharedLabel: shared.sharedLabel,
    askAgain: shared.askAgain,
    at: Date.now(),
  };
  room.queryLog.push(entry);
  // A query that yields no private clue is free, like the original's "ask again".
  if (!shared.askAgain) {
    room.queryCountTotal += 1;
    player.queryCount += 1;
  }

  player.privateClues.push({
    queryId,
    privateLabel: priv.privateLabel,
    kind: input.kind,
    placeId: input.placeId,
    timeId: input.timeId,
    personId: input.personId,
  });

  if (shared.askAgain) {
    room.askAgainPending = true;
  } else {
    room.askAgainPending = false;
    room.currentTurnSeat = nextActiveSeat(room, room.currentTurnSeat);
  }

  notify(room);
  return { entry, privateLabel: priv.privateLabel, askAgain: shared.askAgain };
}

function finalizeSubmitWindow(room: InternalRoom) {
  if (!room.sealed) return;
  const submissions = room.players.filter((p) => p.pendingSubmit && !p.eliminated);
  const winners: string[] = [];

  for (const p of submissions) {
    const ok = checkAnswers(room.sealed, p.pendingSubmit!);
    if (ok) winners.push(p.id);
    else {
      p.eliminated = true;
    }
    p.pendingSubmit = null;
  }

  room.submitWindowEndsAt = null;

  if (winners.length > 0) {
    room.winners = winners;
    room.phase = "reveal";
  } else if (activePlayers(room).length === 0) {
    room.phase = "all_eliminated";
  } else {
    room.phase = "playing";
    if (currentPlayer(room)?.eliminated) {
      room.currentTurnSeat = nextActiveSeat(room, room.currentTurnSeat);
    }
  }
  notify(room);
}

export function submitAnswers(code: string, token: string, answers: SubmitAnswer) {
  const room = getRoom(code);
  if (!room) throw new Error("房间不存在");
  if (room.phase !== "playing" && room.phase !== "submit_window") {
    throw new Error("当前不可交卷");
  }
  const player = findPlayerByToken(room, token);
  if (!player) throw new Error("会话无效");
  if (player.eliminated) throw new Error("你已淘汰");
  if (player.pendingSubmit) throw new Error("已提交，等待窗口结束");

  for (const q of room.scenario.winQuestions) {
    if (!answers[q.id]?.trim()) throw new Error(`请回答：${q.prompt}`);
  }

  player.pendingSubmit = { ...answers };

  if (room.phase === "playing") {
    room.phase = "submit_window";
    room.submitWindowEndsAt = Date.now() + SUBMIT_WINDOW_MS;
    const endsAt = room.submitWindowEndsAt;
    setTimeout(() => {
      const r = getRoom(code);
      if (!r || r.submitWindowEndsAt !== endsAt) return;
      finalizeSubmitWindow(r);
    }, SUBMIT_WINDOW_MS + 50);
  }

  // If everyone active already submitted, resolve early
  const pendingLeft = activePlayers(room).filter((p) => !p.pendingSubmit);
  if (pendingLeft.length === 0) {
    finalizeSubmitWindow(room);
  } else {
    notify(room);
  }

  return room;
}

export function saveNotes(code: string, token: string, text: string) {
  const room = getRoom(code);
  if (!room) throw new Error("房间不存在");
  const player = findPlayerByToken(room, token);
  if (!player) throw new Error("会话无效");
  player.notes = { text: text.slice(0, 20_000), updatedAt: Date.now() };
  // Notes are private — no need to blast all, but SSE refresh is fine
  notify(room);
  return player.notes;
}

function toPublicPlayer(p: InternalPlayer): PlayerPublic {
  return {
    id: p.id,
    nickname: p.nickname,
    seat: p.seat,
    eliminated: p.eliminated,
    connected: p.connected,
    isHost: p.isHost,
    queryCount: p.queryCount,
  };
}

export function projectRoom(
  room: InternalRoom,
  viewerToken?: string | null
): RoomPublicView {
  const viewer = viewerToken ? findPlayerByToken(room, viewerToken) : undefined;
  const turn = currentPlayer(room);
  const revealed =
    room.phase === "reveal" || room.phase === "all_eliminated"
      ? room.sealed?.answers ?? null
      : null;

  let rating: RoomPublicView["soloRating"] = null;
  if (
    revealed &&
    room.players.length === 1 &&
    room.phase === "reveal" &&
    room.winners.includes(room.players[0].id)
  ) {
    rating = soloRating(
      room.players[0].queryCount,
      room.scenario.soloBands.goldMax,
      room.scenario.soloBands.silverMax
    );
  }

  const canAct =
    !!viewer &&
    !viewer.eliminated &&
    room.phase === "playing" &&
    turn?.id === viewer.id;

  const canSubmit =
    !!viewer &&
    !viewer.eliminated &&
    !viewer.pendingSubmit &&
    (room.phase === "playing" || room.phase === "submit_window");

  return {
    code: room.code,
    phase: room.phase,
    scenarioId: room.scenarioId,
    scenario: room.scenario,
    players: room.players.map(toPublicPlayer),
    currentTurnPlayerId: turn?.id ?? null,
    queryLog: room.queryLog,
    queryCountTotal: room.queryCountTotal,
    submitWindowEndsAt: room.submitWindowEndsAt,
    winners: room.winners,
    revealAnswers: revealed,
    revealTrajectory: revealed ? room.sealed?.trajectory ?? null : null,
    revealVictimId:
      revealed && room.sealed?.rule.type === "alone_with_victim" ? room.sealed.rule.victimId : null,
    soloRating: rating,
    you: viewer
      ? {
          playerId: viewer.id,
          privateClues: viewer.privateClues,
          notes: viewer.notes.text,
          canAct,
          canSubmit,
          eliminated: viewer.eliminated,
        }
      : null,
  };
}

export function setScenario(code: string, token: string, scenarioId: string) {
  const room = getRoom(code);
  if (!room) throw new Error("房间不存在");
  const player = findPlayerByToken(room, token);
  if (!player?.isHost) throw new Error("仅房主可选调查");
  if (room.phase !== "lobby") throw new Error("已开局");
  const bundle = getBundleOrThrow(scenarioId);
  room.scenarioId = bundle.public.id;
  room.scenario = bundle.public;
  notify(room);
  return room;
}

export { SUBMIT_WINDOW_MS };
