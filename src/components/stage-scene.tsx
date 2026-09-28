/**
 * What the tracker's drum shows at each stop of the road.
 *
 * The door used to hold one line icon — a basket, a bag, a smiley — the same
 * glyph as the rail beneath it, only bigger. It named the stage but told no
 * story. These are small illustrations in a sticker style: flat colour with
 * one shade and one highlight per shape, an ink outline in the stage's own
 * darkest tone, and the odd sparkle. Each one shows the moment itself —
 * the basket on the shop's scale being weighed, the pile folded and tied,
 * the bag packed with a tag on it, the rider on the way.
 *
 * Every tone comes from the stage colour with `mixTone`, with a few warm
 * dyes for the laundry itself, so the drum and the rail stay one family.
 */
import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { mixTone } from '@/lib/domain/service-scene';

import { DYE, Folded, LINE, Sparkle, tonesFor, type Tones } from './sticker-kit';

/** The ticket's torn foot: a zigzag from the right edge back to the left. */
const TICKET_FOOT = Array.from({ length: 7 }, (_, i) => `L ${72 - (i + 1) * 6} ${i % 2 ? 80 : 84}`).join(' ');

/** Booked: a laundry ticket fresh off the pad, with a pencil laid across it. */
function Ticket({ t }: { t: Tones }) {
  return (
    <G transform="rotate(-8 50 50)">
      <Path d={`M 30 20 H 72 V 80 ${TICKET_FOOT} Z`} fill={DYE.paper} stroke={t.ink} {...LINE} />
      <Rect x={30} y={20} width={42} height={14} fill={t.base} stroke={t.ink} {...LINE} />
      <Circle cx={51} cy={27} r={3} fill={t.wash} />
      {[42, 50, 58, 66].map((y, i) => (
        <Path key={y} d={`M 36 ${y} H ${i === 3 ? 52 : 66}`} stroke={t.light} strokeWidth={3} strokeLinecap="round" />
      ))}
      <Path d="M 57 64 L 61 68 L 68 60" stroke={DYE.mint} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* The pencil. */}
      <G transform="rotate(38 72 60)">
        <Rect x={66} y={38} width={9} height={34} rx={1.5} fill={DYE.sun} stroke={t.ink} {...LINE} />
        <Rect x={66} y={38} width={9} height={6} fill={DYE.coral} stroke={t.ink} {...LINE} />
        <Path d="M 66 72 L 70.5 81 L 75 72 Z" fill="#F3D2A2" stroke={t.ink} {...LINE} />
      </G>
    </G>
  );
}

/** At the shop: the basket on the counter scale, being weighed. */
function Scale({ t }: { t: Tones }) {
  return (
    <G>
      {/* The scale: a body with a dial, a platform on top. */}
      <Path d="M 26 66 H 74 L 70 86 H 30 Z" fill={t.base} stroke={t.ink} {...LINE} />
      <Path d="M 28 72 H 72" stroke={t.shade} strokeWidth={2.4} />
      <Circle cx={50} cy={77} r={6.5} fill={DYE.paper} stroke={t.ink} {...LINE} />
      <Path d="M 50 77 L 54 73" stroke={DYE.coral} strokeWidth={2} strokeLinecap="round" />
      <Rect x={22} y={60} width={56} height={6} rx={3} fill={t.light} stroke={t.ink} {...LINE} />
      {/* The heap in the basket. */}
      <Circle cx={38} cy={36} r={9} fill={DYE.coral} stroke={t.ink} {...LINE} />
      <Circle cx={62} cy={35} r={8} fill={DYE.mint} stroke={t.ink} {...LINE} />
      <Circle cx={50} cy={31} r={10} fill={DYE.sun} stroke={t.ink} {...LINE} />
      <Path d="M 45 26 Q 50 23 55 26" stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={2} strokeLinecap="round" fill="none" />
      {/* The basket: a tapered weave with a rolled rim. */}
      <Path d="M 27 40 H 73 L 68 60 H 32 Z" fill="#E0A45C" stroke={t.ink} {...LINE} />
      {[46, 53].map((y) => (
        <Path key={y} d={`M ${29 + (y - 40) * 0.25} ${y} H ${71 - (y - 40) * 0.25}`} stroke="#B87A34" strokeWidth={2} />
      ))}
      {[39, 50, 61].map((x) => (
        <Path key={x} d={`M ${x} 42 L ${x + (50 - x) * 0.12} 59`} stroke="#B87A34" strokeWidth={1.6} />
      ))}
      <Rect x={24} y={37} width={52} height={6} rx={3} fill="#F2C07E" stroke={t.ink} {...LINE} />
      <Sparkle x={80} y={30} r={4.5} fill={DYE.sun} />
    </G>
  );
}

