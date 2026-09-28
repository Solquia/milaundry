/**
 * The booking's pieces, drawn like the apps people already book and buy with.
 *
 * Two pages, so a first-timer answers one kind of question at a time: first
 * the laundry — what goes in the drum — then delivery. On the laundry page
 * every choice is already open, the way a food app lays out "customise your
 * order": nothing hides behind a tap, and a newcomer can see at once what the
 * shop offers. The drum at the top is the basket: it fills, bobs and tumbles
 * as things go in, so building a load feels like loading a machine rather
 * than filling in a form.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { BookingPage } from '@/lib/domain/booking-ticket';
import { formatMoneyCompact } from '@/lib/domain/money';
import { minimumLabel, priceSubtitle } from '@/lib/domain/price-label';
import { CATEGORY_LABELS } from '@/lib/domain/service-catalog';
import { showcaseTone } from '@/lib/domain/service-showcase';
import type { ServiceRow } from '@/lib/types';
import { useReducedMotion } from '@/lib/use-reduced-motion';

import { ServicePorthole } from './service-porthole';
import { ShopLogo } from './shop-logo';
import { RADII, colors, space, type } from './ui-kit';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const UNIT_SUFFIX: Record<string, string> = { per_kg: '/kg', per_item: '/pc', flat: '' };

/** One colour per kind of choice, so the cards read apart at a glance. */
export const SECTION_TINTS = {
  load: '#1370CE',
  heavy: '#6D3FD4',
  addons: '#0E7490',
  wash: '#0B7A45',
  place: '#C2410C',
  schedule: '#1370CE',
} as const;

/** 12% of a tint: the badge behind an icon drawn in the full colour. */
const BADGE_ALPHA = '1F';

/** Eases the next layout change on the phones; the web just redraws. */
export function useTicketMotion(): () => void {
  const isReduced = useReducedMotion();
  return () => {
    if (isReduced || Platform.OS === 'web') return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };
}

/** Who the customer is booking with, for the slim header. */
export interface TicketShop {
  name: string;
  logoUrl: string | null;
}

/**
 * The service as the item on sale, its drum filling as the load goes in.
 *
 * Compact when the load picker below draws its own drum: two washers on one
 * screen say the same thing twice, so the top keeps to words — the shop's
 * mark, the category chosen, the service and its price.
 */
