/**
 * One-time move of the user config directory when this fork renames it.
 *
 * RETROFIT: added by the retrofit skill, not present upstream. Renaming
 * piConfig.configDir points getAgentDir() at a directory that does not exist
 * yet, so without this the first run after a rebrand looks like a fresh
 * install: no credentials, no settings, no sessions, and rg/fd re-downloaded.
 *
 * Why it lives here and not in migrations.ts: runMigrations() is called from
 * main.ts well after the first getAgentDir() consumer (the bootstrap
 * SettingsManager), and the `auth` subcommands exit before it runs at all. A
 * migration that late would let a fresh auth.json be written to the new
 * directory first, after which the "only migrate into an absent target" guard
 * strands the real credentials permanently. So getAgentDir() drives this
 * directly, and the module stays free of imports from migrations.ts, which
 * already imports config.ts.
 */

import { cpSync, existsSync, readdirSync, renameSync, rmSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/** The directory name this fork migrated away from. */
export const LEGACY_CONFIG_DIR_NAME = ".pi";

let migrated = false;
let notice: string | undefined;

/** Files in `dir`, relative and sorted; empty when `dir` is absent. */
function listFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { recursive: true, encoding: "utf-8" })
		.filter((rel) => {
			try {
				return statSync(join(dir, rel)).isFile();
			} catch {
				return false;
			}
		})
		.sort();
}

/**
 * Verify a copy landed intact: same relative files, same sizes. Cheaper than
 * hashing and enough to catch a truncated or interrupted copy, which is the
 * failure this guards against.
 */
function copyIsComplete(source: string, target: string): boolean {
	const from = listFiles(source);
	const to = listFiles(target);
	if (from.length !== to.length) return false;
	for (let i = 0; i < from.length; i++) {
		if (from[i] !== to[i]) return false;
		try {
			if (statSync(join(source, from[i])).size !== statSync(join(target, to[i])).size) return false;
		} catch {
			return false;
		}
	}
	return true;
}

/**
 * Move `~/<LEGACY_CONFIG_DIR_NAME>` to `~/<configDirName>` once per process.
 *
 * No-ops when the names match, when the target already exists, or when there
 * is nothing to move. On failure the legacy directory is always left intact —
 * the caller then reads an empty config, which is recoverable; losing the
 * credentials is not.
 */
export function ensureConfigDirMigrated(configDirName: string): void {
	if (migrated) return;
	migrated = true;
	if (configDirName === LEGACY_CONFIG_DIR_NAME) return;

	const home = homedir();
	const legacy = join(home, LEGACY_CONFIG_DIR_NAME);
	const target = join(home, configDirName);
	if (existsSync(target) || !existsSync(legacy)) return;

	try {
		renameSync(legacy, target);
		notice = `Moved ${legacy} to ${target}.`;
		return;
	} catch (e) {
		const err = e as NodeJS.ErrnoException;
		if (err.code !== "EXDEV") {
			notice = `Could not move ${legacy} to ${target} (${err.code ?? "unknown error"}). Move it by hand; settings and credentials still live in ${legacy}.`;
			return;
		}
	}

	// Different filesystems: copy, verify, then remove the source.
	try {
		cpSync(legacy, target, { recursive: true, preserveTimestamps: true });
		if (!copyIsComplete(legacy, target)) {
			rmSync(target, { recursive: true, force: true });
			notice = `Copy of ${legacy} to ${target} was incomplete; nothing was removed. Move it by hand.`;
			return;
		}
		rmSync(legacy, { recursive: true, force: true });
		notice = `Copied ${legacy} to ${target} (different filesystems).`;
	} catch (e) {
		const err = e as NodeJS.ErrnoException;
		rmSync(target, { recursive: true, force: true });
		notice = `Could not copy ${legacy} to ${target} (${err.code ?? "unknown error"}). Move it by hand; settings and credentials still live in ${legacy}.`;
	}
}

/** What the migration did this process, if anything. Cleared once read. */
export function takeConfigDirMigrationNotice(): string | undefined {
	const value = notice;
	notice = undefined;
	return value;
}

/**
 * Project-local directories are NOT dual-read: a project's `.pi/` simply stops
 * being found. Silence would mean a project's extensions, skills and prompt
 * templates vanish with no explanation, so say so instead.
 */
export function getLegacyProjectDirWarning(cwd: string, configDirName: string): string | undefined {
	if (configDirName === LEGACY_CONFIG_DIR_NAME) return undefined;
	const legacy = join(cwd, LEGACY_CONFIG_DIR_NAME);
	if (!existsSync(legacy) || existsSync(join(cwd, configDirName))) return undefined;
	return `${legacy} is no longer read. Rename it to ${join(cwd, configDirName)} to keep its extensions, skills and prompt templates loading.`;
}

/** Test seam: forget that the migration already ran in this process. */
export function resetConfigDirMigrationForTests(): void {
	migrated = false;
	notice = undefined;
}