/** Folded: the pile squared off and tied with a band in the stage colour. */
function Pile({ t }: { t: Tones }) {
  return (
    <G>
      <Folded x={24} y={70} w={52} h={12} fill={DYE.sky} ink={t.ink} />
      <Folded x={27} y={58} w={46} h={12} fill={DYE.coral} ink={t.ink} />
      <Folded x={25} y={46} w={50} h={12} fill={DYE.mint} ink={t.ink} />
      <Folded x={28} y={34} w={44} h={12} fill={DYE.sun} ink={t.ink} />
      {/* The band and its bow. */}
      <Rect x={46} y={33} width={8} height={50} fill={t.base} stroke={t.ink} {...LINE} />
      <Path d="M 50 33 C 42 22 34 26 40 31 C 43 33 47 33 50 33 C 53 33 57 33 60 31 C 66 26 58 22 50 33 Z" fill={t.base} stroke={t.ink} {...LINE} />
      <Circle cx={50} cy={32} r={3} fill={t.shade} stroke={t.ink} {...LINE} />
      <Sparkle x={20} y={38} r={5} fill={DYE.sun} />
      <Sparkle x={82} y={56} r={3.6} fill={t.light} />
    </G>
  );
}

/** Ready to collect: a packed bag, laundry peeking out, a tag with a tick. */
function Bag({ t }: { t: Tones }) {
  const body = 'M 27 40 H 73 L 76 84 H 24 Z';
  return (
    <G>
      <Path d="M 38 36 C 38 22 62 22 62 36" stroke={t.ink} strokeWidth={4.4} strokeLinecap="round" fill="none" />
      <Path d="M 38 36 C 38 22 62 22 62 36" stroke={t.light} strokeWidth={2} strokeLinecap="round" fill="none" />
      {/* Folded laundry showing over the top. */}
      <Rect x={33} y={32} width={20} height={10} rx={4} fill={DYE.coral} stroke={t.ink} {...LINE} />
      <Rect x={48} y={30} width={20} height={12} rx={4} fill={DYE.sun} stroke={t.ink} {...LINE} />
      <Path d={body} fill={t.base} />
      <Path d="M 60 40 H 73 L 76 84 H 63 Z" fill={t.shade} />
      <Path d={body} fill="none" stroke={t.ink} {...LINE} />
      <Path d="M 32 46 L 30 70" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={2.6} strokeLinecap="round" />
      {/* The tag, tied on at the corner. */}
      <Path d="M 70 46 C 76 48 78 52 78 56" stroke={t.ink} strokeWidth={1.4} fill="none" />
      <G transform="rotate(14 78 64)">
        <Path d="M 71 58 H 85 V 72 H 71 L 67 65 Z" fill={DYE.paper} stroke={t.ink} {...LINE} />
        <Path d="M 73.5 65 L 76.5 68 L 81.5 61.5" stroke={DYE.mint} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </G>
    </G>
  );
}

/** Out for delivery: the rider's scooter with the laundry box on the back. */
function Rider({ t }: { t: Tones }) {
  const frame = 'M 24 64 H 62 C 66 64 70 60 70 56 L 66 30';
  return (
    <G>
      {/* Speed lines, trailing behind. */}
      {[44, 54, 64].map((y, i) => (
        <Path key={y} d={`M ${8 + i * 3} ${y} H ${18 + i * 2}`} stroke={t.light} strokeWidth={3} strokeLinecap="round" />
      ))}
      {/* The box. */}
      <Rect x={22} y={34} width={26} height={24} rx={3} fill={DYE.sun} stroke={t.ink} {...LINE} />
      <Path d="M 22 42 H 48" stroke="#D99A12" strokeWidth={2} />
      <Path d="M 30 50 L 33 47 L 36 50 L 39 47" stroke={t.ink} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      {/* The scooter: deck, stem and bars. */}
      <Path d={frame} stroke={t.ink} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={frame} stroke={t.base} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M 60 30 H 72" stroke={t.ink} strokeWidth={3.6} strokeLinecap="round" />
      <Path d="M 48 64 C 50 56 58 54 66 58" fill={t.base} stroke={t.ink} {...LINE} />
      {/* Wheels. */}
      {[30, 70].map((cx) => (
        <G key={cx}>
          <Circle cx={cx} cy={72} r={9} fill="#2A3340" stroke={t.ink} {...LINE} />
          <Circle cx={cx} cy={72} r={3.6} fill={t.light} />
        </G>
      ))}
      <Circle cx={74} cy={38} r={2.6} fill={DYE.sun} stroke={t.ink} strokeWidth={1.4} />
    </G>
  );
}

