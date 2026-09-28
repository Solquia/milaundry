/**
 * The personal touches, drawn the way the services shelf draws its objects.
 *
 * The touches used to be line icons in white circles — a shirt outline, a
 * flower, a sun — beside a shelf of lit, dyed, shadowed product drawings, so
 * the one place a customer says how their laundry is cared for looked like a
 * settings screen. These are the same studio objects (`photo-kit`): cloth
 * ramped from a lit crown into a deep fold, a lamp side and a far side, a
 * contact shadow under whatever stands.
 *
 *   - Separate whites: a bright white tee on its own, the coloured wash kept
 *     apart behind a gap.
 *   - Delicates: a blush silk camisole on a hanger, lace at the hem, a bow.
 *   - Air dry: washing pegged on a line under the sun.
 */
import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { TogglePreference } from '@/lib/domain/laundry-preferences';

import { CHROME, CLOTH, RampGradient, SharedLight } from './photo-kit';

/** A tee from the front, sleeves out, in a 100-unit box. */
const TEE =
  'M 34 22 L 22 28 L 10 42 L 22 50 L 28 45 L 28 88 C 28 91 30 92 33 92 H 67 C 70 92 72 91 72 88 L 72 45 L 78 50 L 90 42 L 78 28 L 66 22 C 62 28 38 28 34 22 Z';
const COLLAR = 'M 34 22 C 38 29 62 29 66 22';

/** A four-point glint: the "fresh" sparkle beside something clean. */
function Glint({ x, y, r, colour }: { x: number; y: number; r: number; colour: string }) {
  const w = r * 0.28;
  return (
    <Path
      d={`M ${x} ${y - r} Q ${x + w} ${y - w} ${x + r} ${y} Q ${x + w} ${y + w} ${x} ${y + r} Q ${x - w} ${y + w} ${x - r} ${y} Q ${x - w} ${y - w} ${x} ${y - r} Z`}
      fill={colour}
    />
  );
}

function Tee({ id, fill }: { id: string; fill: string }) {
  return (
    <G>
      <Path d={TEE} fill={fill} />
      <Path d={TEE} fill={`url(#${id}-side)`} />
      <Path d={COLLAR} stroke="#0B1422" strokeOpacity={0.18} strokeWidth={2.4} fill="none" />
      {/* Folds where the sleeves meet the body. */}
      <Path d="M 28 46 C 30 60 29 74 31 88" stroke="#0B1422" strokeOpacity={0.08} strokeWidth={2} fill="none" />
      <Path d="M 72 46 C 70 60 71 74 69 88" stroke="#0B1422" strokeOpacity={0.12} strokeWidth={2} fill="none" />
      <Path d="M 36 24 C 42 30 58 30 64 24" stroke={`url(#${id}-spec)`} strokeWidth={1.2} fill="none" />
    </G>
  );
}

/** Separate whites: the white tee alone and bright, the colours kept to one side. */
function Whites({ id }: { id: string }) {
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-white`} colour="#F2F5F9" ramp={CLOTH} />
        <RampGradient id={`${id}-blue`} colour="#4F86D8" ramp={CLOTH} />
        <RampGradient id={`${id}-red`} colour="#D0564E" ramp={CLOTH} />
      </Defs>
      {/* The coloured wash, small and set back on the left. */}
      <G transform="translate(0 50) scale(0.42)" opacity={0.9}>
        <Tee id={id} fill={`url(#${id}-blue)`} />
      </G>
      <G transform="translate(8 62) scale(0.36)" opacity={0.9}>
        <Tee id={id} fill={`url(#${id}-red)`} />
      </G>
      {/* The gap between them: a soft dashed line on the ground. */}
      <Path d="M 40 58 V 96" stroke="#9AA6B5" strokeWidth={1} strokeDasharray={[2, 2.5]} />
      <Ellipse cx={70} cy={95} rx={22} ry={2.6} fill="#0B1422" opacity={0.16} />
      <G transform="translate(38 20) scale(0.64)">
        <Tee id={id} fill={`url(#${id}-white)`} />
      </G>
      <Glint x={88} y={22} r={6} colour="#7FB2F0" />
      <Glint x={46} y={16} r={3.6} colour="#A9CBF5" />
    </G>
  );
}

