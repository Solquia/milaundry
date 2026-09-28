/**
 * The heavy extras, each drawn as itself, the way the services shelf draws
 * its objects.
 *
 * Every extra used to borrow the shelf's one beddings drawing, so a booking
 * with bedsheets, two comforters and a large item showed four copies of the
 * same throw in four dyes. These are the same studio objects (`photo-kit`) —
 * cloth ramped from a lit crown into a deep fold, the lamp side and the far
 * side, a contact shadow under whatever stands — one per kind of thing:
 *
 *   - sheets: a crisp stack of folded flat sheets, a pillowcase on top
 *   - blanket: a plaid fleece folded in thirds
 *   - comforter: a puffy quilted comforter folded over once
 *   - bulky: the extra-thick one — three deep quilted folds, visibly bigger
 *   - pillow: two plump pillows, one leaning on the other
 *   - rug: a rug half rolled, fringe at its end
 *   - toy: a stuffed bear sitting up
 *   - sack: a big drawstring laundry sack, for whatever the shop didn't name
 *
 * Curtains and shoes already have shelf drawings, so those reuse them.
 */
import React from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

import type { ExtraArt as ExtraArtKey } from '@/lib/domain/heavy-items';
import { mixTone } from '@/lib/domain/service-scene';

import { CLOTH, Fold, RampGradient, SharedLight, pillowPath } from './photo-kit';

interface Drawing {
  id: string;
  /** The main fabric; a sibling on the same drawing arrives in another dye. */
  cloth: string;
}

/** The soft shadow every standing object leaves on the ground. */
function Ground({ cx, rx }: { cx: number; rx: number }) {
  return <Ellipse cx={cx} cy={96} rx={rx} ry={2.6} fill="#0B1422" opacity={0.18} />;
}

/** A thick puffed slab — one fold of a comforter — with diamond quilting clipped to it. */
function Puff({
  id,
  x,
  y,
  w,
  h,
  fill,
  step,
}: {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  step: number;
}) {
  const body = pillowPath(x, y, w, h, 4);
  const clip = `${id}-puff${Math.round(y)}`;
  const stitches: string[] = [];
  for (let at = x - h; at < x + w; at += step) {
    stitches.push(`M ${at} ${y} L ${at + h} ${y + h}`, `M ${at + h} ${y} L ${at} ${y + h}`);
  }
  return (
    <G>
      <Defs>
        <ClipPath id={clip}>
          <Path d={body} />
        </ClipPath>
      </Defs>
      <Rect x={x + 2} y={y + h - 1.5} width={w - 4} height={4} rx={2} fill={`url(#${id}-seam)`} />
      <Path d={body} fill={fill} />
      <G clipPath={`url(#${clip})`}>
        {stitches.map((d) => (
          <Path key={d} d={d} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={0.7} strokeDasharray={[1.4, 1.1]} />
        ))}
      </G>
      <Path d={body} fill={`url(#${id}-side)`} />
      <Path
        d={`M ${x + 6} ${y + 1.6} Q ${x + w / 2} ${y + 3} ${x + w - 6} ${y + 1.6}`}
        stroke={`url(#${id}-spec)`}
        strokeWidth={1.2}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
}

function Sheets({ id, cloth }: Drawing) {
  const dyes = ['#F3F5F9', mixTone(cloth, 0.55), '#F7EEDC', mixTone(cloth, 0.35), '#E7F1EC'];
  const pillowcase = pillowPath(22, 36, 58, 13, 2.4);
  return (
    <G>
      <Defs>
        {dyes.map((dye, i) => (
          <RampGradient key={i} id={`${id}-s${i}`} colour={dye} ramp={CLOTH} />
        ))}
        <RampGradient id={`${id}-case`} colour={mixTone(cloth, 0.2)} ramp={CLOTH} />
      </Defs>
      <Ground cx={52} rx={42} />
      {dyes.map((_, i) => (
        <Fold
          key={i}
          id={id}
          x={8 + (i % 2) * 2}
          y={86 - i * 8}
          w={84 - (i % 2) * 3}
          h={8}
          fill={`url(#${id}-s${i})`}
          weave={i % 2 ? 'stripe' : 'plain'}
          hasSeam={i > 0}
        />
      ))}
      {/* A pillowcase laid on top, stitched along its hem. */}
      <Path d={pillowcase} fill={`url(#${id}-case)`} />
      <Path d="M 24 44 H 78" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={1} strokeDasharray={[1.6, 1.2]} />
      <Path d={pillowcase} fill={`url(#${id}-side)`} />
    </G>
  );
}

function Blanket({ id, cloth }: Drawing) {
  const check = mixTone(cloth, -0.35);
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-fleece`} colour={cloth} ramp={CLOTH} />
      </Defs>
      <Ground cx={52} rx={44} />
      {[0, 1, 2].map((i) => {
        const y = 78 - i * 17;
        const body = pillowPath(8, y, 86, 17, 3.6);
        return (
          <G key={i}>
            {i > 0 ? <Rect x={10} y={y + 15.5} width={82} height={4} rx={2} fill={`url(#${id}-seam)`} /> : null}
            <Path d={body} fill={`url(#${id}-fleece)`} />
            {/* Plaid: dark bands down and across, a light thread through the middle. */}
            {[24, 50, 76].map((x) => (
              <Rect key={x} x={x} y={y + 1} width={6} height={15} fill={check} opacity={0.35} />
            ))}
            <Rect x={9} y={y + 6.5} width={84} height={4} fill={check} opacity={0.3} />
            <Path d={`M 9 ${y + 8.5} H 93`} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={0.6} />
            <Path d={body} fill={`url(#${id}-side)`} />
          </G>
        );
      })}
    </G>
  );
}

