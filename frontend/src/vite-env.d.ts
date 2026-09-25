/// <reference types="vite/client" />

// Injected by Wails into the webview; absent under a bare `vite dev`.
declare global {
  interface Window {
    runtime?: unknown;
  }
}
export {};
