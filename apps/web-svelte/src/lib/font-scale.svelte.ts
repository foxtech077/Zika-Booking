import { browser } from '$app/environment';

/**
 * Scales the root font size for Windows users so the app reads at a sensible
 * size on low-DPI desktop displays, mirroring the Next.js fontScale utility.
 *
 * Windows renders rem units against a 96dpi baseline, so 1rem is visually
 * smaller than on macOS; shrinking the root font on narrower screens keeps the
 * layout proportional without breaking fluid breakpoints. Non-Windows and
 * wide screens keep a 1rem root.
 */
export function applyFontScale(): void {
	if (!browser) return;
	const isWindows =
		navigator.userAgent.includes('Windows') || navigator.platform.includes('Win');
	if (!isWindows) return;

	const width = window.innerWidth;
	let rootFontScale = 1;
	if (width < 1366) {
		rootFontScale = 0.7;
	} else if (width < 1600) {
		rootFontScale = 0.85;
	}

	document.documentElement.style.fontSize = `${rootFontScale}rem`;
}
