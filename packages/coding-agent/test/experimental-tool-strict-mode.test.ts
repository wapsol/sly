import { afterEach, describe, expect, it } from "vitest";
import {
	createBashToolDefinition,
	createEditToolDefinition,
	createPowerShellToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
} from "../src/core/tools/index.ts";

function createBuiltInTools() {
	return [
		createReadToolDefinition(process.cwd()),
		createBashToolDefinition(process.cwd()),
		createPowerShellToolDefinition(process.cwd()),
		createEditToolDefinition(process.cwd()),
		createWriteToolDefinition(process.cwd()),
	];
}

describe("experimental strict built-in tools", () => {
	const originalSlyExperimental = process.env.SLY_EXPERIMENTAL;

	afterEach(() => {
		if (originalSlyExperimental === undefined) delete process.env.SLY_EXPERIMENTAL;
		else process.env.SLY_EXPERIMENTAL = originalSlyExperimental;
	});

	it("only enables strict-prefer sampling in experimental mode", () => {
		delete process.env.SLY_EXPERIMENTAL;
		const normalTools = createBuiltInTools();
		process.env.SLY_EXPERIMENTAL = "1";
		const experimentalTools = createBuiltInTools();

		for (const [index, tool] of experimentalTools.entries()) {
			expect(tool.constrainedSampling).toEqual({ type: "json_schema", strict: "prefer" });
			expect(tool.parameters).toEqual(normalTools[index]?.parameters);
			expect(normalTools[index]?.constrainedSampling).toBeUndefined();
		}
	});
});
