import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createAssistantMessageEventStream,
	type DeferredCancelOptions,
	type DeferredFetchOptions,
	InMemoryModelsStore,
	type Model,
	type Provider,
} from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";

function model(id: string): Model<"openai-completions"> {
	return {
		id,
		name: id,
		api: "openai-completions",
		provider: "extension-oauth",
		baseUrl: "https://example.test/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1000,
		maxTokens: 100,
	};
}

describe("extension provider model lifecycle", () => {
	it("preserves native deferred methods through provider overlays", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pi-native-provider-deferred-"));
		const modelsPath = join(tempDir, "models.json");
		writeFileSync(
			modelsPath,
			JSON.stringify({
				providers: {
					"extension-native-deferred": { baseUrl: "https://overlay.test/v1" },
				},
			}),
		);
		try {
			const runtime = await ModelRuntime.create({
				credentials: AuthStorage.inMemory(),
				modelsStore: new InMemoryModelsStore(),
				modelsPath,
				allowModelNetwork: false,
			});
			const nativeModel = {
				...model("native-deferred"),
				provider: "extension-native-deferred",
				baseUrl: "https://native.test/v1",
			};
			let fetchedBaseUrl: string | undefined;
			let fetchedOptions: DeferredFetchOptions | undefined;
			let cancelledId: string | undefined;
			let cancelledOptions: DeferredCancelOptions | undefined;
			const provider: Provider = {
				id: "extension-native-deferred",
				name: "Extension Native Deferred",
				auth: {
					apiKey: {
						name: "Native key",
						resolve: async () => ({ auth: { apiKey: "key" }, source: "native" }),
					},
				},
				getModels: () => [nativeModel],
				stream: () => {
					throw new Error("unused");
				},
				streamSimple: () => {
					throw new Error("unused");
				},
				fetchDeferred: (requestModel, _handle, options) => {
					fetchedBaseUrl = requestModel.baseUrl;
					fetchedOptions = options;
					const message = {
						role: "assistant" as const,
						content: [],
						api: requestModel.api,
						provider: requestModel.provider,
						model: requestModel.id,
						usage: {
							input: 0,
							output: 0,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 0,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						},
						stopReason: "stop" as const,
						timestamp: 0,
					};
					const stream = createAssistantMessageEventStream();
					stream.push({ type: "start", partial: message });
					stream.push({ type: "done", reason: "stop", message });
					stream.end(message);
					return stream;
				},
				cancelDeferred: async (_requestModel, handle, options) => {
					cancelledId = handle.id;
					cancelledOptions = options;
				},
			};

			runtime.registerNativeProvider(provider);
			const composedModel = runtime.getModel(provider.id, nativeModel.id);
			expect(composedModel).toBeDefined();

			await runtime.fetchDeferred(
				composedModel!,
				{
					provider: provider.id,
					modelId: nativeModel.id,
					api: nativeModel.api,
					id: "fetch-id",
				},
				{
					wait: 25,
					headers: { "X-Fetch": "fetch" },
					transformHeaders: (headers) => ({ ...headers, "X-Transformed": "fetch" }),
				},
			);
			await runtime.cancelDeferred(
				composedModel!,
				{
					provider: provider.id,
					modelId: nativeModel.id,
					api: nativeModel.api,
					id: "cancel-id",
				},
				{
					timeoutMs: 100,
					transformHeaders: (headers) => ({ ...headers, "X-Transformed": "cancel" }),
				},
			);

			expect(fetchedBaseUrl).toBe("https://overlay.test/v1");
			expect(fetchedOptions).toMatchObject({
				apiKey: "key",
				wait: 25,
				headers: { "X-Fetch": "fetch", "X-Transformed": "fetch" },
			});
			expect(cancelledId).toBe("cancel-id");
			expect(cancelledOptions).toMatchObject({
				apiKey: "key",
				timeoutMs: 100,
				headers: { "X-Transformed": "cancel" },
			});
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
