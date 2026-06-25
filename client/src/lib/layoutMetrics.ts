export type RectLike = {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
};

export function documentHasHorizontalOverflow(
  scrollWidth: number,
  clientWidth: number,
  tolerance = 1
): boolean {
  return scrollWidth > clientWidth + tolerance;
}

export function rectWithinViewport(
  rect: RectLike,
  viewportWidth: number,
  viewportHeight: number,
  tolerance = 1
): boolean {
  return (
    rect.top >= -tolerance &&
    rect.left >= -tolerance &&
    rect.bottom <= viewportHeight + tolerance &&
    rect.right <= viewportWidth + tolerance
  );
}

export function rectsOverlap(a: RectLike, b: RectLike, gap = 0): boolean {
  return !(
    a.right <= b.left + gap ||
    a.left >= b.right - gap ||
    a.bottom <= b.top + gap ||
    a.top >= b.bottom - gap
  );
}

export function meetsMinimumHitTarget(
  rect: RectLike,
  minSize: number,
  tolerance = 0.5
): boolean {
  return rect.width + tolerance >= minSize && rect.height + tolerance >= minSize;
}

export function verticalGapBetweenRects(
  upper: RectLike,
  lower: RectLike
): number {
  return lower.top - upper.bottom;
}

export const RESPONSIVE_VIEWPORTS = {
  desktop1440: { width: 1440, height: 900 },
  desktop1280: { width: 1280, height: 800 },
  mobile390: { width: 390, height: 844 },
  mobile375: { width: 375, height: 812 },
  mobile360: { width: 360, height: 800 },
} as const;
