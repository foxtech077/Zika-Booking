const isWindows =
  typeof window !== "undefined" &&
  (navigator.userAgent.includes("Windows") ||
    navigator.platform.includes("Win"));

export const isSmallScreenWindows =
  isWindows &&
  typeof window !== "undefined" &&
  window.innerWidth < 1366;

if (typeof window !== "undefined") {
  const width = window.innerWidth;

  let rootFontScale = 1;

  if (isWindows) {
    if (width < 1366) {
      rootFontScale = 0.7;
    } else if (width < 1600) {
      rootFontScale = 0.85;
    } else {
      rootFontScale = 1;
    }
  }

  document.documentElement.style.fontSize = `${rootFontScale}rem`;
}
