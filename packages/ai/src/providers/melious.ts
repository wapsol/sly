import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider, type RefreshModelsContext } from "../models.ts";
import type { Model } from "../types.ts";

/**
 * Melious gateway. OpenAI-compatible chat completions.
 *
 * RETROFIT: added by the retrofit-pi skill, not present upstream.
 *
 * The catalog is dynamic rather than generated. Melious is not on models.dev,
 * so there is no upstream shard to emit and nothing for
 * `scripts/generate-models.ts` to produce -- and a hand-written
 * `melious.models.ts` would be deleted by the next generator run, which removes
 * any `*.models.ts` it did not itself emit. Instead the provider ships empty and
 * fills itself from `GET <baseUrl>/models` on refresh, the same shape `radius`
 * used upstream. `createProvider` restores the persisted catalog from the models
 * store first, so an offline start still sees the models from last time.
 */

export const DEFAULT_MELIOUS_BASE_URL = "https://api.melious.ai/v1";

/** Env vars consulted for the API key, in order. */
export const MELIOUS_API_KEY_ENV = "MELIOUS_API_KEY";

/**
 * The listing carries no modality field, so non-chat models are excluded by id.
 * Melious serves embeddings, speech, image generation and guard classifiers from
 * the same `/v1/models` endpoint as its chat models; registering those would put
 * ~20 entries in the model picker that cannot answer a prompt.
 */
export const MELIOUS_NON_CHAT_ID_PATTERNS: readonly RegExp[] = [
	/^bge-/, // embeddings
	/^multilingual-e5-/,
	/^paraphrase-/,
	/-embedding-/,
	/whisper/, // speech to text
	/^voxtral-/,
	/^flux-/, // image generation
	/^qwen-image/,
	/guard/, // safety classifiers
];

function isChatModel(id: string): boolean {
	return !MELIOUS_NON_CHAT_ID_PATTERNS.some((pattern) => pattern.test(id));
}

/**
 * Per-model capacities, because the gateway will not serve them.
 *
 * `/v1/models` returns four fields -- `id`, `object`, `created`, `owned_by` -- and
 * `/v1/models/<id>` adds nothing but a real vendor name. There is no context window
 * anywhere in the API, no published table on melious.ai, and an over-long request is
 * rejected with a generic "malformed" error rather than one naming the limit. So these
 * come from each vendor's own model card and are **maintained, not derived**: a new
 * curated id needs a lookup, and `owned_by` on the per-model endpoint is what to look it
 * up against (ZAI, Moonshot, Deepseek, MiniMax, Mistral, Qwen, Google, Meta, NVIDIA).
 *
 * `maxTokens` is omitted where the vendor does not state one. Leaving it at the 8_192
 * default costs a long answer occasionally; guessing high gets the request rejected
 * outright, which is the worse failure.
 */
export const MELIOUS_MODEL_SPECS: Readonly<Record<string, { contextWindow: number; maxTokens?: number }>> = {
	// ZAI -- the GLM-5 series is the 1M-context family.
	"glm-5.2": { contextWindow: 1_000_000, maxTokens: 131_072 },
	"glm-5.3": { contextWindow: 1_000_000 },
	"glm-5.3-flash": { contextWindow: 1_000_000, maxTokens: 128_000 },
	// Deepseek -- V4 is the other 1M family.
	"deepseek-v4.1-flash": { contextWindow: 1_000_000, maxTokens: 384_000 },
	"deepseek-v4-pro": { contextWindow: 1_000_000, maxTokens: 384_000 },
	"deepseek-v4-pro-0813": { contextWindow: 1_000_000, maxTokens: 384_000 },
	"deepseek-v4-flash-0731": { contextWindow: 1_000_000, maxTokens: 384_000 },
	// Moonshot -- K3 is 1M, but K2.7 is not. Do not generalise across a vendor.
	"kimi-k3": { contextWindow: 1_048_576 },
	"kimi-k2.7-code": { contextWindow: 262_144 },
	// MiniMax -- M3 is 1M; M2.7's 204,800 is input and output combined, per their docs.
	"minimax-m3": { contextWindow: 1_048_576, maxTokens: 262_144 },
	"minimax-m2.7": { contextWindow: 204_800, maxTokens: 131_072 },
	// NVIDIA
	"nemotron-3-nano-30b-a3b": { contextWindow: 1_048_576 },
	// Qwen -- 256K native; 1M only with YaRN, which the gateway does not advertise.
	"qwen3-coder-next": { contextWindow: 262_144, maxTokens: 262_144 },
	"qwen3-coder-30b-a3b-instruct": { contextWindow: 262_144 },
	"qwen3.8-27b": { contextWindow: 262_144 },
	// Google
	"gemma-4-31b": { contextWindow: 262_144 },
	// Mistral -- sources disagree on Devstral 2's output cap (8K vs 262K), so it is left
	// to the default rather than guessed.
	"devstral-2-123b-instruct-2512": { contextWindow: 262_144 },
	"mistral-small-3.2-24b-instruct": { contextWindow: 131_072, maxTokens: 16_384 },
	"pixtral-12b-2409": { contextWindow: 131_072 },
	// Meta
	"llama-3.1-8b-instruct": { contextWindow: 131_072 },
	"llama-3.1-405b-instruct": { contextWindow: 131_072 },
	"llama-3.3-70b-instruct": { contextWindow: 131_072 },
	"muse-glimmer": { contextWindow: 131_072 },
	// H Company -- publishes no context figure for Holo2. It is a computer-use grounding
	// model built on Qwen3-VL, and its successor Holo3 ships 64K, so this is a deliberately
	// low placeholder rather than a spec. Raise it if H Company ever states one; leaving it
	// on the 1M default would be the one number we know is wrong.
	"holo2-30b-a3b": { contextWindow: 131_072 },
};

