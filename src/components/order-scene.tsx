/**
 * The picture of an order, at whatever stage it has reached.
 *
 * Three of the four scenes are the price list's own — a basket, a machine, a
 * stack — drawn by `service-scene.tsx`, so an order's page and the shop's menu
 * are unmistakably the same hand. The fourth is the one the shopfront never
 * needed: a rider, for the stage where the laundry has left the shop.
 *
 * Built the way every scene in this app is built: a silhouette in the object's
 * own colours, a vertical gradient standing in for the lamp above, a lighter
 * plane where the form turns up and a darker one where it turns away, and a
 * soft pool underneath so the thing stands on something.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg';

import { ServiceScene } from '@/components/service-scene';
import type { OrderScene } from '@/lib/domain/order-scene';

interface OrderSceneArtProps {
  scene: OrderScene;
  /** The shop's colour. The rider's bag and the tile behind take it. */
  brand: string;
  size: number;
}

export function OrderSceneArt({ scene, brand, size }: OrderSceneArtProps) {
  return (
    <View style={[styles.frame, { width: size, height: size }]} accessibilityElementsHidden>
      {scene === 'scooter' ? (
        <RiderScene brand={brand} />
      ) : (
        <ServiceScene scene={scene} brand={brand} surface="white" />
      )}
    </View>
  );
}

/** The scooter's own colours: a warm shell, dark rubber, chrome. */
const SHELL_LIT = '#FF7D66';
const SHELL_DEEP = '#C13A31';
const RUBBER = '#28313D';
const RUBBER_LIT = '#44515F';
const CHROME = '#C7D2E0';
const RIDER = '#1F5FA8';
const SKIN = '#E8B48C';

/**
 * The rider, with the shop's washing on the back.
 *
 * A side view, because a scooter is only recognisable from the side: two
 * wheels, a step-through deck slung between them, a shield rising to the bars,
 * and a figure leaning into it. Everything keeps the scooter's own colours and
 * the box alone takes the shop's, so a red scooter never turns into a brand
 * illustration — the one thing on it that belongs to the laundry is the thing
 * being carried.
 */
function RiderScene({ brand }: { brand: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 120 120">
      <Defs>
        <SvgLinearGradient id="rsShell" x1="0" y1="0" x2="0.2" y2="1">
          <Stop offset="0" stopColor={SHELL_LIT} />
          <Stop offset="1" stopColor={SHELL_DEEP} />
        </SvgLinearGradient>
        <SvgLinearGradient id="rsBag" x1="0" y1="0" x2="0.25" y2="1">
          <Stop offset="0" stopColor={brand} stopOpacity="0.9" />
          <Stop offset="1" stopColor={brand} />
        </SvgLinearGradient>
        <SvgLinearGradient id="rsTyre" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={RUBBER_LIT} />
          <Stop offset="1" stopColor={RUBBER} />
        </SvgLinearGradient>
        <RadialGradient id="rsPool" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#5C6674" stopOpacity="0.3" />
          <Stop offset="1" stopColor="#5C6674" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* The pool the whole machine stands in. */}
      <Ellipse cx="60" cy="101" rx="45" ry="6" fill="url(#rsPool)" />

      {/* Wheels first; the frame hangs between them. */}
      <Wheel cx={30} cy={86} />
      <Wheel cx={92} cy={86} />

      {/* The shield, rising from the deck to the bars. */}
      <Path d="M70 84 q3-26 11-42 l10 4 q-9 17-11 38z" fill="url(#rsShell)" />
      <Circle cx="86" cy="50" r="5.5" fill="#FFF3C4" stroke={SHELL_DEEP} strokeWidth="1.5" />
      {/* The fork down to the front wheel, and the bars across the top. */}
      <Path d="M84 54 l7 24" stroke={CHROME} strokeWidth="5" strokeLinecap="round" fill="none" />
      <Path d="M76 40 h20" stroke={RUBBER} strokeWidth="5" strokeLinecap="round" fill="none" />

      {/* The body: a mass over the back wheel and the deck running forward. */}
      <Path d="M20 62 h26 q7 0 7 7 v9 h22 v7 H30 q-10 0-10-10z" fill="url(#rsShell)" />
      <Rect x="42" y="76" width="32" height="8" rx="3" fill={SHELL_DEEP} opacity="0.85" />

      {/* The seat. */}
      <Path d="M26 58 h26 q5 0 5 5 t-5 5 H26 q-5 0-5-5 t5-5z" fill={RUBBER} />

      <Rider />

      {/* The washing, boxed and strapped to the rack behind the seat. */}
      <Rect x="4" y="34" width="28" height="26" rx="6" fill="url(#rsBag)" />
      <Rect x="4" y="34" width="28" height="6" rx="3" fill="#FFFFFF" opacity="0.28" />
      <Rect x="14" y="30" width="8" height="6" rx="2.5" fill={brand} opacity="0.85" />
      <Rect x="4" y="48" width="28" height="2.5" fill="#04203F" opacity="0.16" />
    </Svg>
  );
}

/** A figure leaning into the bars: helmet, back, arm, leg. */
function Rider() {
  return (
    <G>
      {/* The thigh along the seat and the back rising from it, one stroke each,
          so the pose still reads when the whole scene is 100px wide. */}
      <Path d="M40 58 h13" stroke={RIDER} strokeWidth="13" strokeLinecap="round" fill="none" />
      <Path d="M44 56 q3-13 10-17" stroke={RIDER} strokeWidth="13" strokeLinecap="round" fill="none" />
      {/* The shin, dropping to the deck. */}
      <Path d="M53 60 l7 16" stroke={RUBBER} strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* The arm, out to the bars. */}
      <Path d="M56 42 l20 -1" stroke={RIDER} strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* The head, and the helmet over it. */}
      <Circle cx="55" cy="31" r="9" fill={SKIN} />
      <Path d="M46 31 a9 9 0 0 1 18 0 z" fill={RIDER} />
      <Path d="M62 30 h6 a2 2 0 0 1 0 4 h-6z" fill={RIDER} />
    </G>
  );
}

function Wheel({ cx, cy }: { cx: number; cy: number }) {
  return (
    <G>
      <Circle cx={cx} cy={cy} r="14" fill="url(#rsTyre)" />
      <Circle cx={cx} cy={cy} r="6" fill={CHROME} />
      <Circle cx={cx} cy={cy} r="2.5" fill={RUBBER} />
    </G>
  );
}


const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center' },
});
