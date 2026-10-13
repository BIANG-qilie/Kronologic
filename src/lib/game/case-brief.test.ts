import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PROLOGUE } from "./prologue";
import { NIGHT_TEA_SYNOPSIS, NIGHT_TEA_WIN } from "./night-tea-template";
import { caseBriefEyebrow, caseBriefObjectives } from "./case-brief";

describe("caseBriefEyebrow", () => {
  it("labels prologue as 序幕的案子", () => {
    assert.equal(caseBriefEyebrow(PROLOGUE.public), "序幕的案子");
  });

  it("labels night-tea as 今晚的案子", () => {
    assert.equal(
      caseBriefEyebrow({ id: "night-tea-poison-l1-a", level: 1 }),
      "今晚的案子",
    );
  });
});

describe("caseBriefObjectives", () => {
  it("lists prologue win prompts", () => {
    assert.deepEqual(caseBriefObjectives(PROLOGUE.public), [
      "谁单独进过妆室？",
      "在时间几？",
    ]);
  });

  it("lists night-tea win prompts", () => {
    assert.deepEqual(caseBriefObjectives({ winQuestions: NIGHT_TEA_WIN }), [
      "谁下的毒？",
      "何时下的手？",
      "在哪个房间？",
    ]);
  });
});

describe("case brief copy parity with lobby", () => {
  it("prologue synopsis matches《换掉的钥匙》", () => {
    assert.equal(PROLOGUE.public.title, "换掉的钥匙");
    assert.match(PROLOGUE.public.synopsis, /查出：谁、在时间几/);
  });

  it("night-tea synopsis matches《夜茶的毒》", () => {
    assert.match(NIGHT_TEA_SYNOPSIS, /查出：谁、何时、何地/);
  });
});
