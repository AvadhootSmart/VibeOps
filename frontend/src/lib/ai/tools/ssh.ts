import { Connect, Disconnect, RunRemote } from "@wails/go/tools/SSH";
import { Cancel } from "@wails/go/tools/Tool";
import { GetAllowedServers } from "@wails/go/settings/Settings";
import { defineTool } from "./define";

export const SshConnectTool = defineTool<{
  host: string;
  port?: number;
  user: string;
  keyPath?: string;
}>("sshConnect", async ({ host, port, user, keyPath }) =>
  Connect(host, port ?? 0, user, keyPath ?? ""),
);

// Secrets, redaction and the sudo password are all handled inside RunRemote —
// see backend/tools/ssh.go. Nothing about them belongs on this side of the
// bridge: the webview is where the model's tool calls run.
export const SshRunTool = defineTool<{ sessionId: string; command: string }>(
  "sshRun",
  async ({ sessionId, command }, { abortSignal }) => {
    const runId = crypto.randomUUID();
    abortSignal?.addEventListener("abort", () => Cancel(runId));
    return RunRemote(sessionId, command, runId);
  },
);

export const SshDisconnectTool = defineTool<{ sessionId: string }>(
  "sshDisconnect",
  async ({ sessionId }) => Disconnect(sessionId),
);

export const getAllowedServers = defineTool("getAllowedServers", async () =>
  GetAllowedServers(),
);
