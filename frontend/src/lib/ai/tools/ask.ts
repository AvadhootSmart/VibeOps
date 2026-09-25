import { defineTool } from "./define";
import { useAsk } from "@/lib/stores/ask";

// No Wails binding on this path: the OpenRouter agent runs in this window, so
// it opens the dialog directly. The harness path goes the long way round —
// backend/tools/ask.go posts to the app's loopback listener — and both end at
// the same dialog.
export const askQuestionTool = defineTool<{
  question: string;
  header?: string;
  options?: string;
}>("askQuestion", async ({ question, header, options }) => {
  let parsed: string[] = [];
  if (options?.trim()) {
    try {
      parsed = JSON.parse(options);
    } catch {
      return "options must be a JSON array of strings";
    }
  }
  return useAsk.getState().askLocally({
    question,
    header: header ?? "",
    options: parsed,
    allowOther: true,
  });
});