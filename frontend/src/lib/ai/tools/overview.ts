import { GenerateOverview } from "@wails/go/overview/Overview";
import { defineTool } from "./define";

export const generateOverviewTool = defineTool<Record<string, unknown>>(
  "generateOverview",
  async (data) => {
    await GenerateOverview(JSON.stringify(data));
    return "Overview updated.";
  },
);
