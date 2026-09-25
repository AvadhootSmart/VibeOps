// The prompt half of the secret flow for the OpenRouter path: a tool deep in
// the agent loop calls requestSecret(), the Assistant page has registered a
// handler (onSecretPrompt) that shows a dialog, and the value the user types
// goes straight to Go via SetRunSecret.
//
// Nothing is held here. Values live only in the run-scoped keychain store that
// ShellAccess and RunRemote read at execution time, so injection and redaction
// have one implementation (backend/settings) rather than one per agent path —
// and no secret is ever resident in the webview, which is the same process the
// model's tool calls run in. See docs/secret-request-flow.md.

import { SetRunSecret, ClearRunSecrets } from "@wails/go/tools/Tool";

/** The reserved name the sudo password is stashed under. */
export const SUDO_SECRET = "sudo";

type Resolver = (value: string | null) => void;
let handler:
  ((name: string, reason: string, resolve: Resolver) => void) | null = null;

/** The UI registers here. Returns an unsubscribe. Only one handler at a time. */
export function onSecretPrompt(
  fn: (name: string, reason: string, resolve: Resolver) => void,
): () => void {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

/** Prompts the user for a secret and hands it to Go. Resolves true if a value
 * was collected, false if no UI is mounted or the user cancelled. */
export async function requestSecret(
  name: string,
  reason: string,
): Promise<boolean> {
  if (!handler) return false;
  const value = await new Promise<string | null>((resolve) =>
    handler!(name, reason, resolve),
  );
  if (value === null) return false;
  await SetRunSecret(name, value);
  return true;
}

/** Drops every held value. Called at the start of each turn so the model can't
 * inherit a prior turn's authentication. */
export const clearSecrets = ClearRunSecrets;
