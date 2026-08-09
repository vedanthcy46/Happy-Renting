import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';

/** Design-time phone viewport (dp) used as the scaling baseline. */
export const BASE_WIDTH = 375;
export const BASE_HEIGHT = 812;

/** Largest content width before content is centered and capped on tablets. */
export const MAX_CONTENT_WIDTH = 720;

/** Logical-dp breakpoints. */
export const BREAKPOINTS = {
  /** Small phones — keep things tight. */
  compact: 380,
  /** Standard phones / small foldables (phone < width < tablet). */
  phone: 600,
  /** Tablets and large foldables. */
  tablet: 840,
  /** Extra-wide screens (unfolded foldables, Chromebooks). */
  wide: 1200,
} as const;

export type DeviceClass = 'compact' | 'phone' | 'tablet' | 'wide';
export type Orientation = 'portrait' | 'landscape';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function getDeviceClass(width: number): DeviceClass {
  if (width < BREAKPOINTS.compact) return 'compact';
  if (width < BREAKPOINTS.phone) return 'phone';
  if (width < BREAKPOINTS.tablet) return 'tablet';
  return 'wide';
}

export function getOrientation(width: number, height: number): Orientation {
  return width >= height ? 'landscape' : 'portrait';
}

/** Width-proportional scaling helper (module-level, dimension-agnostic). */
export function scale(width: number, size: number, maxScale = 1.5, minScale = 0.9): number {
  return Math.round(size * clamp(width / BASE_WIDTH, minScale, maxScale));
}

/** Height-proportional scaling helper for full-viewport vertical values. */
export function scaleHeight(height: number, size: number, maxScale = 1.4, minScale = 0.9): number {
  return Math.round(size * clamp(height / BASE_HEIGHT, minScale, maxScale));
}

export interface ResponsiveInfo {
  width: number;
  height: number;
  orientation: Orientation;
  isLandscape: boolean;
  deviceClass: DeviceClass;
  /** true for tablets & wide screens (width >= BREAKPOINTS.phone). */
  isTablet: boolean;
  isCompact: boolean;
  /** adaptive horizontal page padding. */
  hpad: number;
  /** scale a spacing/layout value by screen width. */
  h: (size: number) => number;
  /** scale a vertical value by screen height. */
  v: (size: number) => number;
  /** scale a font size. */
  f: (size: number) => number;
  /** content width: capped + centered on tablets, full width otherwise. */
  maxWidth: number;
}

function computeResponsive(width: number, height: number): ResponsiveInfo {
  const orientation = getOrientation(width, height);
  const deviceClass = getDeviceClass(width);
  const isTablet = deviceClass === 'tablet' || deviceClass === 'wide';
  const isCompact = deviceClass === 'compact';
  const isLandscape = orientation === 'landscape';
  const hpad = isTablet
    ? deviceClass === 'wide'
      ? 32
      : width >= BREAKPOINTS.tablet
        ? 24
        : 20
    : isCompact
      ? 14
      : 16;
  const maxWidth = Math.max(280, Math.min(width - hpad * 2, MAX_CONTENT_WIDTH));

  return {
    width,
    height,
    orientation,
    isLandscape,
    deviceClass,
    isTablet,
    isCompact,
    hpad,
    h: (size: number) => scale(width, size),
    v: (size: number) => scaleHeight(height, size),
    f: (size: number) => scale(width, size, 1.3, 0.9),
    maxWidth,
  };
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();
  return useMemo(() => computeResponsive(width, height), [width, height]);
}
