import { describe, expect, it } from "vitest";
import type { RefreshModelsContext } from "../src/models.ts";
import { builtinProviders } from "../src/providers/all.ts";
import {
	DEFAULT_MELIOUS_BASE_URL,
	DEFAULT_MELIOUS_CONTEXT_WINDOW,
	DEFAULT_MELIOUS_MAX_TOKENS,
	MELIOUS_MODEL_SPECS,
	meliousProvider,
} from "../src/providers/melious.ts";

function refreshContext(overrides: Partial<RefreshModelsContext> = {}): RefreshModelsContext {
	return {
		allowNetwork: true,
		signal: new AbortController().signal,
		// The real runtime applies the update after persisting; a publish stub that
		// only returns true leaves getModels() empty and hides mapping bugs.
		publish: async (publication) => {
			publication.update?.();
			return true;
		},
		...overrides,
	} as RefreshModelsContext;
}

describe("melious provider", () => {
	it("is registered as a builtin with an empty static catalog", () => {
		const provider = builtinProviders().find((candidate) => candidate.id === "melious");
		expect(provider).toBeDefined();
		expect(provider?.name).toBe("Melious");
		expect(provider?.baseUrl).toBe(DEFAULT_MELIOUS_BASE_URL);
		// The catalog is dynamic: nothing is known until the gateway is listed.
		expect(provider?.getModels()).toEqual([]);
		expect(provider?.refreshModels).toBeDefined();
	});

	it("maps an OpenAI-compatible /models listing onto models", async () => {
		const calls: Array<{ url: string; auth: string | null }> = [];
		const original = globalThis.fetch;
		globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
			calls.push({ url, auth: new Headers(init?.headers).get("Authorization") });
			return Response.json({
				data: [
					{ id: "melious-large", display_name: "Melious Large", context_window: 200000, max_output_tokens: 16000 },
					{ id: "melious-small", pricing: { prompt: "0.5", completion: "1.5" } },
					{ notAModel: true },
				],
			});
		}) as typeof globalThis.fetch;

		try {
			const provider = meliousProvider();
			let published: unknown;
			await provider.refreshModels?.(
				refreshContext({
					credential: { type: "api_key", key: "test-melious-key" },
					publish: async (publication) => {
						published = publication.persist?.models;
						publication.update?.();
						return true;
					},
				}),
			);

			expect(calls[0]?.url).toBe(`${DEFAULT_MELIOUS_BASE_URL}/models`);
			expect(calls[0]?.auth).toBe("Bearer test-melious-key");

			const models = provider.getModels();
			expect(models.map((model) => model.id)).toEqual(["melious-large", "melious-small"]);
			expect(published).toEqual(models);

			const large = models[0];
			expect(large.provider).toBe("melious");
			expect(large.api).toBe("openai-completions");
			expect(large.name).toBe("Melious Large");
			expect(large.contextWindow).toBe(200000);
			expect(large.maxTokens).toBe(16000);

			const small = models[1];
			expect(small.name).toBe("melious-small");
			expect(small.cost).toEqual({ input: 0.5, output: 1.5, cacheRead: 0, cacheWrite: 0 });
		} finally {
			globalThis.fetch = original;
		}
	});

	it("drops embedding, speech, image and guard models from the listing", async () => {
		const original = globalThis.fetch;
		globalThis.fetch = (async () =>
			Response.json({
				data: [
					{ id: "kimi-k2.7-code" },
					{ id: "qwen3-coder-next" },
					{ id: "bge-m3" },
					{ id: "multilingual-e5-large" },
					{ id: "qwen3-embedding-8b" },
					{ id: "paraphrase-multilingual-mpnet" },
					{ id: "whisper-large-v3" },
					{ id: "faster-whisper-large-v3" },
					{ id: "voxtral-small-24b-2507" },
					{ id: "flux-2-dev" },
					{ id: "qwen-image" },
					{ id: "qwen3guard-gen-8b" },
				],
			})) as typeof globalThis.fetch;

		try {
			const provider = meliousProvider();
			await provider.refreshModels?.(refreshContext({ credential: { type: "api_key", key: "test-melious-key" } }));
			// Melious serves every modality from one endpoint and reports none of it,
			// so the non-chat ids are excluded by name or they land in the model picker.
			expect(provider.getModels().map((model) => model.id)).toEqual(["kimi-k2.7-code", "qwen3-coder-next"]);
		} finally {
			globalThis.fetch = original;
		}
	});

	it("throws rather than emptying the catalog when the gateway rejects the key", async () => {
		const original = globalThis.fetch;
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ error: { message: "Invalid API key format" } }), {
				status: 401,
			})) as typeof globalThis.fetch;

		try {
			const provider = meliousProvider();
			await expect(
				provider.refreshModels?.(refreshContext({ credential: { type: "api_key", key: "bad" } })),
			).rejects.toThrow(/401/);
			expect(provider.getModels()).toEqual([]);
		} finally {
			globalThis.fetch = original;
		}
	});

	it("does not call the gateway without a credential", async () => {
		const original = globalThis.fetch;
		const previousEnv = process.env.MELIOUS_API_KEY;
		delete process.env.MELIOUS_API_KEY;
		let called = false;
		globalThis.fetch = (async () => {
			called = true;
			return Response.json({ data: [] });
		}) as typeof globalThis.fetch;

		try {
			const provider = meliousProvider();
			await provider.refreshModels?.(refreshContext());
			expect(called).toBe(false);
		} finally {
			globalThis.fetch = original;
			if (previousEnv !== undefined) process.env.MELIOUS_API_KEY = previousEnv;
		}
	});
});

