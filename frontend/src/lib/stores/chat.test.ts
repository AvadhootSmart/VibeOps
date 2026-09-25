import { expect, test } from "bun:test";
import { useChatStore } from "./chat";
import type { Turn } from "@/components/custom/assistant/turn";

const turn = (id: string): Turn => ({ id, prompt: id, result: null });

test("a run patches the transcript by turn id, and forget drops it", () => {
  const { setTurns, patchTurns, forget } = useChatStore.getState();
  setTurns("s1", [turn("a"), turn("b")]);
  // What a run whose screen has unmounted does when its answer lands.
  patchTurns("s1", (all) =>
    all.map((t) => (t.id === "b" ? { ...t, prompt: "done" } : t)),
  );
  expect(useChatStore.getState().transcripts.s1.map((t) => t.prompt)).toEqual([
    "a",
    "done",
  ]);

  // Patching a session never loaded starts from empty rather than throwing.
  patchTurns("gone", (all) => [...all, turn("c")]);
  expect(useChatStore.getState().transcripts.gone).toHaveLength(1);

  forget("s1");
  expect(useChatStore.getState().transcripts.s1).toBeUndefined();
});
