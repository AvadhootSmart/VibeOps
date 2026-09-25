import { Read } from "@wails/go/skills/Skills";
import { defineTool } from "./define";

export const useSkillTool = defineTool<{ name: string }>(
  "useSkill",
  async ({ name }) => (await Read(name)) || `No skill named "${name}".`,
);
