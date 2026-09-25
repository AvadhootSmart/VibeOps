import { create } from "zustand";
import type { Turn } from "@/components/custom/assistant/turn";

// Transcripts by session id ("new" for a chat that has no id yet). They live
// outside React because a run outlives the screen: navigating away unmounts
// the Assistant, and the run's setState writes would land on a dead component
// — the answer only reappeared after leaving and coming back re-read it from
// disk. The store is written from the same places as disk, so it is never
// staler than the saved session.
interface ChatStore {
  transcripts: Record<string, Turn[]>;
  setTurns: (key: string, turns: Turn[]) => void;
  patchTurns: (key: string, fn: (turns: Turn[]) => Turn[]) => void;
  forget: (key: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  transcripts: {},
  setTurns: (key, turns) =>
    set((s) => ({ transcripts: { ...s.transcripts, [key]: turns } })),
  patchTurns: (key, fn) =>
    set((s) => ({
      transcripts: { ...s.transcripts, [key]: fn(s.transcripts[key] ?? []) },
    })),
  forget: (key) =>
    set((s) => {
      const transcripts = { ...s.transcripts };
      delete transcripts[key];
      return { transcripts };
    }),
}));
