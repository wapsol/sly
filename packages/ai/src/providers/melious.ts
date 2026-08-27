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
 * Map one `/v1/models` entry onto a `Model`. The endpoint is only required to
 * supply `id`; everything else falls back to values that are safe to be wrong
 * (cost 0 shows an unpriced model rather than a misleading price, and the
 * context window can be overridden per model in `models.json`).
 */
function toModel(
	entry: NonNullable<MeliousModelsResponse["data"]>[number],
	baseUrl: string,
): Model<"openai-completions"> | undefined {
	if (!entry?.id) return undefined;
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
	return (body.data ?? [])
		.map((entry) => toModel(entry, baseUrl))
		.filter((model): model is Model<"openai-completions"> => model !== undefined);
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
