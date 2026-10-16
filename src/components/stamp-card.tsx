/**
 * The loyalty card a customer carries for one shop: a row of stamps that fill
 * as their laundry is finished, the sentence that says how close the next
 * reward is, and the shop's other perks under it.
 *
 * Drawn as a punch card because everyone already knows how one works — a
 * half-full card is an errand left undone, which is the whole point. With no
 * standing (an owner's preview, a signed-out visitor) it shows the offer on
 * an empty card instead.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  KIND_LABELS,
  customerNudge,
  programHeadline,
  stampProgress,
  type RewardProgram,
  type RewardStanding,
} from '@/lib/domain/rewards';

import { glassChip, glassPane, useIsGlass } from './glass';
import { RADII, TAG_TONES, colors, elevation, space, type } from './ui-kit';
import { fontFor } from '@/lib/domain/design-scale';

/** Past this many the circles stop fitting a phone row; the count says it instead. */
const MAX_DRAWN_STAMPS = 20;
const STAMP_SIZE = 34;

const PERK_ICONS = {
  stamp_card: 'ribbon-outline',
  welcome: 'sparkles-outline',
  regular: 'star-outline',
} as const;

function Stamps({ program, visits }: { program: RewardProgram; visits: number }) {
  const { filled, isReady } = stampProgress(visits, program.visits_needed, program.ready);
  const isGlass = useIsGlass();
  if (program.visits_needed > MAX_DRAWN_STAMPS) {
    return (
      <Text style={styles.count}>
        {filled} of {program.visits_needed} visits
      </Text>
    );
  }
  const slots = Array.from({ length: program.visits_needed }, (_, index) => index);
  return (
    <View
      style={styles.stamps}
      accessible
      accessibilityLabel={`${filled} of ${program.visits_needed} stamps`}
    >
      {slots.map((index) => {
        const isFilled = index < filled;
        const isPrize = index === program.visits_needed - 1;
        return (
          <View
            key={index}
            style={[
              styles.stamp,
              isGlass && styles.stampGlass,
              isPrize && styles.stampPrize,
              isFilled && styles.stampFilled,
              isFilled && isReady && styles.stampReady,
            ]}
          >
            {isFilled ? (
              <Ionicons name={isPrize ? 'gift' : 'checkmark'} size={18} color={colors.onAccent} />
            ) : isPrize ? (
              <Ionicons name="gift-outline" size={18} color={colors.moneyOut} />
            ) : (
              <Text style={styles.stampNumber}>{index + 1}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Perk({ program }: { program: RewardProgram }) {
  const isGlass = useIsGlass();
  return (
    <View style={[styles.perk, isGlass && styles.perkGlass]}>
      <Ionicons name={PERK_ICONS[program.kind]} size={18} color={colors.actionInk} />
      <View style={styles.perkText}>
        <Text style={styles.perkKind}>{KIND_LABELS[program.kind]}</Text>
        <Text style={styles.perkLine}>{programHeadline(program)}</Text>
      </View>
      {program.ready > 0 ? (
        <View style={styles.readyTag}>
          <Text style={styles.readyText}>Ready</Text>
        </View>
      ) : null}
    </View>
  );
}

type Props = {
  programs: readonly RewardProgram[];
  /** Null for an owner's preview or a visitor who is not signed in. */
  standing: RewardStanding | null;
  title?: string;
};

export function StampCard({ programs, standing, title = 'Loyalty rewards' }: Props) {
  const isGlass = useIsGlass();
  if (programs.length === 0) return null;
  const stamp = programs.find((program) => program.kind === 'stamp_card');
  const perks = programs.filter((program) => program !== stamp);
  const visits = standing?.visits ?? 0;
  const nudge = standing ? customerNudge({ ...standing, programs: [...programs] }) : null;
  const hasReady = programs.some((program) => program.ready > 0);
  const footnote = standing
    ? `A visit counts once your laundry is done. You have ${visits} finished ${
        visits === 1 ? 'visit' : 'visits'
      } here.`
    : 'A visit counts once your laundry is done.';

  return (
    <View style={[styles.card, isGlass && styles.cardGlass, hasReady && styles.cardReady]}>
      <View style={styles.header}>
        <Ionicons name="gift" size={20} color={hasReady ? colors.moneyIn : colors.actionInk} />
        <Text style={styles.title}>{title}</Text>
      </View>

      {nudge ? (
        <Text style={[styles.nudge, hasReady && styles.nudgeReady]} accessibilityLiveRegion="polite">
          {nudge}
        </Text>
      ) : null}

      {stamp ? (
        <View style={styles.stampBlock}>
          <Text style={styles.headline}>{programHeadline(stamp)}</Text>
          <Stamps program={stamp} visits={visits} />
        </View>
      ) : null}

      {perks.map((program) => (
        <Perk key={program.id} program={program} />
      ))}

      <Text style={styles.footnote}>{footnote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.cosy,
    padding: space.room,
    borderRadius: RADII.card - 4,
    borderCurve: 'continuous',
    backgroundColor: colors.card,
    ...elevation.rest,
  },
  cardGlass: { ...glassPane },
  /** A reward waiting: the card takes the green, the way Wallet tints a ready pass. */
  cardReady: {
    backgroundColor: colors.takingsSurface,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  title: { ...type.section, color: colors.text },
  nudge: { ...type.body, fontSize: 15, ...fontFor(600), color: colors.actionInk },
  nudgeReady: { color: colors.moneyIn },
  stampBlock: { gap: space.snug },
  headline: { ...type.label, color: colors.text },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  stamp: {
    width: STAMP_SIZE,
    height: STAMP_SIZE,
    borderRadius: STAMP_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.sunken,
  },
  stampGlass: { ...glassChip, borderWidth: 1.5 },
  stampPrize: { borderColor: '#FF9500', backgroundColor: TAG_TONES.owed.bg },
  stampFilled: { borderColor: colors.action, backgroundColor: colors.action },
  stampReady: { borderColor: colors.moneyIn, backgroundColor: colors.moneyIn },
  stampNumber: { ...type.caption, color: colors.subtle },
  count: { ...type.value, color: colors.actionInk },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    paddingTop: space.cosy,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.22)',
  },
  perkGlass: { borderColor: 'rgba(60, 60, 67, 0.12)' },
  perkText: { flex: 1, gap: 2 },
  perkKind: { ...type.caption, color: colors.subtle },
  perkLine: { ...type.label, color: colors.text },
  readyTag: {
    paddingHorizontal: space.snug,
    paddingVertical: 2,
    borderRadius: RADII.pill,
    backgroundColor: TAG_TONES.settled.bg,
  },
  readyText: { ...type.caption, ...fontFor(700), color: TAG_TONES.settled.ink },
  footnote: { ...type.caption, color: colors.subtle },
});
