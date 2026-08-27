import { describe, expect, it } from "vitest";
import { getSlyUserAgent } from "../src/utils/sly-user-agent.ts";

describe("getSlyUserAgent", () => {
	it("formats the user agent expected by pi.dev", () => {
		const runtime = process.versions.bun ? `bun/${process.versions.bun}` : `node/${process.version}`;
		const userAgent = getSlyUserAgent("1.2.3");

		expect(userAgent).toBe(`sly/1.2.3 (${process.platform}; ${runtime}; ${process.arch})`);
		expect(userAgent).toMatch(/^sly\/[^\s()]+ \([^;()]+;\s*[^;()]+;\s*[^()]+\)$/);
	});
});
