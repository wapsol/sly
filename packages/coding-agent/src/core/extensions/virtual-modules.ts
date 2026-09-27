import * as bundledSlyAgentCore from "@earendil-works/pi-agent-core";
import * as bundledSlyAiCompat from "@earendil-works/pi-ai/compat";
import * as bundledSlyAiOauth from "@earendil-works/pi-ai/oauth";
import * as bundledSlyAiProviders from "@earendil-works/pi-ai/providers/all";
import * as bundledSlyTui from "@earendil-works/pi-tui";
import * as bundledTypebox from "typebox";
import * as bundledTypeboxCompile from "typebox/compile";
import * as bundledTypeboxValue from "typebox/value";
// This import is safe because loader.ts exports are not re-exported from index.ts.
// Extensions can therefore import from @earendil-works/pi-coding-agent.
import * as bundledSlyCodingAgent from "../../index.ts";

/** Modules available to extensions in source and compiled binary runtimes. */
export const VIRTUAL_MODULES: Record<string, unknown> = {
	typebox: bundledTypebox,
	"typebox/compile": bundledTypeboxCompile,
	"typebox/value": bundledTypeboxValue,
	"@sinclair/typebox": bundledTypebox,
	"@sinclair/typebox/compile": bundledTypeboxCompile,
	"@sinclair/typebox/value": bundledTypeboxValue,
	"@earendil-works/pi-agent-core": bundledSlyAgentCore,
	"@earendil-works/pi-tui": bundledSlyTui,
	// Extensions resolve the pi-ai root to the compat entrypoint (a strict
	// superset of the core entrypoint): existing extensions using the old
	// global API keep working at runtime until compat is removed.
	"@earendil-works/pi-ai": bundledSlyAiCompat,
	"@earendil-works/pi-ai/compat": bundledSlyAiCompat,
	"@earendil-works/pi-ai/oauth": bundledSlyAiOauth,
	"@earendil-works/pi-ai/providers/all": bundledSlyAiProviders,
	"@earendil-works/pi-coding-agent": bundledSlyCodingAgent,
	"@mariozechner/pi-agent-core": bundledSlyAgentCore,
	"@mariozechner/pi-tui": bundledSlyTui,
	"@mariozechner/pi-ai": bundledSlyAiCompat,
	"@mariozechner/pi-ai/compat": bundledSlyAiCompat,
	"@mariozechner/pi-ai/oauth": bundledSlyAiOauth,
	"@mariozechner/pi-ai/providers/all": bundledSlyAiProviders,
	"@mariozechner/pi-coding-agent": bundledSlyCodingAgent,
};
