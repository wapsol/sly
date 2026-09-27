/**
 * RETROFIT: the two Radius gateway constants, kept on the coding-agent side.
 *
 * Lives in `core/` rather than `experimental/` because upstream's `core/radius.ts`
 * now reads them, and `experimental/` is excluded from the coding-agent build.
 *
 * Upstream exports these from `@earendil-works/pi-ai/providers/radius-config`, which
 * the provider cull removed -- that module also declares `Model<"pi-messages">`, and
 * restoring it would pull the pi-messages API back into the Api union for the sake of
 * a URL string and a normalizer.
 *
 * The alternative was to re-cull Radius itself, as the first retrofit did. That is no
 * longer worth it: upstream has grown Radius from a single session-share path into
 * roughly forty sites across the experimental client/server surface, so the cull would
 * have to be re-applied by hand on every sync, against code that keeps moving. Shimming
 * two constants leaves upstream's experimental code untouched and mergeable while
 * `packages/ai` stays free of Radius -- there is still no `radius` provider, no
 * `pi-messages` API, and nothing reachable from the shipped model picker.
 *
 * Keep in sync with upstream's radius-config.ts if those two values ever change.
 */

export const DEFAULT_RADIUS_GATEWAY = "https://radius.pi.dev";

export function normalizeRadiusGatewayUrl(value: string): string {
	const withScheme = /^https?:\/\//iu.test(value) ? value : `https://${value}`;
	return withScheme.replace(/\/+$/u, "");
}