function Comforter({ id, cloth }: Drawing) {
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-down`} colour={cloth} ramp={CLOTH} />
        <RampGradient id={`${id}-top`} colour={mixTone(cloth, 0.12)} ramp={CLOTH} />
      </Defs>
      <Ground cx={52} rx={44} />
      <Puff id={id} x={6} y={70} w={90} h={25} fill={`url(#${id}-down)`} step={11} />
      <Puff id={id} x={10} y={46} w={84} h={25} fill={`url(#${id}-top)`} step={11} />
    </G>
  );
}

function Bulky({ id, cloth }: Drawing) {
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-d0`} colour={mixTone(cloth, -0.06)} ramp={CLOTH} />
        <RampGradient id={`${id}-d1`} colour={cloth} ramp={CLOTH} />
        <RampGradient id={`${id}-d2`} colour={mixTone(cloth, 0.14)} ramp={CLOTH} />
      </Defs>
      <Ground cx={51} rx={47} />
      <Puff id={id} x={2} y={68} w={96} h={28} fill={`url(#${id}-d0)`} step={13} />
      <Puff id={id} x={5} y={40} w={91} h={29} fill={`url(#${id}-d1)`} step={13} />
      <Puff id={id} x={9} y={12} w={85} h={29} fill={`url(#${id}-d2)`} step={13} />
    </G>
  );
}

function Pillow({ id, cloth }: Drawing) {
  const back = pillowPath(18, 30, 70, 34, 6);
  const front = pillowPath(6, 56, 76, 38, 6);
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-back`} colour={mixTone(cloth, 0.25)} ramp={CLOTH} />
        <RampGradient id={`${id}-front`} colour={cloth} ramp={CLOTH} />
      </Defs>
      <Ground cx={48} rx={42} />
      <Path d={back} fill={`url(#${id}-back)`} />
      <Path d={back} fill={`url(#${id}-side)`} />
      <Rect x={10} y={54} width={70} height={5} rx={2.5} fill={`url(#${id}-seam)`} />
      <Path d={front} fill={`url(#${id}-front)`} />
      {/* The piping round its edge, and the dimple a pillow keeps in its middle. */}
      <Path d={front} stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={0.8} fill="none" />
      <Circle cx={44} cy={75} r={1.6} fill="#0B1422" opacity={0.2} />
      <Path d={front} fill={`url(#${id}-side)`} />
      <Path d="M 14 58.4 Q 44 60 76 58.4" stroke={`url(#${id}-spec)`} strokeWidth={1.4} strokeLinecap="round" fill="none" />
    </G>
  );
}

