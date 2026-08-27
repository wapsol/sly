import { describe, expect, it } from "vitest";
import { resolveModelSelection } from "../src/sly-harness.ts";

describe("resolveModelSelection", () => {
	it("prefers an explicit harness model over environment defaults", () => {
		expect(
			resolveModelSelection(
				{ provider: "anthropic", id: "claude-opus-4-6" },
				{ SLY_PROVIDER: "openai-codex", SLY_MODEL: "gpt-5.6-sol" },
			),
		).toEqual({ provider: "anthropic", id: "claude-opus-4-6" });
	});

	it("uses trimmed environment defaults when the harness has no explicit model", () => {
		expect(resolveModelSelection(undefined, { SLY_PROVIDER: " openai-codex ", SLY_MODEL: " gpt-5.6-sol " })).toEqual({
			provider: "openai-codex",
			id: "gpt-5.6-sol",
		});
	});

	it.each([
		[undefined, {}],
		[undefined, { SLY_PROVIDER: "openai-codex" }],
		[undefined, { SLY_MODEL: "gpt-5.6-sol" }],
		[
			{ provider: "", id: "gpt-5.6-sol" },
			{ SLY_PROVIDER: "openai-codex", SLY_MODEL: "gpt-5.6-sol" },
		],
	] as const)("rejects an incomplete model selection", (explicitModel, environment) => {
		expect(() => resolveModelSelection(explicitModel, environment)).toThrow(
			"Select a harness model explicitly or set both SLY_PROVIDER and SLY_MODEL as defaults.",
		);
	});
});
