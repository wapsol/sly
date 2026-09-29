import { foregroundAnsi, rgbColor } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

const CORAL = rgbColor(228, 138, 122);
const BLUE = rgbColor(79, 142, 179);
const YELLOW = rgbColor(234, 182, 93);
const RESET = "\x1b[0m";

/**
 * The sly logo: the word SLY drawn with half blocks, 11 cells wide and 2 lines tall.
 * Each letter sits on a 3x4 pixel grid and carries one of pi's three brand colors:
 *
 *   S coral   L blue   Y yellow
 *
 * The brand colors stay fixed across themes; they follow the terminal's color mode.
 */
export function piLogoLines(): [string, string] {
	const mode = theme.getColorMode();
	const fg = (color: typeof CORAL) => foregroundAnsi(color, mode);
	const letter = (color: typeof CORAL, glyphs: string) => `${fg(color)}${glyphs}${RESET}`;
	const top = [letter(CORAL, "█▀▀"), letter(BLUE, "█  "), letter(YELLOW, "▀▄▀")].join(" ");
	const bottom = [letter(CORAL, "▄▄█"), letter(BLUE, "█▄▄"), letter(YELLOW, " █ ")].join(" ");
	return [top, bottom];
}

/** One-line attribution: sly is a fork of the MIT-licensed pi coding agent. */
export const UPSTREAM_ATTRIBUTION = "Built on pi by earendil-works — MIT licensed";
