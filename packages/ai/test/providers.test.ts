import { describe, expect, it } from "vitest";
import type { AuthContext } from "../src/auth/types.ts";
import { getModel as getCompatModel, getModels as getCompatModels } from "../src/compat.ts";
import { createModels } from "../src/models.ts";
import {
	builtinModels,
	builtinProviders,
	getAllBuiltinModels,
	getBuiltinClassifierModel,
	getBuiltinClassifierModels,
	getBuiltinImageModel,
	getBuiltinImageModels,
	getBuiltinModel,
	getBuiltinModels,
} from "../src/providers/all.ts";
import { anthropicProvider } from "../src/providers/anthropic.ts";

function fakeAuthContext(env: Record<string, string>, files: string[] = []): AuthContext {
	return {
		env: async (name) => env[name],
		fileExists: async (path) => files.includes(path),
	};
}

const _neverAbortedSignal = new AbortController().signal;

describe("builtin providers", () => {
	it("builtinModels registers every builtin provider with models", async () => {
		const models = builtinModels();
		const providers = models.getProviders();
		expect(providers.length).toBe(builtinProviders().length);
		expect(providers.map((p) => p.id)).toContain("anthropic");

		const anthropic = models.getModel("anthropic", "claude-haiku-4-5");
		expect(anthropic?.api).toBe("anthropic-messages");

		const all = models.getModels();
		// RETROFIT: three built-in providers remain (anthropic, huggingface, openrouter).
		expect(all.length).toBeGreaterThan(300);

		// Static providers list models immediately; Melious is purely dynamic and
		// stays empty until its gateway is listed.
		for (const provider of providers) {
			const list = models.getModels(provider.id);
			if (provider.id === "melious") expect(list).toEqual([]);
			else expect(list.length).toBeGreaterThan(0);
			expect(list.every((m) => m.provider === provider.id)).toBe(true);
		}
	});

	it("returns empty results for unknown provider ids", () => {
		const unknownProvider = "not-a-provider" as never;
		const unknownModel = "x" as never;

		expect(getBuiltinModel(unknownProvider, unknownModel)).toBeUndefined();
		expect(getBuiltinImageModel(unknownProvider, unknownModel)).toBeUndefined();
		expect(getBuiltinClassifierModel(unknownProvider, unknownModel)).toBeUndefined();
		expect(getBuiltinModels(unknownProvider)).toEqual([]);
		expect(getBuiltinImageModels(unknownProvider)).toEqual([]);
		expect(getBuiltinClassifierModels(unknownProvider)).toEqual([]);
		expect(getAllBuiltinModels(unknownProvider)).toEqual([]);
		expect(getCompatModel(unknownProvider, unknownModel)).toBeUndefined();
		expect(getCompatModels(unknownProvider)).toEqual([]);
	});

	it("resolves Anthropic bearer auth from env with auth token precedence", async () => {
		const models = createModels({
			authContext: fakeAuthContext({
				ANTHROPIC_AUTH_TOKEN: "auth-token",
				ANTHROPIC_OAUTH_TOKEN: "oauth-token",
				ANTHROPIC_API_KEY: "api-key",
			}),
		});
		models.setProvider(anthropicProvider());

		expect(await models.getAuth("anthropic")).toEqual({
			auth: { headers: { Authorization: "Bearer auth-token" } },
			source: "ANTHROPIC_AUTH_TOKEN",
		});
	});

	it("preserves Anthropic OAuth token precedence over the API key", async () => {
		const models = createModels({
			authContext: fakeAuthContext({ ANTHROPIC_API_KEY: "key", ANTHROPIC_OAUTH_TOKEN: "oauth-token" }),
		});
		models.setProvider(anthropicProvider());

		const result = await models.getAuth("anthropic");
		expect(result?.auth.apiKey).toBe("oauth-token");
		expect(result?.source).toBe("ANTHROPIC_OAUTH_TOKEN");
	});
});
