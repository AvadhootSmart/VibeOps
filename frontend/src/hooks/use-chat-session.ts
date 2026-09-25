import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ModelMessage } from "ai";
import { runAgent, MissingApiKeyError } from "@/lib/ai";
import { notifyError, notifyIfAway } from "@/lib/notify";
import { getConfig } from "@/lib/config";
import { coalesce } from "@/lib/utils";
import { useGenerationStore, useIsGenerating } from "@/lib/stores/generation";
import { useChatStore } from "@/lib/stores/chat";
import type { Turn } from "@/components/custom/assistant/turn";
import { Get, Save } from "@wails/go/sessions/Sessions";

// Persisted session blob = the turn list, stringified. The model history is
// recoverable from the last turn's result.messages, so we don't store it twice.
const historyOf = (turns: Turn[]): ModelMessage[] =>
  turns[turns.length - 1]?.result?.messages ?? [];

// Last CLI session id in this chat, for resume continuity when a harness
// provider is selected. Undefined on the OpenRouter path.
const harnessSessionOf = (turns: Turn[]) =>
  turns[turns.length - 1]?.result?.harnessSessionId;

const EMPTY: Turn[] = [];

// The agent streams an update per chunk — dozens a second on a fast model.
// Re-rendering the transcript that often starves the composer's keystrokes, so
// updates are coalesced into roughly a frame's worth of work.
// ponytail: a fixed interval, not a rAF/idle scheduler. Raise it if a very long
// transcript still stutters.
const STREAM_FLUSH_MS = 60;

// Session name comes from the first prompt — unless that one is hidden, which
// would put the whole handoff prompt in the sidebar. A screen handing a prompt
// over can name the chat itself (the deployment dialog uses the project's
// folder or repo name); that name is stored on the first turn so it survives a
// reload, when the ?name= param that carried it is long gone.
function sessionName(turns: Turn[], input: string, hidden: boolean, title?: string) {
  const first = turns[0];
  const named = first ? first.title : title;
  if (named) return named;
  if (first?.hidden || (!first && hidden)) return "Deployment";
  return (first?.prompt ?? input).slice(0, 80);
}

/**
 * Owns one Assistant chat: the session named in the URL, its turns, and the
 * agent run that appends to them. Kept out of the page because the URL sync,
 * the creation race and the save-before-answer are the fiddly parts, and
 * nothing about them is rendering.
 */
export function useChatSession() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionParam = searchParams.get("session");

  const [sessionId, setSessionId] = useState<string | null>(null);

  // Generation state lives in the shared store, keyed by session, so it's the
  // same mechanism the overview screen uses and survives navigation.
  const genKey = sessionId ?? "new";
  const isLoading = useIsGenerating(genKey);
  const turns = useChatStore((s) => s.transcripts[genKey] ?? EMPTY);

  // Id of a session we just created locally. Set before we claim the URL, so
  // the load effect can tell "URL hasn't caught up yet" from a real new-chat
  // navigation and not wipe the in-flight turn. Cleared once the URL settles.
  const createdRef = useRef<string | null>(null);

  // Load the session named in the URL (or reset to a blank chat when none).
  useEffect(() => {
    if (sessionParam === sessionId) {
      createdRef.current = null; // URL caught up; creation settled
      return;
    }
    if (!sessionParam) {
      if (createdRef.current) return; // mid-creation, URL not caught up
      setSessionId(null);
      useChatStore.getState().setTurns("new", []);
      return;
    }
    // Already in the store means a run of this chat has been streaming into it
    // — possibly while the screen was unmounted. Reading disk here would drop
    // everything that arrived since the last save.
    if (useChatStore.getState().transcripts[sessionParam]) {
      setSessionId(sessionParam);
      return;
    }
    let cancelled = false;
    (async () => {
      const s = await Get(sessionParam);
      if (cancelled || !s.id) return;
      // Sessions saved before turns carried an id get one on load, so the
      // transcript still has a stable key for every row.
      const stored = s.messages
        ? (JSON.parse(s.messages) as (Omit<Turn, "id"> & { id?: string })[])
        : [];
      useChatStore
        .getState()
        .setTurns(s.id, stored.map((t) => ({ ...t, id: t.id ?? crypto.randomUUID() })));
      setSessionId(s.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionParam, sessionId]);

  const save = (id: string, name: string, all: Turn[]) =>
    Save(id, name, JSON.stringify(all))
      .then(() => window.dispatchEvent(new Event("sessions-changed")))
      .catch(() => {});

  async function run(input: string, hidden = false, title?: string) {
    if (!input || isLoading) return;

    // Stamped on the turn so a chat reopened later still knows which provider
    // holds its history — a harness session can only be continued by its own CLI.
    const { provider } = await getConfig();

    const prior = useChatStore.getState().transcripts[genKey] ?? [];
    let id = sessionId;
    if (!id) {
      id = crypto.randomUUID();
      // Mark this as ours before claiming the URL, so the load effect won't
      // reset the in-flight turn while the param catches up.
      createdRef.current = id;
      setSessionId(id);
      setSearchParams({ session: id }, { replace: true });
    }
    const name = sessionName(prior, input, hidden, title);
    const messages: ModelMessage[] = [
      ...historyOf(prior),
      { role: "user", content: input },
    ];
    const pending: Turn = {
      id: crypto.randomUUID(),
      prompt: input,
      result: null,
      hidden,
      title,
      provider,
    };
    const { setTurns, patchTurns } = useChatStore.getState();
    setTurns(id, [...prior, pending]);

    const stream = coalesce<Turn["result"]>(STREAM_FLUSH_MS, (result) =>
      patchTurns(id, (all) =>
        all.map((turn) => (turn.id === pending.id ? { ...turn, result } : turn)),
      ),
    );

    const { start, finish } = useGenerationStore.getState();
    const controller = new AbortController();
    start(id, () => controller.abort());
    // Save the turn before it has an answer, so the chat shows up in the
    // sidebar while it runs instead of popping in a minute later. Overwritten
    // with the real result below.
    save(id, name, [...prior, pending]);
    try {
      const result = await runAgent(
        messages,
        stream.push,
        controller.signal,
        harnessSessionOf(prior),
      );
      stream.flush(result);
      await save(id, name, [...prior, { ...pending, result }]);
      notifyIfAway("Agent finished", name);
    } catch (e) {
      if (e instanceof MissingApiKeyError) {
        notifyError("No API key set", "Add one in Settings first.");
      } else {
        notifyError("The assistant hit an error", e);
        notifyIfAway("The assistant hit an error", name);
      }
      // Keep whatever streamed before the failure on disk too, so reopening the
      // chat doesn't show an empty reply where the partial answer was.
      stream.flush();
      await save(id, name, useChatStore.getState().transcripts[id] ?? []);
    } finally {
      finish(id);
    }
  }

  const stop = () => useGenerationStore.getState().stop(genKey);

  return {
    turns,
    isLoading,
    run,
    stop,
    searchParams,
    /** Provider this chat was started on; undefined for a blank or legacy chat. */
    chatProvider: turns[0]?.provider,
  };
}