/** Delivered: home, with the stack waiting on the step. */
function Home({ t }: { t: Tones }) {
  const roof = 'M 22 48 L 50 24 L 78 48';
  return (
    <G>
      <Path d={roof} fill="none" stroke={t.ink} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M 28 44 V 80 H 72 V 44 L 50 28 Z" fill={DYE.paper} stroke={t.ink} {...LINE} />
      <Path d={roof} fill="none" stroke={t.base} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={36} y={56} width={14} height={24} rx={2} fill={t.base} stroke={t.ink} {...LINE} />
      <Circle cx={46.5} cy={69} r={1.4} fill={DYE.sun} />
      <Rect x={56} y={50} width={10} height={10} rx={1.5} fill={DYE.sky} stroke={t.ink} {...LINE} />
      <Folded x={55} y={72} w={22} h={8} fill={DYE.coral} ink={t.ink} />
      <Folded x={57} y={65} w={18} h={7} fill={DYE.mint} ink={t.ink} />
      <Path d="M 22 80 H 80" stroke={t.ink} strokeWidth={2.4} strokeLinecap="round" />
      <Sparkle x={82} y={30} r={4.4} fill={DYE.sun} />
    </G>
  );
}

/** Collected: a clean tee on its hanger, very pleased with itself. Asleep when the drum is empty. */
function HangingTee({ t, isSleepy = false }: { t: Tones; isSleepy?: boolean }) {
  const tee = 'M 38 34 L 28 38 L 18 50 L 27 57 L 32 52 L 32 82 L 68 82 L 68 52 L 73 57 L 82 50 L 72 38 L 62 34 C 58 40 42 40 38 34 Z';
  return (
    <G>
      <Path d="M 50 26 V 20 A 4.5 4.5 0 1 1 54.5 24.5" stroke={t.ink} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      <Path d="M 28 38 L 50 26 L 72 38" stroke={t.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={tee} fill={isSleepy ? t.light : DYE.sky} stroke={t.ink} {...LINE} />
      <Path d="M 60 44 L 68 52 L 68 82 L 60 82 Z" fill="#0B1422" opacity={0.08} />
      <Path d="M 36 46 L 36 70" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2.6} strokeLinecap="round" />
      {isSleepy ? (
        <G>
          <Path d="M 41 58 Q 44 61 47 58 M 53 58 Q 56 61 59 58" stroke={t.ink} strokeWidth={2} strokeLinecap="round" fill="none" />
          <Path d="M 72 20 H 79 L 72 27 H 79 M 82 12 H 87 L 82 17 H 87" stroke={t.shade} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </G>
      ) : (
        <G>
          <Circle cx={43} cy={57} r={2.2} fill={t.ink} />
          <Circle cx={57} cy={57} r={2.2} fill={t.ink} />
          <Path d="M 43 64 Q 50 71 57 64" stroke={t.ink} strokeWidth={2.2} strokeLinecap="round" fill="none" />
          <Circle cx={39} cy={63} r={2.6} fill={DYE.coral} opacity={0.6} />
          <Circle cx={61} cy={63} r={2.6} fill={DYE.coral} opacity={0.6} />
          <Sparkle x={20} y={30} r={5} fill={DYE.sun} />
          <Sparkle x={84} y={68} r={4} fill={DYE.sun} />
        </G>
      )}
    </G>
  );
}

