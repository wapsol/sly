import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryModelsStore, type Model, type Provider } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";

const PROVIDER_ID = "allow-models-provider";

function model(id: string): Model<"openai-completions"> {
	return {
		id,
		name: id,
		api: "openai-completions",
		provider: PROVIDER_ID,
		baseUrl: "https://example.test/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1000,
		maxTokens: 100,
	};
}

function nativeProvider(modelIds: readonly string[]): Provider {
	return {
		id: PROVIDER_ID,
		name: "Allow Models Provider",
		auth: {
			apiKey: {
				name: "Test key",
				resolve: async () => ({ auth: { apiKey: "key" }, source: "native" }),
			},
		},
		getModels: () => modelIds.map(model),
		stream: () => {
			throw new Error("unused");
		},
		streamSimple: () => {
			throw new Error("unused");
		},
	};
}

async function composeWith(
	providerConfig: Record<string, unknown>,
	modelIds: readonly string[] = ["keep-a", "keep-b", "drop-c"],
): Promise<{ runtime: ModelRuntime; cleanup: () => void }> {
	const tempDir = mkdtempSync(join(tmpdir(), "pi-allow-models-"));
	const modelsPath = join(tempDir, "models.json");
	writeFileSync(modelsPath, JSON.stringify({ providers: { [PROVIDER_ID]: providerConfig } }));
	const runtime = await ModelRuntime.create({
		credentials: AuthStorage.inMemory(),
		modelsStore: new InMemoryModelsStore(),
		modelsPath,
		allowModelNetwork: false,
	});
	runtime.registerNativeProvider(nativeProvider(modelIds));
	return { runtime, cleanup: () => rmSync(tempDir, { recursive: true, force: true }) };
}

function modelIds(runtime: ModelRuntime): string[] {
	return runtime
		.getModels(PROVIDER_ID)
		.map((entry) => entry.id)
		.sort();
}

describe("models.json allowModels", () => {
	it("narrows a provider catalog to the listed ids", async () => {
		const { runtime, cleanup } = await composeWith({ allowModels: ["keep-a", "keep-b"] });
		try {
			expect(modelIds(runtime)).toEqual(["keep-a", "keep-b"]);
		} finally {
			cleanup();
		}
	});

	it("is the only provider setting a config needs", async () => {
		// The emptiness check rejects a provider block that configures nothing; allowModels counts.
		const { runtime, cleanup } = await composeWith({ allowModels: ["keep-a"] });
		try {
			expect(modelIds(runtime)).toEqual(["keep-a"]);
		} finally {
			cleanup();
		}
	});

	it("keeps the full catalog when the list matches nothing", async () => {
		// A stale list must not produce an empty model picker: ids can be renamed upstream.
		const { runtime, cleanup } = await composeWith({ allowModels: ["gone-yesterday"] });
		try {
			expect(modelIds(runtime)).toEqual(["drop-c", "keep-a", "keep-b"]);
		} finally {
			cleanup();
		}
	});

	it("keeps explicitly defined models even when the list excludes them", async () => {
		const { runtime, cleanup } = await composeWith({
			allowModels: ["keep-a"],
			models: [{ id: "drop-c" }],
		});
		try {
			expect(modelIds(runtime)).toEqual(["drop-c", "keep-a"]);
		} finally {
			cleanup();
		}
	});

	it("leaves the catalog alone when unset", async () => {
		const { runtime, cleanup } = await composeWith({ baseUrl: "https://overlay.test/v1" });
		try {
			expect(modelIds(runtime)).toEqual(["drop-c", "keep-a", "keep-b"]);
		} finally {
			cleanup();
		}
	});
});
