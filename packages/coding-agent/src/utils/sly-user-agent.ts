export function getSlyUserAgent(version: string): string {
	const runtime = process.versions.bun ? `bun/${process.versions.bun}` : `node/${process.version}`;
	return `sly/${version} (${process.platform}; ${runtime}; ${process.arch})`;
}
