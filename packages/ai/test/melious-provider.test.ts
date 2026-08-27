import { describe, expect, it } from "vitest";
import type { RefreshModelsContext } from "../src/models.ts";
import { builtinProviders } from "../src/providers/all.ts";
import { DEFAULT_MELIOUS_BASE_URL, meliousProvider } from "../src/providers/melious.ts";

function refreshContext(overrides: Partial<RefreshModelsContext> = {}): RefreshModelsContext {
	return {
		allowNetwork: true,
		signal: new AbortController().signal,
		publish: async () => true,
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
