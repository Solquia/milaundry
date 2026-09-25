/**
 * The drawn soaps: a pouch of powder, a bar, a bottle of fabcon.
 *
 * Stand-ins, not packaging. A brand is drawn as a generic pack in a colour a
 * shopper would put next to its name, never as its logo — the name under the
 * drawing does the naming. A shop's own photo replaces the drawing as soon as
 * the owner takes one.
 */
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type SoapShape = 'powder' | 'bar' | 'bottle';

/** The colour each well-known name is drawn in; anything else takes one from the palette. */
const NAMED_COLORS: Record<string, string> = {
  ariel: '#1F9D63',
  tide: '#F26B1D',
  breeze: '#2F7BD8',
  surf: '#E0457B',
  champion: '#E9A21B',
  pride: '#7B5CE5',
  perla: '#9FB3C8',
  downy: '#4F6FE0',
  'surf fabcon': '#E26BA6',
  del: '#9B6BD6',
};
const PALETTE = ['#2F7BD8', '#1F9D63', '#E0457B', '#E9A21B', '#7B5CE5', '#F26B1D'];

export function soapColor(name: string): string {
  const key = name.trim().toLowerCase();
  if (NAMED_COLORS[key]) return NAMED_COLORS[key];
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function SoapArt({ shape, color, size = 40 }: { shape: SoapShape; color: string; size?: number }) {
  if (shape === 'bar') {
    return (
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Rect x={5} y={15} width={30} height={17} rx={7} fill="#FFFFFF" stroke={color} strokeWidth={2} />
        <Rect x={10} y={19} width={20} height={5} rx={2.5} fill={color} opacity={0.35} />
        <Circle cx={14} cy={10} r={4} fill="none" stroke={color} strokeWidth={1.6} />
        <Circle cx={24} cy={7} r={2.6} fill="none" stroke={color} strokeWidth={1.4} />
      </Svg>
    );
  }
  if (shape === 'bottle') {
    return (
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Rect x={16} y={3} width={9} height={5} rx={1.5} fill={color} opacity={0.7} />
        <Path
          d="M12 10 Q12 8 14 8 H27 Q30 8 30 11 V34 Q30 37 27 37 H13 Q10 37 10 34 V14 Q10 11 12 10 Z"
          fill={color}
        />
        <Rect x={22} y={12} width={5} height={8} rx={2.5} fill="#FFFFFF" opacity={0.55} />
        <Rect x={13} y={22} width={14} height={9} rx={3} fill="#FFFFFF" opacity={0.85} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path d="M9 7 H31 L33 35 Q33 37 31 37 H9 Q7 37 7 35 Z" fill={color} />
      <Rect x={9} y={4} width={22} height={5} rx={1.5} fill={color} opacity={0.75} />
      <Path d="M8 20 Q14 16 20 20 T32 20 V26 Q26 30 20 26 T8 26 Z" fill="#FFFFFF" opacity={0.85} />
      <Circle cx={20} cy={23} r={3} fill={color} opacity={0.9} />
    </Svg>
  );
}
