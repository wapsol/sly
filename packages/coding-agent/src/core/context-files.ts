import { APP_NAME } from "../config.ts";

/**
 * Context filenames looked for in each directory, most specific first.
 *
 * RETROFIT: the brand's own file leads, and `CLAUDE.md` is not read at all --
 * this agent takes its instructions from a file addressed to it, not from one
 * written for a different tool. `AGENTS.md` stays because it is the cross-tool
 * convention and this repo carries one.
 *
 * Only the FIRST match in a directory is loaded, so a project holding both
 * `<brand>.md` and `AGENTS.md` contributes the brand file alone.
 *
 * This lives in its own leaf module, importing nothing but `config.ts`, because
 * both `resource-loader.ts` and `core/tools/read.ts` need it and those two are
 * already in an import cycle: putting the list in either one makes the other
 * read it before initialization, which fails at runtime in source mode while
 * the bundler quietly hoists the problem away.
 */
export const CONTEXT_FILE_CANDIDATES: readonly string[] = [
	`${APP_NAME}.override.md`,
	`${APP_NAME}.md`,
	"AGENTS.override.md",
	"AGENTS.md",
	"AGENTS.MD",
];
