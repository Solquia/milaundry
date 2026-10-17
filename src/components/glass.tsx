/**
 * Frosted glass, the app's surface — customer and merchant alike.
 *
 * One look, defined once: translucent white panes with a bright hairline edge
 * and a wide, soft navy shadow, floating over a still pastel wash. The order
 * tracker proved it; this is the kit every customer screen draws from, so a
 * card on the shop page and a card on home are the same pane of glass.
 *
 * Deliberately imports nothing from `ui-kit`: the kit's `Card` and `Screen`
 * read this file, and a cycle between the two would leave one half undefined.
 *
 * Real blur is web-only (`backdropFilter`); on phones the panes are frosted by
 * opacity over the wash, which reads the same at arm's length and costs no GPU.
 */
import React, { createContext, useContext, useId } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Frosted fill: white at partial strength, so the wash shows through. */
export const GLASS_FILL = 'rgba(255, 255, 255, 0.66)';
/** A denser pane, for rows of text that need more contrast. */
export const GLASS_FILL_DENSE = 'rgba(255, 255, 255, 0.82)';
/** The bright hairline a pane of glass catches along its edge. */
export const GLASS_EDGE = 'rgba(255, 255, 255, 0.95)';
/** The frosted tray a glass card sits in, like the Wallet card's frame. */
export const GLASS_TRAY = '#F4F5FA';
/** Under the glass: a cool off-white the wash is painted over. */
export const GLASS_GROUND = '#EEF0FA';
export const GLASS_RADIUS = 26;

const WEB_BLUR: ViewStyle =
  Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(24px) saturate(160%)' } as unknown as ViewStyle)
    : {};

/**
 * Android draws its elevation shadow under the whole view, and a translucent
 * pane lets it show through as a grey slab inside the glass. Panes there stand
 * on their edge and the wash alone; iOS and the web keep the soft shadow.
 */
export const GLASS_ELEVATION = Platform.OS === 'android' ? 0 : 2;

/** A pane: translucent fill, hairline edge, the wide soft shadow. */
export const glassPane: ViewStyle = {
  backgroundColor: GLASS_FILL,
  borderWidth: 1,
  borderColor: GLASS_EDGE,
  borderRadius: GLASS_RADIUS,
  borderCurve: 'continuous',
  shadowColor: '#1B2559',
  shadowOpacity: 0.08,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
  elevation: GLASS_ELEVATION,
  ...WEB_BLUR,
};

/** A smaller pane for rows, pills and chips: same glass, less lift. */
export const glassChip: ViewStyle = {
  backgroundColor: GLASS_FILL_DENSE,
  borderWidth: 1,
  borderColor: GLASS_EDGE,
  borderCurve: 'continuous',
  ...WEB_BLUR,
};

/** A #RRGGBB colour at some alpha, as #RRGGBBAA. */
function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

/**
 * Vibrant glass: a pane tinted with a colour that matters — a status, money
 * owed, an open sign — the way iOS widgets let a hue glow through the frost.
 * The tint is light enough that text stays readable in the app's own ink;
 * the colour lives in the fill, the edge and the glow under it.
 */
export function vibrantPane(hex: string): ViewStyle {
  return {
    ...glassPane,
    backgroundColor: withAlpha(hex, 0.12),
    borderColor: withAlpha(hex, 0.22),
    shadowColor: hex,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  };
}

// ── Whether the tree under here is the glass app ─────────────────────────
// The customer and merchant layouts both wrap in GlassProvider. The public
// web pages (a shop's own site, web booking, tracking) do not, and keep
// their plain white look until they are designed for it.

const GlassContext = createContext(false);

export function GlassProvider({ children }: { children: React.ReactNode }) {
  return <GlassContext.Provider value>{children}</GlassContext.Provider>;
}

export function useIsGlass(): boolean {
  return useContext(GlassContext);
}

/**
 * The colour under the glass: a cool ground with a blue bloom, a lavender
 * bloom and a white bloom, the way a Wallet card catches light. Still — the
 * content moves, the light does not.
 */
export function PastelWash({
  color = '#5B8DEF',
  style,
}: {
  /** The hue of the strongest bloom; the stage colour on the tracker. */
  color?: string;
  style?: ViewStyle;
}) {
  // Unique per wash: on the web every SVG shares one id space.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg
      style={[StyleSheet.absoluteFill, style]}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id={`hue${id}`} cx="82" cy="18" r="70" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity={0.32} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`lav${id}`} cx="18" cy="70" r="65" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#B8B2F6" stopOpacity={0.45} />
          <Stop offset="1" stopColor="#B8B2F6" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`lit${id}`} cx="35" cy="28" r="45" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={GLASS_GROUND} />
      <Rect x="0" y="0" width="100" height="100" fill={`url(#hue${id})`} />
      <Rect x="0" y="0" width="100" height="100" fill={`url(#lav${id})`} />
      <Rect x="0" y="0" width="100" height="100" fill={`url(#lit${id})`} />
    </Svg>
  );
}

/**
 * A full-page wash for a screen, softer than a card's: the page is the light
 * the panes sit in, not a panel itself, so its blooms are kept faint enough
 * that text on glass never fights them.
 */
export function GlassBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <PastelWash style={styles.faint} />
    </View>
  );
}

const styles = StyleSheet.create({
  faint: { opacity: 0.85 },
});
