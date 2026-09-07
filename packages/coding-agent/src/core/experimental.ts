export function areExperimentalFeaturesEnabled(): boolean {
	return process.env.SLY_EXPERIMENTAL === "1";
}
