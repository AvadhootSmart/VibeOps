import { GetCwd } from "@wails/go/tools/Tool";
import { defineTool } from "./define";

export const getCwdTool = defineTool("getCwd", async () => ({
  path: await GetCwd(),
}));
