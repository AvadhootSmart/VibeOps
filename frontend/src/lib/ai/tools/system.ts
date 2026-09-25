import { GetSystemInfo } from "@wails/go/tools/Tool";
import { defineTool } from "./define";

export const systemInfoTool = defineTool("getSystemInfo", async () => {
  const json = await GetSystemInfo(); // webview -> Wails -> Go
  return JSON.parse(json) as Record<string, unknown>;
});