function Rug({ id, cloth }: Drawing) {
  const band = mixTone(cloth, -0.4);
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-weft`} colour={cloth} ramp={CLOTH} isAcross />
        <RampGradient id={`${id}-flat`} colour={mixTone(cloth, 0.08)} ramp={CLOTH} />
      </Defs>
      <Ground cx={50} rx={46} />
      {/* The unrolled part lying flat, a border woven in, fringe at its end. */}
      <Path d="M 34 80 L 96 80 L 96 94 L 34 94 Z" fill={`url(#${id}-flat)`} />
      <Rect x={40} y={83} width={50} height={8} fill="none" stroke={band} strokeOpacity={0.6} strokeWidth={1.2} />
      {Array.from({ length: 10 }, (_, i) => (
        <Path key={i} d={`M 96 ${81 + i * 1.3} H 99.5`} stroke="#EDE3D2" strokeWidth={0.7} />
      ))}
      {/* The roll: a fat cylinder, its end spiralling in. */}
      <Rect x={4} y={50} width={36} height={44} rx={4} fill={`url(#${id}-weft)`} />
      {[58, 66, 74, 82].map((y) => (
        <Path key={y} d={`M 5 ${y} H 39`} stroke={band} strokeOpacity={0.35} strokeWidth={1.4} />
      ))}
      <Ellipse cx={40} cy={72} rx={9} ry={22} fill={mixTone(cloth, -0.18)} />
      <Path
        d="M 40 58 C 46 62 46 82 40 86 C 36 82 36 66 40 64 C 43 66 43 78 40 80"
        stroke={band}
        strokeOpacity={0.6}
        strokeWidth={1.2}
        fill="none"
      />
      <Rect x={4} y={50} width={36} height={44} rx={4} fill={`url(#${id}-side)`} />
    </G>
  );
}

function Toy({ id, cloth }: Drawing) {
  const muzzle = mixTone(cloth, 0.45);
  const fur = `url(#${id}-fur)`;
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-fur`} colour={cloth} ramp={CLOTH} />
      </Defs>
      <Ground cx={50} rx={30} />
      {/* Body, arms at its sides, legs out in front. */}
      <Ellipse cx={50} cy={72} rx={24} ry={22} fill={fur} />
      <Ellipse cx={30} cy={70} rx={8} ry={13} fill={fur} transform="rotate(20 30 70)" />
      <Ellipse cx={70} cy={70} rx={8} ry={13} fill={fur} transform="rotate(-20 70 70)" />
      <Ellipse cx={38} cy={90} rx={11} ry={7} fill={fur} />
      <Ellipse cx={62} cy={90} rx={11} ry={7} fill={fur} />
      <Circle cx={38} cy={90} r={4.4} fill={muzzle} />
      <Circle cx={62} cy={90} r={4.4} fill={muzzle} />
      <Ellipse cx={50} cy={74} rx={12} ry={13} fill={muzzle} opacity={0.6} />
      <Ellipse cx={50} cy={72} rx={24} ry={22} fill={`url(#${id}-side)`} />
      {/* Head and ears. */}
      <Circle cx={30} cy={22} r={8} fill={fur} />
      <Circle cx={70} cy={22} r={8} fill={fur} />
      <Circle cx={30} cy={22} r={4} fill={muzzle} />
      <Circle cx={70} cy={22} r={4} fill={muzzle} />
      <Circle cx={50} cy={36} r={20} fill={fur} />
      <Ellipse cx={50} cy={43} rx={9} ry={7} fill={muzzle} />
      <Ellipse cx={50} cy={40} rx={3.4} ry={2.4} fill="#2A1E17" />
      <Path d="M 50 42.4 V 45 M 46 46 Q 50 49 54 46" stroke="#2A1E17" strokeWidth={1} strokeLinecap="round" fill="none" />
      <Circle cx={42} cy={32} r={2.2} fill="#2A1E17" />
      <Circle cx={58} cy={32} r={2.2} fill="#2A1E17" />
      <Circle cx={42.7} cy={31.3} r={0.7} fill="#FFFFFF" />
      <Circle cx={58.7} cy={31.3} r={0.7} fill="#FFFFFF" />
      <Circle cx={50} cy={36} r={20} fill={`url(#${id}-side)`} />
    </G>
  );
}

