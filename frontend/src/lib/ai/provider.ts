import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { GetAPIKey } from "@wails/go/settings/Settings";
import { getConfig } from "@/lib/config";

// Default OpenRouter model. Any tool-capable model works; swap freely.
export const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

/** Thrown when no API key has been saved yet (via the Settings screen). */
export class MissingApiKeyError extends Error {
  constructor() {
    super("No OpenRouter API key set. Add one in Settings.");
    this.name = "MissingApiKeyError";
  }
}

/** Load the OpenRouter key from the OS keychain (via the Go settings service). */
export async function getApiKey(): Promise<string> {
  return GetAPIKey();
}

async function getModel(): Promise<string> {
  const { model } = await getConfig();
  return model || DEFAULT_MODEL;
}

export async function createModel(apiKey?: string) {
  const model = await getModel();
  const key = apiKey ?? (await getApiKey());
  if (!key) throw new MissingApiKeyError();
  const openrouter = createOpenRouter({ apiKey: key });
  return openrouter(model);
}
