import { defineTool } from "./define";

// Both of these are render-only: the argument the model passes IS the card the
// user sees, drawn by the assistant transcript from the tool step's input
// (components/custom/deployment/). Nothing runs, so there is no Go side beyond
// the MCP server echoing the same acknowledgement back to a harness CLI.
const SHOWN =
  "Shown to the user as a card. Do not repeat its contents in your reply.";

export const proposeProvidersTool = defineTool<unknown>(
  "proposeProviders",
  async () => `${SHOWN} Now stop and wait for them to confirm or change the picks.`,
);

export const proposePlanTool = defineTool<unknown>(
  "proposePlan",
  async () =>
    `${SHOWN} The card carries the approve button, so stop here and run nothing until the user answers.`,
);
