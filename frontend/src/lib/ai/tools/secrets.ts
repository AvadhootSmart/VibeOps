import { SUDO_SECRET, requestSecret } from "../secrets";
import { defineTool } from "./define";

// OpenRouter-path counterparts to the Claude Code sudoAuth / secretRequest
// tools. Both prompt through the in-webview bridge and hand the value straight
// to Go; the value is never held on this side, and the tools that need it
// (sshRun, shellAccess) read it from the run-scoped store themselves.

export const SudoAuthTool = defineTool<{ command: string }>(
  "sudoAuth",
  async ({ command }) => {
    const ok = await requestSecret(SUDO_SECRET, "run: " + command);
    return ok
      ? "Authenticated. The user's sudo password is set for this turn; proceed with the sudo command via sshRun."
      : "The user declined to authenticate sudo; do not attempt the sudo command.";
  },
);

export const SecretRequestTool = defineTool<{ name: string; reason: string }>(
  "secretRequest",
  async ({ name, reason }) => {
    // Checked here only to avoid popping a dialog for a name Go will reject —
    // SetRunSecret is what actually enforces it (backend/settings).
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
      return "Invalid secret name: use letters, digits and underscores only (e.g. DATABASE_URL).";
    }
    if (!(await requestSecret(name, reason))) {
      return `The user declined to provide ${name}; do not attempt to obtain or guess it.`;
    }
    return (
      `The user provided ${name}. Its value is deliberately withheld from you — ` +
      `write $SECRET_${name} (unquoted) wherever it is needed and VibeOps substitutes it at execution time.`
    );
  },
);
