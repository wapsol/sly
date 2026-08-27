import { describe, expect, it } from "vitest";
import type { AuthContext } from "../src/auth/types.ts";
import { createImagesProvider, type ImagesProvider } from "../src/images-models.ts";
import { builtinImagesModels } from "../src/providers/all.ts";
import type { AssistantImages, ImagesApi, ImagesContext, ImagesModel, ImagesOptions } from "../src/types.ts";

function fakeAuthContext(env: Record<string, string>): AuthContext {
	return {
		env: async (name) => env[name],
		fileExists: async () => false,
	};
}

function testImageModel(provider: string, id: string): ImagesModel<ImagesApi> {
	return {
		id,
		name: id,
		api: "test-images",
		provider,
		baseUrl: "https://example.test/v1",
		input: ["text"],
		output: ["image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	};
}

function okResult(model: ImagesModel<ImagesApi>): AssistantImages {
	return {
		api: model.api,
		provider: model.provider,
		model: model.id,
		output: [{ type: "image", data: "aGk=", mimeType: "image/png" }],
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

interface GenerateCall {
	model: ImagesModel<ImagesApi>;
	options: ImagesOptions | undefined;
}

function _testProvider(input: {
	id: string;
	models?: ImagesModel<ImagesApi>[];
	envVar?: string;
	calls?: GenerateCall[];
}): ImagesProvider {
	return createImagesProvider({
		id: input.id,
		auth: {
			apiKey: {
				name: "Test key",
				resolve: async ({ ctx, credential }) => {
					if (!input.envVar) return { auth: {} };
					const key = credential?.key ?? (await ctx.env(input.envVar));
					return key ? { auth: { apiKey: key }, source: credential ? "stored" : input.envVar } : undefined;
				},
			},
		},
		models: input.models ?? [testImageModel(input.id, "model-a")],
		api: {
			generateImages: async (model, _context, options) => {
				input.calls?.push({ model, options });
				return okResult(model);
			},
		},
	});
}

const _context: ImagesContext = { input: [{ type: "text", text: "a red circle" }] };

describe("ImagesModels", () => {
	it("builtinImagesModels registers the openrouter provider with its catalog", async () => {
		const models = builtinImagesModels({ authContext: fakeAuthContext({ OPENROUTER_API_KEY: "or-key" }) });
		const providers = models.getProviders();
		expect(providers.map((p) => p.id)).toEqual(["openrouter"]);

		const list = models.getModels("openrouter");
		expect(list.length).toBeGreaterThan(0);
		expect(list.every((m) => m.api === "openrouter-images")).toBe(true);

		expect((await models.getAuth(list[0]))?.auth.apiKey).toBe("or-key");
	});
});
