// Public surface of the AI layer. App code imports from "@/lib/ai".
export {
  DEFAULT_MODEL,
  createModel,
  getApiKey,
  MissingApiKeyError,
} from "./provider";
export { runAgent } from "./agent";
export type { AgentStep, AgentResult } from "./agent";
export { tools } from "./tools";
export { onSecretPrompt, SUDO_SECRET } from "./secrets";
