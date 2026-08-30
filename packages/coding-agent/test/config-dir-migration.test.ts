import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	ensureConfigDirMigrated,
	getLegacyProjectDirWarning,
	LEGACY_CONFIG_DIR_NAME,
	resetConfigDirMigrationForTests,
	takeConfigDirMigrationNotice,
} from "../src/config-dir-migration.ts";

/**
 * RETROFIT: covers the config-dir rename this fork applies. The failure this
 * guards against is silent — a missed migration reads as a fresh install with
 * no credentials rather than as an error.
 */
describe("config dir migration", () => {
	const testDir = join(process.cwd(), "test-config-dir-migration-tmp");
	const originalHome = process.env.HOME;

	beforeEach(() => {
		rmSync(testDir, { recursive: true, force: true });
		mkdirSync(testDir, { recursive: true });
		// os.homedir() reads HOME on Linux/macOS; point it at the sandbox.
		process.env.HOME = testDir;
		resetConfigDirMigrationForTests();
	});

	afterEach(() => {
		if (originalHome === undefined) delete process.env.HOME;
		else process.env.HOME = originalHome;
		rmSync(testDir, { recursive: true, force: true });
	});

	function seedLegacy(): string {
		const legacyAgent = join(testDir, LEGACY_CONFIG_DIR_NAME, "agent");
		mkdirSync(legacyAgent, { recursive: true });
		writeFileSync(join(legacyAgent, "auth.json"), '{"anthropic":{"type":"api_key","key":"sentinel"}}');
		return legacyAgent;
	}

	it("moves the legacy directory when the target is absent", () => {
		seedLegacy();

		ensureConfigDirMigrated(".retropit");

		expect(existsSync(join(testDir, LEGACY_CONFIG_DIR_NAME))).toBe(false);
		const moved = join(testDir, ".retropit", "agent", "auth.json");
		expect(readFileSync(moved, "utf-8")).toContain("sentinel");
		expect(takeConfigDirMigrationNotice()).toContain("Moved");
	});

	it("does nothing when there is no legacy directory", () => {
		ensureConfigDirMigrated(".retropit");

		expect(existsSync(join(testDir, ".retropit"))).toBe(false);
		expect(takeConfigDirMigrationNotice()).toBeUndefined();
	});

	it("leaves both alone when the target already exists", () => {
		seedLegacy();
		const targetAgent = join(testDir, ".retropit", "agent");
		mkdirSync(targetAgent, { recursive: true });
		writeFileSync(join(targetAgent, "auth.json"), '{"google":{"type":"api_key","key":"newer"}}');

		ensureConfigDirMigrated(".retropit");

		// Neither clobbered: the newer target wins, the legacy copy is preserved
		// so nothing is lost while the user reconciles them.
		expect(readFileSync(join(targetAgent, "auth.json"), "utf-8")).toContain("newer");
		expect(readFileSync(join(testDir, LEGACY_CONFIG_DIR_NAME, "agent", "auth.json"), "utf-8")).toContain("sentinel");
		expect(takeConfigDirMigrationNotice()).toBeUndefined();
	});

	it("is a no-op when the name is unchanged", () => {
		seedLegacy();

		ensureConfigDirMigrated(LEGACY_CONFIG_DIR_NAME);

		expect(existsSync(join(testDir, LEGACY_CONFIG_DIR_NAME, "agent", "auth.json"))).toBe(true);
		expect(takeConfigDirMigrationNotice()).toBeUndefined();
	});

	it("runs at most once per process", () => {
		seedLegacy();
		ensureConfigDirMigrated(".retropit");
		expect(takeConfigDirMigrationNotice()).toContain("Moved");

		// A legacy directory reappearing later is not re-migrated: the process
		// has already resolved its agent dir, and moving it underneath would
		// invalidate paths already handed out.
		seedLegacy();
		ensureConfigDirMigrated(".retropit");

		expect(existsSync(join(testDir, LEGACY_CONFIG_DIR_NAME))).toBe(true);
		expect(takeConfigDirMigrationNotice()).toBeUndefined();
	});

	it("warns about a legacy project directory instead of silently ignoring it", () => {
		const projectDir = join(testDir, "project");
		mkdirSync(join(projectDir, LEGACY_CONFIG_DIR_NAME, "extensions"), { recursive: true });

		const warning = getLegacyProjectDirWarning(projectDir, ".retropit");

		expect(warning).toContain(join(projectDir, LEGACY_CONFIG_DIR_NAME));
		expect(warning).toContain(join(projectDir, ".retropit"));
	});

	it("does not warn once the project directory has been renamed", () => {
		const projectDir = join(testDir, "project");
		mkdirSync(join(projectDir, LEGACY_CONFIG_DIR_NAME), { recursive: true });
		mkdirSync(join(projectDir, ".retropit"), { recursive: true });

		expect(getLegacyProjectDirWarning(projectDir, ".retropit")).toBeUndefined();
	});

	it("does not touch the real home directory", () => {
		// Guard against a regression where the sandbox HOME is ignored.
		expect(homedir()).toBe(testDir);
	});
});