export function TicketHeader({
  service,
  level,
  tumbleKey,
  readout,
  isLoaded,
  shop,
  isCompact = false,
}: {
  service: ServiceRow;
  /** 0–1, from `portholeLevel`. */
  level: number;
  /** Changes whenever something goes in, so the load tumbles once. */
  tumbleKey: string;
  /** The count on the drum's little display. */
  readout: string | null;
  isLoaded: boolean;
  shop?: TicketShop;
  isCompact?: boolean;
}) {
  const tone = showcaseTone(service.category);
  const minimum = minimumLabel(service);
  if (isCompact) {
    return (
      <View style={styles.slim}>
        {shop ? <ShopLogo name={shop.name} logoUrl={shop.logoUrl} size={48} shape="plate" /> : null}
        <View style={styles.slimText}>
          <View style={[styles.categoryChip, { backgroundColor: tone.field }]}>
            <Text style={[styles.categoryText, { color: tone.ink }]} numberOfLines={1}>
              {CATEGORY_LABELS[service.category] ?? CATEGORY_LABELS.other}
            </Text>
          </View>
          <Text style={styles.slimName} numberOfLines={2}>
            {service.name}
          </Text>
          <Text style={styles.slimPrice} numberOfLines={1}>
            {priceSubtitle(service)}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.hero}>
      <View style={[styles.heroArt, { backgroundColor: tone.bg }]}>
        {/* Soap bubbles drifting in the band: decoration only. */}
        <View style={[styles.bubble, styles.bubbleA]} />
        <View style={[styles.bubble, styles.bubbleB]} />
        <View style={[styles.bubble, styles.bubbleC]} />
        <ServicePorthole
          service={service}
          size={136}
          level={level}
          waterTint={tone.bg}
          tumbleKey={tumbleKey}
          isSloshing={isLoaded}
          readout={readout}
        />
      </View>
      <View style={styles.heroInfo}>
        <View style={styles.heroPriceRow}>
          <Text style={styles.heroPrice} numberOfLines={1}>
            {formatMoneyCompact(service.price)}
            <Text style={styles.heroUnit}>{UNIT_SUFFIX[service.unit] ?? ''}</Text>
          </Text>
          {minimum ? (
            <View style={styles.heroTag}>
              <Text style={styles.heroTagText}>{minimum}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.heroName} numberOfLines={2}>
          {service.name}
        </Text>
      </View>
    </View>
  );
}

const STEPS: readonly { page: BookingPage; label: string; icon: IconName }[] = [
  { page: 'laundry', label: 'Laundry', icon: 'basket' },
  { page: 'delivery', label: 'Delivery', icon: 'bicycle' },
];

/** Where the customer is in the two pages. A finished step can be tapped to go back. */
export function BookingSteps({
  page,
  onGoTo,
  labels,
}: {
  page: BookingPage;
  onGoTo: (page: BookingPage) => void;
  /** Other words for the steps; the market calls the first one "Basket". */
  labels?: Partial<Record<BookingPage, string>>;
}) {
  const steps = STEPS.map((step) => ({ ...step, label: labels?.[step.page] ?? step.label }));
  const current = steps.findIndex((step) => step.page === page);
  return (
    <View style={styles.steps} accessibilityRole="progressbar" accessibilityLabel={`Step ${current + 1} of 2`}>
      {steps.map((step, index) => {
        const isCurrent = index === current;
        const isDone = index < current;
        return (
          <React.Fragment key={step.page}>
            {index > 0 ? <View style={[styles.stepLine, index <= current && styles.stepLineOn]} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isDone ? `Back to ${step.label}` : step.label}
              disabled={!isDone}
              onPress={() => onGoTo(step.page)}
              style={[styles.step, (isCurrent || isDone) && styles.stepOn]}
            >
              <Ionicons
                name={isDone ? 'checkmark' : step.icon}
                size={15}
                color={isCurrent || isDone ? colors.onAccent : colors.subtle}
              />
              <Text style={[styles.stepText, (isCurrent || isDone) && styles.stepTextOn]}>
                {step.label}
              </Text>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

/** A book-again ticket, filled from last time. */
export function RebookBanner({ dropped }: { dropped: readonly string[] }) {
  return (
    <View style={styles.rebook}>
      <Ionicons name="refresh-circle" size={22} color={colors.actionInk} />
      <View style={styles.rebookText}>
        <Text style={styles.rebookTitle}>Same as last time</Text>
        {dropped.length > 0 ? (
          <Text style={styles.rebookDropped}>No longer offered: {dropped.join(', ')}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** One choice, laid open: a coloured badge, a title, and the picker under it. */
export function Section({
  icon,
  tint,
  title,
  subtitle,
  amount,
  isOptional = false,
  problem,
  children,
}: {
  icon: IconName;
  tint: string;
  title: string;
  subtitle?: string;
  /** What the choice adds to the total, when it adds anything. */
  amount?: string | null;
  isOptional?: boolean;
  problem?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, problem ? styles.cardProblem : null]}>
      <View style={styles.head}>
        <Badge icon={icon} tint={tint} />
        <View style={styles.headText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {amount ? (
          <Text style={styles.amount}>{amount}</Text>
        ) : isOptional ? (
          <View style={styles.optional}>
            <Text style={styles.optionalText}>Optional</Text>
          </View>
        ) : null}
      </View>
      {problem ? <Text style={styles.problemText}>{problem}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

function Badge({ icon, tint }: { icon: IconName; tint: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${tint}${BADGE_ALPHA}` }]}>
      <Ionicons name={icon} size={18} color={tint} />
    </View>
  );
}

/** A count, answered on its own line with − and +. */
export function StepperRow({
  title,
  value,
  onChange,
  min = 0,
  max,
  unit,
  amount,
  problem,
}: {
  title: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max: number;
  /** Said to a screen reader after the number, e.g. "pieces". */
  unit: string;
  amount?: string | null;
  problem?: string | null;
}) {
  const canLower = value > min;
  const canRaise = value < max;
  return (
    <View style={[styles.card, problem ? styles.cardProblem : null]}>
      <View style={[styles.head, styles.headOnly]}>
        <Badge icon="shirt" tint={SECTION_TINTS.load} />
        <View style={styles.headText}>
          <Text style={styles.title}>{title}</Text>
          {amount ? <Text style={styles.subtitle}>{amount}</Text> : null}
        </View>
        <View
          style={styles.stepper}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${title}, ${value} ${unit}`}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment' && canRaise) onChange(value + 1);
            if (event.nativeEvent.actionName === 'decrement' && canLower) onChange(value - 1);
          }}
        >
          <StepButton icon="remove" isEnabled={canLower} onPress={() => onChange(value - 1)} />
          <Text style={styles.count}>{value}</Text>
          <StepButton icon="add" isEnabled={canRaise} onPress={() => onChange(value + 1)} />
        </View>
      </View>
      {problem ? <Text style={styles.problemText}>{problem}</Text> : null}
    </View>
  );
}

function StepButton({
  icon,
  isEnabled,
  onPress,
}: {
  icon: 'add' | 'remove';
  isEnabled: boolean;
  onPress: () => void;
}) {
  const isAdd = icon === 'add';
  return (
    <Pressable
      importantForAccessibility="no"
      accessibilityElementsHidden
      disabled={!isEnabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepButton,
        isAdd && isEnabled && styles.stepButtonAdd,
        !isEnabled && styles.stepButtonOff,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={18} color={isAdd && isEnabled ? colors.onAccent : colors.actionInk} />
    </Pressable>
  );
}

export interface ChoiceTile<K extends string> {
  key: K;
  icon: IconName;
  title: string;
  detail: string;
}

/** Two or three big pictures to pick between, like choosing a ride. */
export function ChoiceTiles<K extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly ChoiceTile<K>[];
  value: K;
  onChange: (next: K) => void;
}) {
  return (
    <View style={styles.tiles} accessibilityRole="radiogroup">
      {options.map((option) => {
        const isOn = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: isOn }}
            accessibilityLabel={`${option.title}. ${option.detail}`}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [styles.tile, isOn && styles.tileOn, pressed && styles.pressed]}
          >
            <View style={[styles.tileIcon, isOn && styles.tileIconOn]}>
              <Ionicons name={option.icon} size={26} color={isOn ? colors.onAccent : colors.actionInk} />
            </View>
            <Text style={styles.tileTitle}>{option.title}</Text>
            <Text style={styles.tileDetail}>{option.detail}</Text>
            {isOn ? (
              <View style={styles.tileCheck}>
                <Ionicons name="checkmark" size={14} color={colors.onAccent} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Page one, folded into a line at the top of page two, with the way back. */
export function BasketRecap({
  title,
  detail,
  onEdit,
}: {
  title: string;
  detail: string;
  onEdit: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}. Edit laundry`}
      onPress={onEdit}
      style={({ pressed }) => [styles.recap, pressed && styles.pressed]}
    >
      <Badge icon="basket" tint={SECTION_TINTS.load} />
      <View style={styles.headText}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Text style={styles.edit}>Edit</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },

  slim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.cosy,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
  },
  slimText: { flex: 1, minWidth: 0, gap: 2 },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.snug,
    paddingVertical: 2,
    borderRadius: RADII.pill,
  },
  categoryText: { ...type.caption, fontSize: 11, fontWeight: '700' },
  slimName: { ...type.label, fontSize: 17, lineHeight: 22, color: colors.text },
  slimPrice: { ...type.caption, color: colors.actionInk },

  hero: { borderRadius: RADII.card, overflow: 'hidden', backgroundColor: colors.card },
  heroArt: { height: 176, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.45)' },
  bubbleA: { width: 46, height: 46, top: 18, left: 28 },
  bubbleB: { width: 22, height: 22, bottom: 30, left: 70 },
  bubbleC: { width: 64, height: 64, top: 40, right: 24, backgroundColor: 'rgba(255,255,255,0.3)' },
  heroInfo: { gap: 2, padding: space.room },
  heroPriceRow: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  heroPrice: { ...type.hero, fontSize: 30, lineHeight: 36, color: colors.actionInk },
  heroUnit: { ...type.label, color: colors.subtle },
  heroTag: {
    paddingHorizontal: space.snug,
    paddingVertical: 2,
    borderRadius: RADII.pill,
    backgroundColor: colors.actionSurface,
  },
  heroTagText: { ...type.caption, color: colors.actionInk },
  heroName: { ...type.section, color: colors.text },

  steps: { flexDirection: 'row', alignItems: 'center' },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: space.cosy,
    borderRadius: RADII.pill,
    backgroundColor: colors.card,
  },
  stepOn: { backgroundColor: colors.action },
  stepText: { ...type.label, color: colors.subtle },
  stepTextOn: { color: colors.onAccent },
  stepLine: { flex: 1, height: 2, marginHorizontal: space.snug, backgroundColor: colors.border },
  stepLineOn: { backgroundColor: colors.action },

  rebook: {
    flexDirection: 'row',
    gap: space.snug,
    alignItems: 'center',
    paddingVertical: space.snug,
    paddingHorizontal: space.cosy,
    borderRadius: RADII.control,
    backgroundColor: colors.actionSurface,
  },
  rebookText: { flex: 1, gap: 2 },
  rebookTitle: { ...type.label, color: colors.actionInk },
  rebookDropped: { ...type.caption, color: colors.moneyOut },

  card: {
    padding: space.room,
    gap: space.cosy,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  cardProblem: { borderColor: colors.dangerInk },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  headOnly: { minHeight: 40 },
  headText: { flex: 1, minWidth: 0, gap: 1 },
  badge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.label, fontSize: 16, lineHeight: 21, color: colors.text },
  subtitle: { ...type.caption, color: colors.subtle },
  amount: { ...type.label, color: colors.actionInk },
  optional: {
    paddingHorizontal: space.snug,
    paddingVertical: 2,
    borderRadius: RADII.pill,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionalText: { ...type.caption, fontSize: 11, color: colors.subtle },
  problemText: { ...type.caption, color: colors.dangerInk },
  body: { gap: space.cosy },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.actionMuted,
    backgroundColor: colors.card,
  },
  stepButtonAdd: { backgroundColor: colors.action, borderColor: colors.action },
  stepButtonOff: { opacity: 0.35 },
  count: { ...type.value, fontSize: 20, minWidth: 26, textAlign: 'center', color: colors.text },

  tiles: { flexDirection: 'row', gap: space.snug },
  tile: {
    flex: 1,
    gap: 4,
    padding: space.cosy,
    borderRadius: RADII.control,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tileOn: { borderColor: colors.action, backgroundColor: colors.actionSurface },
  tileIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    backgroundColor: colors.actionSurface,
  },
  tileIconOn: { backgroundColor: colors.action },
  tileTitle: { ...type.label, color: colors.text },
  tileDetail: { ...type.caption, color: colors.subtle },
  tileCheck: {
    position: 'absolute',
    top: space.snug,
    right: space.snug,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.action,
  },

  recap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.cosy,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
  },
  edit: { ...type.label, color: colors.actionInk },
});
