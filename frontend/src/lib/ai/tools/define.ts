import { tool, jsonSchema, type Tool, type ToolExecutionOptions } from "ai";

// CONTEXT is `any` to match the shape ToolSet's index signature accepts; the
// executes here only ever read abortSignal off this.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExecuteOptions = ToolExecutionOptions<any>;
import manifest from "./manifest.json";

// manifest.json is the single definition of every VibeOps tool's name,
// description and input schema. Both agent modes read it: this file builds the
// AI-SDK tools from it, and the Go MCP server (backend/mcp) embeds the same
// file to serve tools/list to the Claude Code harness. Adding a tool to one
// harness but not the other, or letting their wording drift, was the failure
// this replaced.
export const TOOL_MANIFEST = manifest;

export type ToolName = (typeof manifest)[number]["name"];

// The runtime contract is the manifest's JSON Schema; Input is just the local
// annotation for the execute body, so keep the two in step by hand.
export function defineTool<Input = Record<string, never>>(
  name: ToolName,
  execute: (input: Input, options: ExecuteOptions) => PromiseLike<unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Tool<Input, unknown, any> {
  const def = manifest.find((d) => d.name === name);
  if (!def) throw new Error(`no manifest entry for tool "${name}"`);
  return tool({
    description: def.description,
    inputSchema: jsonSchema<Input>(
      def.inputSchema as Parameters<typeof jsonSchema>[0],
    ),
    execute,
  });
}
