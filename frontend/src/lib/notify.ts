import { toast } from "sonner";
import {
  CheckNotificationAuthorization,
  InitializeNotifications,
  RequestNotificationAuthorization,
  SendNotification,
} from "@wails/runtime/runtime";
import { LogError } from "@wails/go/main/App";

// Single place errors reach the user. Wails rejects bindings with plain strings
// (the Go error text), while the AI layer throws Errors — normalize both so
// call sites can just hand over whatever they caught.
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// Every error shown to the user also lands in error.log, which they can send us.
// The stack says more than the message there, since nobody reads it in a toast.
export function logError(source: string, title: string, e: unknown) {
  const detail = e instanceof Error ? (e.stack ?? e.message) : String(e);
  LogError(source, `${title}: ${detail}`).catch(() => {});
}

// `fixable` opts a toast into the "Fix it" action, which hands the error to the
// assistant. Only worth offering where the assistant can actually act on it —
// a CLI that failed to install or sign in is a machine problem it can work on,
// a failed save or a bug in our own code is not.
export function notifyError(
  title: string,
  e?: unknown,
  { fixable = false, source = "app" } = {},
) {
  if (e === undefined) {
    toast.error(title);
    return;
  }
  logError(source, title, e);
  const description = errorMessage(e);
  toast.error(title, {
    description,
    // Stack traces and shell output run long — clamp so the toast can't eat
    // the screen. The full text goes to the assistant via "Fix it".
    classNames: { description: "line-clamp-4" },
    action: fixable
      ? {
          label: "Fix it",
          // Hash assignment, not useNavigate: this is callable from anywhere,
          // including the global error handlers, which aren't in a router
          // context.
          onClick: () => {
            const prompt = `Fix this error: ${title}\n\n${description}`;
            window.location.hash = `#/assistant?prompt=${encodeURIComponent(prompt)}`;
          },
        }
      : undefined,
  });
}

export function notifySuccess(title: string, description?: string) {
  toast.success(title, description ? { description } : undefined);
}

// Safety net for what escapes a try/catch — without it those only ever land in
// the devtools console, which nobody has open in a packaged desktop app.
export function installGlobalErrorToasts() {
  window.addEventListener("unhandledrejection", (event) =>
    notifyError("Something went wrong", event.reason),
  );
  window.addEventListener("error", (event) =>
    notifyError("Something went wrong", event.error ?? event.message),
  );
}

// Native OS notifications for when the agent needs the user and they're in
// another app. The OS draws them with the app's own icon (bundle icon on macOS,
// the exe's icon on Windows). Permission is asked once at startup, while the
// user is looking at the app, not the first time they're away from it.
let osReady: Promise<boolean> | null = null;

export function initOsNotifications() {
  osReady ??= (async () => {
    await InitializeNotifications();
    return (await CheckNotificationAuthorization()) || RequestNotificationAuthorization();
  })().catch(() => false); // `wails dev` has no bundle id, so no notifications there
  return osReady;
}

export async function notifyIfAway(title: string, body?: string) {
  if (document.hasFocus() || !(await initOsNotifications())) return;
  SendNotification({ id: crypto.randomUUID(), title, body }).catch(() => {});
}