describe("melious model capacities", () => {
	/** List the given bare ids through the provider and return the mapped models. */
	async function listModels(entries: Array<Record<string, unknown>>) {
		const original = globalThis.fetch;
		globalThis.fetch = (async () => Response.json({ data: entries })) as typeof globalThis.fetch;
		try {
			const provider = meliousProvider();
			await provider.refreshModels?.(refreshContext({ credential: { type: "api_key", key: "k" } }));
			return provider.getModels();
		} finally {
			globalThis.fetch = original;
		}
	}

	it("resolves a listed id from the shipped spec table", async () => {
		// The gateway sends nothing but the id, which is the whole reason the table exists.
		const [glm, mistral] = await listModels([{ id: "glm-5.3-flash" }, { id: "mistral-small-3.2-24b-instruct" }]);
		expect(glm.contextWindow).toBe(1_000_000);
		expect(glm.maxTokens).toBe(128_000);
		expect(mistral.contextWindow).toBe(131_072);
		expect(mistral.maxTokens).toBe(16_384);
	});

	it("keeps the conservative output cap when the table states no maxTokens", async () => {
		const [gemma] = await listModels([{ id: "gemma-4-31b" }]);
		expect(gemma.contextWindow).toBe(262_144);
		expect(gemma.maxTokens).toBe(DEFAULT_MELIOUS_MAX_TOKENS);
	});

	it("assumes a large context for an id the table does not list", async () => {
		const [unknown] = await listModels([{ id: "some-model-shipped-tomorrow" }]);
		expect(unknown.contextWindow).toBe(DEFAULT_MELIOUS_CONTEXT_WINDOW);
		expect(unknown.maxTokens).toBe(DEFAULT_MELIOUS_MAX_TOKENS);
	});

	it("lets the listing override the table if the gateway ever reports capacities", async () => {
		// glm-5.3-flash is in the table at 1M; the gateway saying otherwise must win, so
		// a future API change takes effect without editing the table.
		const [glm] = await listModels([{ id: "glm-5.3-flash", context_window: 32_768, max_output_tokens: 4_096 }]);
		expect(glm.contextWindow).toBe(32_768);
		expect(glm.maxTokens).toBe(4_096);
	});

	it("agrees with the spec table for every id it lists", async () => {
		const ids = Object.keys(MELIOUS_MODEL_SPECS);
		const models = await listModels(ids.map((id) => ({ id })));
		expect(models).toHaveLength(ids.length);
		for (const model of models) {
			const spec = MELIOUS_MODEL_SPECS[model.id];
			expect(model.contextWindow).toBe(spec.contextWindow);
			expect(model.maxTokens).toBe(spec.maxTokens ?? DEFAULT_MELIOUS_MAX_TOKENS);
		}
	});
});
