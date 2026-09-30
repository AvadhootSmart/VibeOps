import { systemInfoTool } from "./system";
import { getCwdTool } from "./directory";
import { ShellAccessTool } from "./terminal";
import { askQuestionTool } from "./ask";
import {
  SshConnectTool,
  SshRunTool,
  SshDisconnectTool,
  getAllowedServers,
} from "./ssh";
import { useSkillTool } from "./skills";
import { generateOverviewTool } from "./overview";
import { SudoAuthTool, SecretRequestTool } from "./secrets";
import { proposeProvidersTool, proposePlanTool } from "./deployment";
import { listConnectorsTool } from "./connectors";

// Central tool registry passed to the agent. To add a tool: create a file in
// this folder exporting a `tool({...})`, then register it here under the name
// the model should call it by.
export const tools = {
  getSystemInfo: systemInfoTool,
  getCwd: getCwdTool,
  shellAccess: ShellAccessTool,
  askQuestion: askQuestionTool,
  sshConnect: SshConnectTool,
  sshRun: SshRunTool,
  sshDisconnect: SshDisconnectTool,
  sudoAuth: SudoAuthTool,
  secretRequest: SecretRequestTool,
  getAllowedServers: getAllowedServers,
  useSkill: useSkillTool,
  generateOverview: generateOverviewTool,
  listConnectors: listConnectorsTool,
  proposeProviders: proposeProvidersTool,
  proposePlan: proposePlanTool,
} as const;
