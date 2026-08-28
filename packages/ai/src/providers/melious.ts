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
 * context window, no pricing, no modality -- so every other field is a fallback.
 * They are chosen to be safe when wrong: cost 0 shows an unpriced model rather
 * than a misleading price, and the context window is deliberately conservative.
 * Tune either per model with `modelOverrides` in the agent's `models.json`.
 */
function toModel(
	entry: NonNullable<MeliousModelsResponse["data"]>[number],
	baseUrl: string,
): Model<"openai-completions"> | undefined {
	if (!entry?.id || !isChatModel(entry.id)) return undefined;
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
		contextWindow: entry.context_window ?? entry.context_length ?? 128_000,
		maxTokens: entry.max_output_tokens ?? entry.max_tokens ?? 8_192,
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
