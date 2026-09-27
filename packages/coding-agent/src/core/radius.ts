import { DEFAULT_RADIUS_GATEWAY, normalizeRadiusGatewayUrl } from "./radius-gateway.ts";

export const RADIUS_PROVIDER_ID = "radius";
export const ENV_RADIUS_GATEWAY = "SLY_RADIUS_GATEWAY";

/** Radius gateway origin, honoring the `SLY_RADIUS_GATEWAY` override. */
export function getRadiusGatewayUrl(): string {
	return normalizeRadiusGatewayUrl(process.env[ENV_RADIUS_GATEWAY] ?? DEFAULT_RADIUS_GATEWAY);
}
