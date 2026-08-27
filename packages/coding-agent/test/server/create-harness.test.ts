import type { AgentHarnessOptions } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import { describe, expect, test } from "vitest";
import { buildCodingAgentHarnessSystemPrompt, type CodingAgentHarnessTool } from "../../src/server/create-harness.ts";

async function _resolveSystemPrompt(systemPrompt: AgentHarnessOptions["systemPrompt"]): Promise<string> {
	if (typeof systemPrompt === "string") return systemPrompt;
	if (systemPrompt === undefined) throw new Error("Expected a system prompt callback");
	return systemPrompt();
}

function createPromptTool(name: string, promptSnippet?: string, promptGuidelines?: string[]): CodingAgentHarnessTool {
	return {
		name,
		label: name,
		description: `${name} description`,
		parameters: Type.Object({}),
		execute: async () => ({ content: [{ type: "text", text: "ok" }], details: undefined }),
		promptSnippet,
		promptGuidelines,
	};
}

const defaultPromptTools = [
	createPromptTool("read", "Read file contents", ["Use read to examine files instead of cat or sed."]),
	createPromptTool("bash", "Execute bash commands (ls, grep, find, etc.)", [
		"You can inspect PI_* environment variables for current model and session details.",
	]),
	createPromptTool("edit", "Edit files", ["Edit carefully."]),
	createPromptTool("write", "Create or overwrite files", ["Use write only for new files or complete rewrites."]),
];

describe("coding-agent Harness construction", () => {
	test("preserves coding-agent prompt snippets and guideline order", () => {
		const prompt = buildCodingAgentHarnessSystemPrompt({
			cwd: "/workspace",
			tools: defaultPromptTools,
			activeToolNames: ["read", "bash", "edit", "write"],
		});
		expect(prompt).toContain("- read: Read file contents");
		expect(prompt).toContain("- bash: Execute bash commands (ls, grep, find, etc.)");
		expect(prompt).toContain("Use read to examine files instead of cat or sed.");
		expect(prompt).toContain("You can inspect PI_* environment variables for current model and session details.");
		expect(prompt.indexOf("Use read to examine files")).toBeLessThan(
			prompt.indexOf("You can inspect PI_* environment variables"),
		);
	});

	test("omits active custom tools without prompt metadata from the textual tools section", () => {
		const prompt = buildCodingAgentHarnessSystemPrompt({
			cwd: "/workspace",
			tools: [createPromptTool("hidden")],
			activeToolNames: ["hidden"],
		});

		expect(prompt).toContain("Available tools:\n(none)");
		expect(prompt).not.toContain("- hidden:");
		expect(prompt).not.toContain("hidden description");
	});

	test.each([
		[
			"bash",
			"Execute bash commands (ls, grep, find, etc.)",
			"You can inspect PI_* environment variables for current model and session details.",
		],
		["read", "Read file contents", "Use read to examine files instead of cat or sed."],
		[
			"edit",
			"Make precise file edits with exact text replacement, including multiple disjoint edits in one call",
			"Use edit for precise changes (edits[].oldText must match exactly)",
		],
		["write", "Create or overwrite files", "Use write only for new files or complete rewrites."],
	] as const)(
		"does not infer prompt metadata for a caller-supplied %s replacement",
		(name, builtInSnippet, builtInGuideline) => {
			const prompt = buildCodingAgentHarnessSystemPrompt({
				cwd: "/workspace",
				tools: [createPromptTool(name)],
				activeToolNames: [name],
			});

			expect(prompt).toContain("Available tools:\n(none)");
			expect(prompt).not.toContain(builtInSnippet);
			expect(prompt).not.toContain(builtInGuideline);
		},
	);

	test("builds the default prompt from active tools and resolved prompt resources", () => {
		const prompt = buildCodingAgentHarnessSystemPrompt({
			cwd: "/workspace",
			tools: defaultPromptTools,
			activeToolNames: ["write", "read"],
			systemPromptOptions: {
				contextFiles: [{ path: "/workspace/AGENTS.md", content: "Follow project policy." }],
				skills: [
					{
						name: "review",
						description: "Review server changes",
						filePath: "/skills/review/SKILL.md",
						baseDir: "/skills/review",
						sourceInfo: {
							path: "/skills/review/SKILL.md",
							source: "test",
							scope: "temporary",
							origin: "top-level",
						},
						disableModelInvocation: false,
					},
				],
			},
		});

		expect(prompt).toContain("- write: Create or overwrite files");
		expect(prompt).toContain("- read: Read file contents");
		expect(prompt).not.toContain("- bash:");
		expect(prompt).not.toContain("You can inspect PI_* environment variables");
		expect(prompt).toContain('<project_instructions path="/workspace/AGENTS.md">');
		expect(prompt).toContain("<name>review</name>");
		expect(prompt.indexOf("Use write only for new files or complete rewrites.")).toBeLessThan(
			prompt.indexOf("Use read to examine files instead of cat or sed."),
		);
	});
});