function Sack({ id, cloth }: Drawing) {
  const sack = 'M 30 30 C 18 40 8 58 10 78 C 11 90 20 96 34 96 H 66 C 80 96 89 90 90 78 C 92 58 82 40 70 30 Z';
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-canvas`} colour={cloth} ramp={CLOTH} />
        <RampGradient id={`${id}-neck`} colour={mixTone(cloth, 0.15)} ramp={CLOTH} />
      </Defs>
      <Ground cx={50} rx={40} />
      {/* What's inside, peeking out of the neck. */}
      <Path d="M 34 22 C 38 12 48 14 50 20 C 54 10 66 12 66 22 Z" fill="#F0B3C4" />
      <Path d="M 40 22 C 44 16 52 16 56 22 Z" fill="#8FC3E8" />
      <Path d={sack} fill={`url(#${id}-canvas)`} />
      {/* Canvas folds pulled toward the tie. */}
      {['M 36 34 C 30 50 28 70 32 92', 'M 50 34 C 49 54 50 74 50 94', 'M 64 34 C 70 50 72 70 68 92'].map((d) => (
        <Path key={d} d={d} stroke="#0B1422" strokeOpacity={0.14} strokeWidth={2.2} strokeLinecap="round" fill="none" />
      ))}
      <Path d="M 22 60 C 34 56 66 56 78 60" stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d={sack} fill={`url(#${id}-side)`} />
      {/* The gathered neck and its drawstring, tied in a loop. */}
      <Path d="M 28 24 C 40 30 60 30 72 24 L 70 32 C 60 36 40 36 30 32 Z" fill={`url(#${id}-neck)`} />
      <Path d="M 30 29 C 42 34 58 34 70 29" stroke="#E7D6B8" strokeWidth={1.8} fill="none" />
      <Path d="M 66 30 C 76 32 80 42 74 46 C 70 48 68 42 72 38" stroke="#E7D6B8" strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </G>
  );
}

type DrawnArt = Exclude<ExtraArtKey, 'curtain' | 'shoe'>;

const DRAWINGS: Record<DrawnArt, (props: Drawing) => React.ReactElement> = {
  sheets: Sheets,
  blanket: Blanket,
  comforter: Comforter,
  bulky: Bulky,
  pillow: Pillow,
  rug: Rug,
  toy: Toy,
  sack: Sack,
};

/** The house colour each drawing was made in. */
const HOUSE_CLOTH: Record<DrawnArt, string> = {
  sheets: '#8FB4E3',
  blanket: '#C8483F',
  comforter: '#9D8BD8',
  bulky: '#E0A45B',
  pillow: '#E9D8C4',
  rug: '#B5624A',
  toy: '#B07A4E',
  sack: '#6E9BC4',
};

/** True for the kinds drawn here; curtains and shoes use the shelf's own drawings. */
export function hasExtraArt(art: ExtraArtKey): art is DrawnArt {
  return art in DRAWINGS;
}

export function ExtraArt({
  art,
  cloth,
  uid,
}: {
  art: DrawnArt;
  /** A sibling's dye, so two comforters on one page are two colours. */
  cloth?: string | null;
  /** Unique per tile: SVG ids share one namespace per document. */
  uid: string;
}) {
  const Drawing = DRAWINGS[art];
  const id = `ex${art}${uid.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        <SharedLight id={id} />
      </Defs>
      <Drawing id={id} cloth={cloth ?? HOUSE_CLOTH[art]} />
    </Svg>
  );
}
