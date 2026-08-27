import { expect } from "vitest";
import { describeEval } from "vitest-evals";
import { createSlyCodingAgentHarness } from "./sly-harness.ts";

const piCodingAgentHarness = createSlyCodingAgentHarness({ noTools: "all" });

describeEval("Sly Coding Agent smoke", { harness: piCodingAgentHarness }, (it) => {
	it("runs a basic prompt end to end", async ({ run }) => {
		const result = await run("What's the capital of France? Respond with only the city name.");

		expect(result.output.trim()).toBe("Paris");
		expect(result.errors).toEqual([]);
		expect(result.usage.provider).toBe(process.env.SLY_PROVIDER);
		expect(result.usage.model).toBe(process.env.SLY_MODEL);
		expect(result.usage.totalTokens).toBeGreaterThan(0);
	});
});