/** Cancelled: the drum left with a single odd sock. */
function LoneSock({ t }: { t: Tones }) {
  return (
    <G transform="rotate(-18 50 55)">
      <Path d="M 40 22 H 58 V 54 C 58 60 64 62 70 64 C 78 66 78 80 68 80 L 46 79 C 38 79 36 72 38 66 Z" fill={t.light} stroke={t.ink} {...LINE} />
      {[28, 34].map((y) => (
        <Path key={y} d={`M 40 ${y} H 58`} stroke={t.shade} strokeWidth={2.6} />
      ))}
      <Path d="M 66 64 C 72 66 76 70 74 76 C 70 80 66 78 64 74 Z" fill={t.shade} opacity={0.5} />
      <Path d="M 44 40 V 60" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2.4} strokeLinecap="round" />
    </G>
  );
}

const Collected = ({ t }: { t: Tones }) => <HangingTee t={t} />;

/** Which illustration a rail glyph stands for. The glyph is what the journey already names. */
const SCENES: Record<string, (props: { t: Tones }) => React.JSX.Element> = {
  'receipt-outline': Ticket,
  'basket-outline': Scale,
  'layers-outline': Pile,
  'bag-check-outline': Bag,
  'bicycle-outline': Rider,
  'home-outline': Home,
  'happy-outline': Collected,
  'close-circle-outline': LoneSock,
  'close-outline': LoneSock,
};

/**
 * The still scene for a stage, by its rail glyph. Anything without a drawing
 * of its own — including a machine with nothing in it — gets the tee asleep
 * on its hanger.
 */
export function StageScene({ icon, color, size }: { icon: string; color: string; size: number }) {
  const t = tonesFor(color);
  const Scene = SCENES[icon];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {Scene ? <Scene t={t} /> : <HangingTee t={t} isSleepy />}
    </Svg>
  );
}

export type GarmentKind = 'tee' | 'sock' | 'towel';

const GARMENTS: Record<GarmentKind, { d: string; fill: string }> = {
  tee: {
    d: 'M 14 7 L 8 9 L 2 15 L 7 20 L 10 18 L 10 35 L 30 35 L 30 18 L 33 20 L 38 15 L 32 9 L 26 7 C 24 11 16 11 14 7 Z',
    fill: DYE.coral,
  },
  sock: {
    d: 'M 13 4 H 25 V 21 C 25 25 29 27 32 28 C 37 29 38 36 32 37 L 18 36 C 12 36 11 31 12 27 Z',
    fill: DYE.sun,
  },
  towel: { d: 'M 9 5 H 31 C 34 5 35 7 35 10 V 30 C 35 33 34 35 31 35 H 9 C 6 35 5 33 5 30 V 10 C 5 7 6 5 9 5 Z', fill: DYE.mint },
};

/** One piece of the load, tumbling in the drum while a machine runs. */
export function Garment({ kind, color, size }: { kind: GarmentKind; color: string; size: number }) {
  const ink = mixTone(color, -0.55);
  const garment = GARMENTS[kind];
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path d={garment.d} fill={garment.fill} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
      {kind === 'towel' ? <Path d="M 6 27 H 34 M 6 31 H 34" stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={1.6} /> : null}
      <Path d="M 15 14 V 26" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * The inside of the drum behind whatever is in it: light pooling in the
 * middle, a ring of perforations, and — while drying — a warm glow.
 */
export function DrumBackdrop({ color, size, isWarm }: { color: string; size: number; isWarm: boolean }) {
  const c = size / 2;
  const holes = 16;
  const id = `bd${isWarm ? 'w' : 'c'}${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="0.5" cy="0.45" r="0.55">
          <Stop offset="0" stopColor={isWarm ? '#FFE3A3' : '#FFFFFF'} stopOpacity={isWarm ? 0.9 : 0.85} />
          <Stop offset="1" stopColor={isWarm ? DYE.sun : '#FFFFFF'} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={c} fill={`url(#${id})`} />
      {Array.from({ length: holes }, (_, i) => {
        const angle = (i / holes) * Math.PI * 2;
        return (
          <Circle
            key={i}
            cx={c + Math.cos(angle) * c * 0.84}
            cy={c + Math.sin(angle) * c * 0.84}
            r={Math.max(0.8, size * 0.014)}
            fill={mixTone(color, -0.3)}
            opacity={0.22}
          />
        );
      })}
      {/* The gasket's shadow along the top of the glass. */}
      <Ellipse cx={c} cy={c * 0.1} rx={c * 0.9} ry={c * 0.22} fill="#0B1422" opacity={0.06} />
    </Svg>
  );
}
