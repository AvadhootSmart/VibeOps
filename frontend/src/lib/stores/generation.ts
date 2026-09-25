import { create } from "zustand";

// Tracks in-flight agent runs by a caller-chosen key, so "is this generating?"
// survives component unmounts (navigating away and back) and is shared across
// screens. Keys: "overview" for the overview snapshot, a session id for each
// assistant chat.
interface Run {
  error?: string;
  abort?: () => void; // called by stop(key) to cancel the run
}

interface GenerationStore {
  runs: Record<string, Run>;
  start: (key: string, abort?: () => void) => void;
  finish: (key: string, error?: string) => void;
  stop: (key: string) => void;
}

export const useGenerationStore = create<GenerationStore>((set, get) => ({
  runs: {},
  start: (key, abort) =>
    set((s) => ({ runs: { ...s.runs, [key]: { abort } } })),
  finish: (key, error) =>
    set((s) => {
      const runs = { ...s.runs };
      if (error) runs[key] = { error };
      else delete runs[key];
      return { runs };
    }),
  stop: (key) => get().runs[key]?.abort?.(),
}));

// Convenience selector: is the run for `key` currently active?
export const useIsGenerating = (key: string) =>
  useGenerationStore((s) => key in s.runs && !s.runs[key].error);
