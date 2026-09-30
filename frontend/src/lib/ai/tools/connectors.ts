import { CheckAll } from "@wails/go/connectors/Connectors";
import { defineTool } from "./define";

export const listConnectorsTool = defineTool("listConnectors", async () =>
  JSON.stringify(await CheckAll()),
);
