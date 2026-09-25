import { create } from "zustand";
import { EventsOn } from "@wails/runtime/runtime";
import { Answer, Pending } from "@wails/go/ask/Ask";
import type { ask } from "@wails/go/models";

export type Question = ask.Question;

// A question either came from the harness — raised in Go, answered back over
// the bound Answer — or from the OpenRouter agent, which runs in this window
// and is waiting on a promise. `resolve` is what tells them apart.
interface Waiting extends Question {
  resolve?: (answer: string) => void;
}

interface AskStore {
  pending: Waiting[];
  askLocally: (q: Omit<Question, "id">) => Promise<string>;
  answer: (id: string, text: string) => void;
  init: () => void;
}

let seq = 0;

export const useAsk = create<AskStore>((set, get) => ({
  pending: [],

  askLocally: (q) =>
    new Promise<string>((resolve) => {
      const id = `local-${++seq}`;
      set((s) => ({ pending: [...s.pending, { ...q, id, resolve }] }));
    }),

  answer: (id, text) => {
    const item = get().pending.find((p) => p.id === id);
    set((s) => ({ pending: s.pending.filter((p) => p.id !== id) }));
    if (!item) return;
    if (item.resolve) item.resolve(text);
    else Answer(id, text);
  },

  init: () => {
    EventsOn("ask:question", (q: Question) =>
      set((s) => (s.pending.some((p) => p.id === q.id) ? s : { pending: [...s.pending, q] })),
    );
    // The Go side gave up waiting, so the dialog goes away rather than sending
    // an answer nobody is listening for.
    EventsOn("ask:cancel", (id: string) =>
      set((s) => ({ pending: s.pending.filter((p) => p.id !== id) })),
    );
    // A reload loses the events already emitted, and the agent is still blocked
    // on them — so ask Go what is outstanding.
    Pending()
      .then((open) =>
        set((s) => ({
          pending: [
            ...s.pending,
            ...(open ?? []).filter((q) => !s.pending.some((p) => p.id === q.id)),
          ],
        })),
      )
      .catch(() => {});
  },
}));