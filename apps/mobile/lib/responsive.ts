import { useWindowDimensions, type ViewStyle } from "react-native";

/**
 * Width breakpoints, in dp. Chosen against real device widths rather than
 * round numbers: a portrait iPad mini is 744, a portrait iPad Pro 11" is 834,
 * and landscape tablets land between 1024 and 1366. Phones — including the
 * largest Pro Max in portrait — stay under 600.
 */
export const BP = {
  /** Small tablet / large foldable — two columns start here. */
  sm: 600,
  /** Portrait iPad Pro and up — three columns. */
  md: 900,
  /** Landscape tablet — four columns. */
  lg: 1280,
} as const;

/**
 * Number of columns for media-rich cards (listings, bookings, listing photos).
 * One on phones, so nothing about the phone UI changes.
 */
export function gridColumnsFor(width: number): number {
  if (width >= BP.lg) return 4;
  if (width >= BP.md) return 3;
  if (width >= BP.sm) return 2;
  return 1;
}

export interface Responsive {
  width: number;
  /** True once there is room for more than one card per row. */
  isTablet: boolean;
  /** Columns for media-rich card grids. Always 1 on phones. */
  columns: number;
  /**
   * Cap for content that should stay single-column (forms, detail pages, row
   * lists). Undefined on phones so those layouts are untouched. Centre with
   * `alignSelf: "center"` / `marginHorizontal: "auto"` alongside this.
   */
  maxContentWidth: number | undefined;
}

/**
 * Single source of truth for tablet layout decisions. Reads from
 * `useWindowDimensions`, so it reacts to rotation and iPad split-view
 * resizing — not just the width at mount.
 */
export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  const columns = gridColumnsFor(width);
  return {
    width,
    isTablet: width >= BP.sm,
    columns,
    maxContentWidth: width >= BP.md ? 860 : undefined,
  };
}

/**
 * Pads a grid's data so the final row is always full.
 *
 * Grid cards use `flex: 1` to share a row evenly, which means a trailing row
 * holding fewer items than there are columns would stretch those items across
 * the full width — reintroducing the exact stretched card the grid exists to
 * avoid. Padding with nulls, rendered as invisible spacers, keeps the last row
 * aligned with the ones above it.
 */
export function padToColumns<T>(items: T[], columns: number): (T | null)[] {
  if (columns <= 1 || items.length === 0) return items;
  const remainder = items.length % columns;
  if (remainder === 0) return items;
  return [...items, ...(Array(columns - remainder).fill(null) as null[])];
}

/**
 * Row-style lists (notifications, messages, payment methods) read badly when
 * split into columns — the eye has to scan in two directions for what is
 * really one chronological stream. Constrain them instead.
 */
export function useReadableWidth(): ViewStyle {
  const { width } = useWindowDimensions();
  if (width < BP.sm) return {};

  return { maxWidth: 720, width: "100%", alignSelf: "center" };
}
