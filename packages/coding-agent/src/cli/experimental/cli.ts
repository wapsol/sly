import { type ClientCommandContext, clientCommand } from "./commands/client.ts";
import { piCommand, type SlyCommandContext } from "./commands/pi.ts";
import { type ServerCommandContext, serverCommand } from "./commands/server.ts";

export type ExperimentalCliContext = SlyCommandContext & ServerCommandContext & ClientCommandContext;

export const experimentalCli = piCommand.command(serverCommand).command(clientCommand);
