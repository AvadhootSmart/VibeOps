import {
  BrowserOpenURL,
  ClipboardGetText,
  ClipboardSetText,
} from "@wails/runtime/runtime";

export const isExternal = (url: string) => /^(https?|mailto):/i.test(url);

// window.runtime is injected by Wails; under a bare `vite dev` there is none,
// so every bridge checks at call time rather than at install time — the
// install used to run before the runtime existed and silently did nothing.
const inWebview = () => Boolean(window.runtime);

const native = navigator.clipboard;

// The webview has no Clipboard API (not a secure context) and drops
// window.open / target="_blank" on the floor, so every copy button and every
// link rendered by streamdown (or anything else) is dead. Route both through
// the Wails runtime once, here, instead of patching each component.
export function installWebviewBridges() {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      readText: () => (inWebview() ? ClipboardGetText() : native.readText()),
      writeText: async (text: string) => {
        if (!inWebview()) return native.writeText(text);
        // Reject on failure: the copy buttons flip to a tick on a resolved
        // promise, so a silent resolve would tick on a copy that never landed.
        if (!(await ClipboardSetText(text))) {
          throw new Error("Clipboard write failed");
        }
      },
    },
  });

  const openExternal = window.open.bind(window);
  window.open = ((url?: string | URL, ...rest: unknown[]) => {
    if (url && inWebview()) {
      BrowserOpenURL(String(url));
      return null;
    }
    return (openExternal as (...a: unknown[]) => Window | null)(url, ...rest);
  }) as typeof window.open;

  document.addEventListener("click", (e) => {
    const link = (e.target as HTMLElement | null)?.closest?.("a[href]");
    const href = link?.getAttribute("href");
    if (!href || !isExternal(href) || !inWebview()) return;
    e.preventDefault();
    BrowserOpenURL(href);
  });
}