/** Delicates: a blush silk camisole on a hanger, lace at its hem, a bow at the neck. */
function Delicates({ id }: { id: string }) {
  const body = 'M 38 32 L 35 48 C 29 62 29 78 31 90 H 69 C 71 78 71 62 65 48 L 62 32 C 57 42 43 42 38 32 Z';
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-silk`} colour="#F0B3C4" ramp={CLOTH} />
        <RampGradient id={`${id}-hook`} colour="#B8C2CE" ramp={CHROME} isAcross />
        <RampGradient id={`${id}-wood`} colour="#C89A6A" ramp={CLOTH} />
      </Defs>
      {/* The hanger: hook, then a wooden bar. */}
      <Path d="M 50 12 V 7 A 3.4 3.4 0 1 1 53.4 10.4" stroke={`url(#${id}-hook)`} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <Path d="M 28 24 L 50 12 L 72 24" stroke={`url(#${id}-wood)`} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Straps. */}
      <Path d="M 38 32 L 41 22 M 62 32 L 59 22" stroke="#D98FA5" strokeWidth={1.4} strokeLinecap="round" />
      <Path d={body} fill={`url(#${id}-silk)`} />
      {/* Silk catches light in long soft bands. */}
      <Path d="M 40 46 C 37 60 37 74 38 88" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M 58 46 C 61 62 60 76 62 88" stroke="#7A2E45" strokeOpacity={0.14} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      <Path d={body} fill={`url(#${id}-side)`} />
      {/* The lace hem: a row of scallops with their holes. */}
      {[33, 38.5, 44, 49.5, 55, 60.5, 66].map((x) => (
        <G key={x}>
          <Circle cx={x} cy={91} r={3} fill="#FFF6F8" stroke="#E7AFC0" strokeWidth={0.6} />
          <Circle cx={x} cy={91.2} r={0.9} fill="#E7AFC0" />
        </G>
      ))}
      {/* A satin bow at the neckline. */}
      <Path d="M 50 40 C 45 35 41 37 42 41 C 43 44 47 43 50 40 Z" fill="#D2748F" />
      <Path d="M 50 40 C 55 35 59 37 58 41 C 57 44 53 43 50 40 Z" fill="#C7627F" />
      <Circle cx={50} cy={40.2} r={1.6} fill="#B85473" />
      <Glint x={80} y={46} r={5} colour="#F4B7C8" />
      <Glint x={20} y={62} r={3.4} colour="#F9D3DE" />
    </G>
  );
}

/** Air dry: a shirt and a towel pegged on a line under the sun. */
function AirDry({ id }: { id: string }) {
  const line = 'M 4 34 Q 50 44 96 34';
  const towel = 'M 58 39.5 H 82 V 80 C 82 82 81 83 79 83 H 61 C 59 83 58 82 58 80 Z';
  return (
    <G>
      <Defs>
        <RadialGradient id={`${id}-sun`} cx="0.4" cy="0.38" r="0.7">
          <Stop offset="0" stopColor="#FFE9A3" />
          <Stop offset="0.55" stopColor="#FFC233" />
          <Stop offset="1" stopColor="#F29D12" />
        </RadialGradient>
        <RampGradient id={`${id}-shirt`} colour="#3E7CC9" ramp={CLOTH} />
        <RampGradient id={`${id}-towel`} colour="#27A3A0" ramp={CLOTH} />
        <RampGradient id={`${id}-peg`} colour="#D8B07A" ramp={CLOTH} />
      </Defs>
      {/* The sun, and its rays. */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <Path
            key={deg}
            d={`M ${80 + Math.cos(rad) * 12} ${16 + Math.sin(rad) * 12} L ${80 + Math.cos(rad) * 16} ${16 + Math.sin(rad) * 16}`}
            stroke="#FFB21E"
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}
      <Circle cx={80} cy={16} r={9} fill={`url(#${id}-sun)`} />
      {/* A breeze through the washing. */}
      <Path d="M 8 60 C 14 57 20 63 26 60" stroke="#9FC3EE" strokeWidth={1.4} strokeLinecap="round" fill="none" />
      <Path d="M 4 70 C 10 67 16 73 22 70" stroke="#C3DAF5" strokeWidth={1.2} strokeLinecap="round" fill="none" />

      <Path d={line} stroke="#7C8796" strokeWidth={1.1} fill="none" />
      {/* The shirt, hung by its shoulders, a little lifted by the wind. */}
      <G transform="translate(12 30) scale(0.46) rotate(-4 50 50)">
        <Tee id={id} fill={`url(#${id}-shirt)`} />
      </G>
      {/* The towel: a long rectangle with a woven band near its hem. */}
      <Path d={towel} fill={`url(#${id}-towel)`} />
      <Rect x={58} y={70} width={24} height={3} fill="#FFFFFF" opacity={0.55} />
      <Rect x={58} y={74.5} width={24} height={1.2} fill="#FFFFFF" opacity={0.4} />
      <Path d={towel} fill={`url(#${id}-side)`} />
      {/* Pegs. */}
      {[
        [24, 38.2],
        [42, 40.6],
        [61, 40.2],
        [79, 38.4],
      ].map(([x, y]) => (
        <Rect key={x} x={x - 1.4} y={y - 4} width={2.8} height={7} rx={1} fill={`url(#${id}-peg)`} />
      ))}
      <Ellipse cx={50} cy={96} rx={30} ry={2} fill="#0B1422" opacity={0.08} />
    </G>
  );
}

const DRAWINGS: Record<TogglePreference, (props: { id: string }) => React.ReactElement> = {
  separate_whites: Whites,
  delicates: Delicates,
  air_dry: AirDry,
};

export function TouchArt({ touch, size }: { touch: TogglePreference; size: number }) {
  const Drawing = DRAWINGS[touch];
  // SVG ids share one namespace per document; one id per drawing keeps them apart.
  const id = `touch${touch.replace(/_/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SharedLight id={id} />
      </Defs>
      <Drawing id={id} />
    </Svg>
  );
}
