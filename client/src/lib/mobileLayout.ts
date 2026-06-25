/** Shared mobile shell metrics — keep in sync with MobileNav.tsx grid sizing. */
export const MOBILE_NAV_MIN_HEIGHT_PX = 68;
/** MobileNav inner grid top padding (pt-1.5). */
export const MOBILE_NAV_TOP_PADDING_PX = 6;
export const MOBILE_FIXED_ABOVE_NAV_GAP_PX = 8;
export const MOBILE_NAV_SAFE_AREA_PADDING =
  "max(0.75rem, env(safe-area-inset-bottom))";

/** CSS bottom offset for fixed layers that sit above MobileNav with a visible gap. */
export const MOBILE_FIXED_ABOVE_NAV_BOTTOM = `calc(${MOBILE_NAV_MIN_HEIGHT_PX}px + ${MOBILE_NAV_TOP_PADDING_PX}px + ${MOBILE_NAV_SAFE_AREA_PADDING} + ${MOBILE_FIXED_ABOVE_NAV_GAP_PX}px)`;