/**
 * Assumed context window for an id the table does not cover.
 *
 * The gateway's line-up is mostly long-context models, so this is the useful default --
 * but it is a guess, and the optimistic direction: a model that is really 128K will let
 * the agent fill far past its limit and then fail the request outright, with
 * auto-compaction never triggering. Add an entry above rather than relying on it.
 */
export const DEFAULT_MELIOUS_CONTEXT_WINDOW = 1_000_000;

/** Assumed output cap. Conservative on purpose -- see the note on MELIOUS_MODEL_SPECS. */
export const DEFAULT_MELIOUS_MAX_TOKENS = 8_192;

/**
 * Optional comma-separated allow-list of model ids.
 *
 * `/v1/models` advertises more than the gateway can route: on the reference run
 * only 12 of 52 chat models answered a completion, the rest returning
 * `No providers match the specified filters`. There is no way to tell from the
 * listing, and probing every model on each refresh would mean dozens of billable
 * completions, so the allow-list is supplied out of band -- the retrofit-pi skill
 * probes once at install time and writes the result next to the API key.
 *
 * Unset means "trust the listing", which is the honest default: the gateway is
 * the authority on what exists, and a model can start working at any time.
 */
export const MELIOUS_MODELS_ENV = "MELIOUS_MODELS";

function allowedModelIds(): ReadonlySet<string> | undefined {
	const raw = process.env[MELIOUS_MODELS_ENV]?.trim();
	if (!raw) return undefined;
	const ids = raw
		.split(",")
		.map((id) => id.trim())
		.filter((id) => id.length > 0);
	return ids.length > 0 ? new Set(ids) : undefined;
}

/** What `GET /v1/models` returns on an OpenAI-compatible endpoint. */
interface MeliousModelsResponse {
	data?: Array<{
		id?: string;
		display_name?: string;
		context_window?: number;
		context_length?: number;
		max_tokens?: number;
		max_output_tokens?: number;
		reasoning?: boolean;
		pricing?: { prompt?: number | string; completion?: number | string };
	}>;
}

function toNumber(value: number | string | undefined): number {
	const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
	return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Map one `/v1/models` entry onto a `Model`, or drop it when it is not a chat
 * model.
 *
 * In practice Melious sends only `id`, `object`, `created` and `owned_by` -- no
 * context window, no pricing, no modality -- so every other field is supplied here.
 * Cost stays 0, which shows an unpriced model rather than a misleading price.
 * Capacities come from MELIOUS_MODEL_SPECS, falling back to
 * DEFAULT_MELIOUS_CONTEXT_WINDOW for an id the table does not list.
 *
 * The listing still wins where it has something to say, so the day Melious starts
 * sending real values they take effect without a code change. Above all of it,
 * `modelOverrides` in the agent's `models.json` remains the per-machine override --
 * provider-composer applies it as the topmost layer, so it beats this table.
 */
function toModel(
	entry: NonNullable<MeliousModelsResponse["data"]>[number],
	baseUrl: string,
): Model<"openai-completions"> | undefined {
	if (!entry?.id || !isChatModel(entry.id)) return undefined;
	const spec = MELIOUS_MODEL_SPECS[entry.id];
	return {
		id: entry.id,
		name: entry.display_name ?? entry.id,
		api: "openai-completions",
		provider: "melious",
		baseUrl,
		reasoning: entry.reasoning ?? false,
		input: ["text"],
		cost: {
			input: toNumber(entry.pricing?.prompt),
			output: toNumber(entry.pricing?.completion),
			cacheRead: 0,
			cacheWrite: 0,
		},
		contextWindow:
			entry.context_window ?? entry.context_length ?? spec?.contextWindow ?? DEFAULT_MELIOUS_CONTEXT_WINDOW,
		maxTokens: entry.max_output_tokens ?? entry.max_tokens ?? spec?.maxTokens ?? DEFAULT_MELIOUS_MAX_TOKENS,
	};
}

async function fetchMeliousModels(
	baseUrl: string,
	context: RefreshModelsContext,
): Promise<readonly Model<"openai-completions">[]> {
	const key = context.credential?.type === "api_key" ? context.credential.key : process.env[MELIOUS_API_KEY_ENV];
	if (!key) return [];

	const response = await fetch(`${baseUrl}/models`, {
		headers: { Authorization: `Bearer ${key}` },
		signal: context.signal,
	});
	if (!response.ok) {
		// A bad or missing key must not wipe a catalog that already works.
		throw new Error(
			`Melious model listing failed: ${response.status} ${await response.text().catch(() => "")}`.trim(),
		);
	}
	const body = (await response.json()) as MeliousModelsResponse;
	const allowed = allowedModelIds();
	return (body.data ?? [])
		.map((entry) => toModel(entry, baseUrl))
		.filter((model): model is Model<"openai-completions"> => model !== undefined)
		.filter((model) => !allowed || allowed.has(model.id));
}

export interface MeliousProviderOptions {
	/** Override the gateway, e.g. a self-hosted Melious. Defaults to the public one. */
	baseUrl?: string;
}

export function meliousProvider(options: MeliousProviderOptions = {}): Provider<"openai-completions"> {
	const baseUrl = (options.baseUrl ?? process.env.MELIOUS_BASE_URL ?? DEFAULT_MELIOUS_BASE_URL).replace(/\/+$/, "");
	return createProvider({
		id: "melious",
		name: "Melious",
		baseUrl,
		auth: { apiKey: envApiKeyAuth("Melious API key", [MELIOUS_API_KEY_ENV]) },
		models: [],
		fetchModels: (context) => fetchMeliousModels(baseUrl, context),
		api: openAICompletionsApi(),
	});
}
