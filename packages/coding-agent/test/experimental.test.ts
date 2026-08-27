import { afterEach, describe, expect, it } from "vitest";
import { areExperimentalFeaturesEnabled } from "../src/core/experimental.ts";

describe("areExperimentalFeaturesEnabled", () => {
	const originalSlyExperimental = process.env.SLY_EXPERIMENTAL;

	afterEach(() => {
		if (originalSlyExperimental === undefined) {
			delete process.env.SLY_EXPERIMENTAL;
		} else {
			process.env.SLY_EXPERIMENTAL = originalSlyExperimental;
		}
	});

	it("returns false when SLY_EXPERIMENTAL is unset", () => {
		delete process.env.SLY_EXPERIMENTAL;

		expect(areExperimentalFeaturesEnabled()).toBe(false);
	});

	it("returns false when SLY_EXPERIMENTAL is empty", () => {
		process.env.SLY_EXPERIMENTAL = "";

		expect(areExperimentalFeaturesEnabled()).toBe(false);
	});

	it("returns true when SLY_EXPERIMENTAL is set to 1", () => {
		process.env.SLY_EXPERIMENTAL = "1";

		expect(areExperimentalFeaturesEnabled()).toBe(true);
	});

	it("returns false when SLY_EXPERIMENTAL is set to 0", () => {
		process.env.SLY_EXPERIMENTAL = "0";

		expect(areExperimentalFeaturesEnabled()).toBe(false);
	});

	it("returns false when SLY_EXPERIMENTAL is set to a non-1 value", () => {
		process.env.SLY_EXPERIMENTAL = "true";

		expect(areExperimentalFeaturesEnabled()).toBe(false);
	});
});
