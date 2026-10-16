/**
 * A long price list asked one question at a time: what is it (a gown, a
 * jacket, a pair of shoes), which one, then what size — each step a real
 * photo of the thing, so nobody reads forty rows to find their price.
 *
 * 1. The boards as photo cards, each with its lowest price.
 * 2. The items on the chosen board (skipped when it holds just one).
 * 3. The chosen item's sizes as price cards. The shop page picks one and
 *    books it; the counter puts each tap on the ticket and shows its count.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { glassChip, glassPane, useIsGlass } from './glass';
import { CROWN, RADII, colors, elevation, fontFor, space, type } from './ui-kit';
import { formatMoneyCompact } from '@/lib/domain/money';
import {
  isFromPrice,
  itemPhotoKey,
  lowestPrice,
  sharedNote,
  type GuideService,
  type ItemPhotoKey,
  type MenuBoardSection,
  type MenuGroup,
} from '@/lib/domain/price-guide';

export interface StepTint {
  /** The chosen card's edge and the book button. */
  fill: string;
  /** Text on a pale surface. */
  ink: string;
  /** The stage each photo stands on. */
  surface: string;
}

const PHOTOS: Record<ItemPhotoKey, ImageSource> = {
  wedding: require('../../assets/images/items/wedding.png'),
  gown: require('../../assets/images/items/gown.png'),
  toga: require('../../assets/images/items/toga.png'),
  leather: require('../../assets/images/items/leather.png'),
  jacket: require('../../assets/images/items/jacket.png'),
  pants: require('../../assets/images/items/pants.png'),
  teddy: require('../../assets/images/items/teddy.png'),
  helmet: require('../../assets/images/items/helmet.png'),
  cap: require('../../assets/images/items/cap.png'),
  bag: require('../../assets/images/items/bag.png'),
  sneakers: require('../../assets/images/items/sneakers.png'),
  bed: require('../../assets/images/price-guides/bubblygav/bedding-blue.png'),
  sofa: require('../../assets/images/services/sofa.webp'),
  curtain: require('../../assets/images/services/curtain.webp'),
  machine: require('../../assets/images/services/machine.webp'),
  stack: require('../../assets/images/services/stack.webp'),
  suit: require('../../assets/images/services/suit.webp'),
  basket: require('../../assets/images/services/basket.webp'),
};

/** Tall enough that a two-line name and the photo never meet, as on the counter's tiles. */
const BOARD_CARD_HEIGHT = 176;

const SIZE_BASIS:Record<number, `${number}%`> = { 1: '100%', 2: '48%', 3: '31.5%' };

/** Two across for two or four sizes (Basic/Deep, S–XL), three for the rest. */
function sizeColumns(count: number): number {
  if (count <= 1) return 1;
  return count === 2 || count === 4 ? 2 : 3;
}

function money(amount: number): string {
  return formatMoneyCompact(amount);
}

function photoFor(...names: string[]): ImageSource {
  return PHOTOS[itemPhotoKey(...names)];
}

/** How many of a board's or an item's prices are on the ticket. */
function onTicket<S extends GuideService>(
  groups: readonly MenuGroup<S>[],
  counts: Readonly<Record<string, number>> | undefined
): number {
  if (!counts) return 0;
  return groups.reduce(
    (total, group) => total + group.options.filter((option) => (counts[option.service.id] ?? 0) > 0).length,
    0
  );
}

function TicketDot({ count, tint }: { count: number; tint: StepTint }) {
  if (count === 0) return null;
  return (
    <View style={[styles.dot, { backgroundColor: tint.fill }]}>
      <Text style={styles.dotText}>{count}</Text>
    </View>
  );
}

function Stage({ source, size, tint }: { source: ImageSource; size: number; tint: StepTint }) {
  return (
    <View style={[styles.stage, { height: size, backgroundColor: tint.surface }]}>
      <Image source={source} style={styles.stagePhoto} contentFit="contain" transition={120} />
    </View>
  );
}

function BoardCard<S extends GuideService>({
  board,
  tint,
  ticket,
  onOpen,
}: {
  board: MenuBoardSection<S>;
  tint: StepTint;
  ticket: number;
  onOpen: () => void;
}) {
  const items = board.groups.length;
  const from = money(lowestPrice(board.groups));
  const isGlass = useIsGlass();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${board.title}, ${items} ${items === 1 ? 'item' : 'items'}, from ${from}`}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.boardCard,
        isGlass && styles.boardCardGlass,
        ticket > 0 && { borderColor: tint.fill },
        pressed && styles.pressed,
      ]}
    >
      {/* Laid out like the counter's service tiles: the name at the top left,
          the thing itself big in the lower right running off the corner, and
          the price at the foot on the left. */}
      <View style={styles.boardArt} pointerEvents="none">
        <Image
          source={photoFor(board.title, board.groups[0]?.name ?? '')}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={120}
        />
      </View>
      <View style={styles.boardHead}>
        <Text style={styles.boardTitle} numberOfLines={3}>
          {board.title}
        </Text>
        <TicketDot count={ticket} tint={tint} />
      </View>
      <View style={styles.boardFoot}>
        <View style={[styles.fromPill, { backgroundColor: tint.surface }]}>
          <Text style={[styles.fromPrice, { color: tint.ink }]} numberOfLines={1}>
            <Text style={styles.fromWord}>from </Text>
            {from}
          </Text>
        </View>
        {items > 1 ? <Text style={styles.itemCount}>{`${items} items`}</Text> : null}
      </View>
    </Pressable>
  );
}

function StepHead({
  step,
  of,
  title,
  prompt,
  onBack,
}: {
  step: number;
  of: number;
  title: string;
  prompt: string;
  onBack: () => void;
}) {
  const isGlass = useIsGlass();
  return (
    <View style={styles.head}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.back, isGlass && styles.backGlass, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <View style={styles.headWords}>
        <Text style={styles.stepCount}>{`STEP ${step} OF ${of} · ${prompt.toUpperCase()}`}</Text>
        <Text style={styles.headTitle} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      </View>
    </View>
  );
}

function ItemRow<S extends GuideService>({
  group,
  board,
  tint,
  ticket,
  isFirst,
  onOpen,
}: {
  group: MenuGroup<S>;
  board: string;
  tint: StepTint;
  ticket: number;
  isFirst: boolean;
  onOpen: () => void;
}) {
  const sizes = group.options.length;
  const from = money(lowestPrice([group]));
  const detail = sizes > 1 ? `${sizes} sizes · from ${from}` : from;
  const isGlass = useIsGlass();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${group.name}, ${detail}`}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.itemRow,
        !isFirst && styles.ruled,
        !isFirst && isGlass && styles.ruledGlass,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: tint.surface }]}>
        <Image source={photoFor(group.name, board)} style={styles.thumbPhoto} contentFit="contain" />
      </View>
      <View style={styles.itemWords}>
        <Text style={styles.itemName} numberOfLines={2}>
          {group.name}
        </Text>
        <Text style={styles.itemDetail}>{detail}</Text>
      </View>
      <TicketDot count={ticket} tint={tint} />
      <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
    </Pressable>
  );
}

function SizeCard<S extends GuideService>({
  label,
  service,
  tint,
  isChosen,
  count,
  countText,
  onPress,
  onLess,
  basis,
}: {
  /** The card's share of the row, so a row of sizes ends where it should. */
  basis: `${number}%`;
  label: string;
  service: S;
  tint: StepTint;
  isChosen: boolean;
  count: number;
  countText: string;
  onPress?: () => void;
  onLess?: () => void;
}) {
  const isFrom = isFromPrice(service.description);
  const isOn = isChosen || count > 0;
  const isGlass = useIsGlass();
  return (
    <View style={[styles.sizeSlot, { flexBasis: basis }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isOn, disabled: !onPress }}
        accessibilityLabel={`${label || service.name}, ${money(service.price)}${isFrom ? ' and up' : ''}`}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.size,
          isGlass && styles.sizeGlass,
          isOn && { borderColor: tint.fill, backgroundColor: tint.surface },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.sizeLabel, isOn && { color: tint.ink, paddingRight: 22 }]} numberOfLines={2}>
          {label || 'Per piece'}
        </Text>
        <Text style={styles.sizePrice} numberOfLines={1} adjustsFontSizeToFit>
          {money(service.price)}
        </Text>
        <Text style={styles.sizeNote}>{isFrom ? 'and up' : ' '}</Text>
        {isChosen ? (
          <View style={[styles.check, { backgroundColor: tint.fill }]}>
            <Ionicons name="checkmark" size={14} color={colors.onAccent} />
          </View>
        ) : null}
        {count > 0 ? (
          <View style={[styles.countTag, { backgroundColor: tint.fill }]}>
            <Text style={styles.dotText}>{countText}</Text>
          </View>
        ) : null}
      </Pressable>
      {count > 0 && onLess ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`One less ${service.name}`}
          onPress={onLess}
          style={({ pressed }) => [styles.less, pressed && styles.pressed]}
        >
          <Ionicons name="remove" size={16} color={tint.ink} />
          <Text style={[styles.lessText, { color: tint.ink }]}>Remove one</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SizeStep<S extends GuideService>({
  group,
  board,
  note,
  tint,
  counts,
  onPick,
  onLess,
  onBook,
  formatCount,
}: {
  group: MenuGroup<S>;
  board: string;
  note: string;
  tint: StepTint;
  counts?: Readonly<Record<string, number>>;
  onPick?: (service: S) => void;
  onLess?: (service: S) => void;
  onBook?: (service: S) => void;
  formatCount?: (service: S, count: number) => string;
}) {
  const isCounter = Boolean(counts);
  const [chosenId, setChosenId] = useState(group.options.length === 1 ? group.options[0].service.id : '');
  const chosen = group.options.find((option) => option.service.id === chosenId);
  const own = group.options[0]?.service.description?.trim() ?? '';
  const itemNote = own && own !== note && !isFromPrice(own) ? own : note;
  const basis = SIZE_BASIS[Math.min(sizeColumns(group.options.length), 3)];
  return (
    <View style={styles.sizeStep}>
      <View style={styles.hero}>
        <Stage source={photoFor(group.name, board)} size={180} tint={tint} />
      </View>
      {itemNote ? (
        <View style={styles.noteRow}>
          <Ionicons name="information-circle-outline" size={16} color={colors.subtle} />
          <Text style={styles.noteText}>{itemNote}</Text>
        </View>
      ) : null}
      <View style={styles.sizes} accessibilityRole={isCounter ? undefined : 'radiogroup'}>
        {group.options.map((option) => {
          const count = counts?.[option.service.id] ?? 0;
          const pick = isCounter
            ? onPick && (() => onPick(option.service))
            : onBook && (() => setChosenId(option.service.id));
          return (
            <SizeCard
              key={option.service.id}
              label={option.label}
              service={option.service}
              tint={tint}
              basis={basis}
              isChosen={!isCounter && option.service.id === chosenId}
              count={count}
              countText={formatCount ? formatCount(option.service, count) : `× ${count}`}
              onPress={pick}
              onLess={onLess ? () => onLess(option.service) : undefined}
            />
          );
        })}
      </View>
      {isCounter || !onBook ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !chosen }}
          disabled={!chosen}
          onPress={chosen ? () => onBook(chosen.service) : undefined}
          style={({ pressed }) => [
            styles.book,
            { backgroundColor: chosen ? tint.fill : colors.sunken },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.bookText, styles.bookName, !chosen && styles.bookIdle]} numberOfLines={1}>
            {chosen ? `Book ${[group.name, chosen.label].filter(Boolean).join(' · ')}` : 'Choose a size to book'}
          </Text>
          {chosen ? <Text style={styles.bookText}>{money(chosen.service.price)}</Text> : null}
          {chosen ? <Ionicons name="arrow-forward" size={18} color={colors.onAccent} /> : null}
        </Pressable>
      )}
    </View>
  );
}

/**
 * The boards as a three-step picker. Pass `counts` on the counter: a size
 * tap then goes straight on the ticket (`onPick`) instead of being chosen
 * and booked (`onBook`).
 */
export function ServiceSteps<S extends GuideService>({
  sections,
  tint,
  counts,
  onPick,
  onLess,
  onBook,
  formatCount,
}: {
  sections: MenuBoardSection<S>[];
  tint: StepTint;
  /** Service id → how much is on the ticket (the counter only). */
  counts?: Readonly<Record<string, number>>;
  onPick?: (service: S) => void;
  onLess?: (service: S) => void;
  onBook?: (service: S) => void;
  /** How a ticket count reads on its card: "× 2", or "9 kg" for a weighed load. */
  formatCount?: (service: S, count: number) => string;
}) {
  const [boardKey, setBoardKey] = useState<string | null>(sections.length === 1 ? sections[0].key : null);
  const [itemName, setItemName] = useState<string | null>(null);
  const isGlass = useIsGlass();
  const board = sections.find((section) => section.key === boardKey) ?? null;
  const isSingleItem = board?.groups.length === 1;
  const item = board ? (isSingleItem ? board.groups[0] : board.groups.find((group) => group.name === itemName)) : null;
  const steps = isSingleItem ? 2 : 3;

  if (!board) {
    return (
      <View style={styles.grid}>
        {sections.map((section) => (
          <BoardCard
            key={section.key}
            board={section}
            tint={tint}
            ticket={onTicket(section.groups, counts)}
            onOpen={() => {
              setBoardKey(section.key);
              setItemName(null);
            }}
          />
        ))}
      </View>
    );
  }

  const leaveBoard = sections.length > 1 ? () => setBoardKey(null) : null;
  const note = sharedNote(board.groups);

  if (item) {
    const back = isSingleItem ? leaveBoard : () => setItemName(null);
    return (
      <View style={styles.wrap}>
        {back ? (
          <StepHead step={steps} of={steps} title={item.name} prompt="Pick a size" onBack={back} />
        ) : (
          <Text style={styles.headTitle}>{item.name}</Text>
        )}
        <SizeStep
          key={item.name}
          group={item}
          board={board.title}
          note={note}
          tint={tint}
          counts={counts}
          onPick={onPick}
          onLess={onLess}
          onBook={onBook}
          formatCount={formatCount}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {leaveBoard ? (
        <StepHead step={2} of={3} title={board.title} prompt="Which one?" onBack={leaveBoard} />
      ) : null}
      <View style={[styles.list, isGlass && styles.listGlass]}>
        {board.groups.map((group, index) => (
          <ItemRow
            key={group.name}
            group={group}
            board={board.title}
            tint={tint}
            ticket={onTicket([group], counts)}
            isFirst={index === 0}
            onOpen={() => setItemName(group.name)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.cosy },
  pressed: { opacity: 0.75 },
  ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  ruledGlass: { borderTopColor: 'rgba(60, 60, 67, 0.12)' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.cosy },
  boardCard: {
    flexBasis: '46%',
    flexGrow: 1,
    maxWidth: 260,
    minHeight: BOARD_CARD_HEIGHT,
    justifyContent: 'space-between',
    ...CROWN,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    ...elevation.rest,
  },
  boardCardGlass: { ...glassPane, borderWidth: 1.5 },
  /** The photo, big and running off the lower right corner, as on the counter's tiles. */
  boardArt: { position: 'absolute', right: '-10%', bottom: '-8%', width: '78%', aspectRatio: 1 },
  boardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.tight,
    paddingHorizontal: space.cosy,
    paddingTop: space.cosy,
  },
  boardTitle: {
    flex: 1,
    maxWidth: '78%',
    ...type.label,
    ...fontFor(800),
    fontSize: 19,
    lineHeight: 23,
    letterSpacing: -0.2,
    color: colors.text,
  },
  /** The foot sits over the photo's left edge, so it keeps to the left half. */
  boardFoot: { alignItems: 'flex-start', gap: 3, maxWidth: '62%', paddingHorizontal: space.cosy, paddingBottom: space.cosy },
  fromPill: { paddingHorizontal: space.snug, paddingVertical: 3, borderRadius: RADII.pill },
  fromPrice: { ...type.caption, fontSize: 14, lineHeight: 18, ...fontFor(800), fontVariant: ['tabular-nums'] },
  fromWord: { ...fontFor(600), fontSize: 11.5 },
  itemCount: { ...type.caption, fontSize: 11.5, lineHeight: 15, ...fontFor(600), color: colors.subtle },
  stage: { width: '100%', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  stagePhoto: { width: '100%', height: '100%' },
  dot: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { ...type.caption, fontSize: 12, lineHeight: 16, ...fontFor(700), color: colors.onAccent },

  head: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  backGlass: { ...glassChip },
  headWords: { flex: 1, minWidth: 0 },
  stepCount: { ...type.caption, fontSize: 11, lineHeight: 14, letterSpacing: 1, color: colors.subtle },
  headTitle: { ...type.section, color: colors.text },

  list: {
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.cosy,
  },
  listGlass: { ...glassPane, paddingHorizontal: space.cosy },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: space.cosy, paddingVertical: space.snug, minHeight: 68 },
  thumb: { width: 52, height: 52, borderRadius: RADII.control, overflow: 'hidden' },
  thumbPhoto: { width: '100%', height: '100%' },
  itemWords: { flex: 1, minWidth: 0, gap: 2 },
  itemName: { ...type.body, ...fontFor(600), color: colors.text },
  itemDetail: { ...type.caption, color: colors.subtle, fontVariant: ['tabular-nums'] },

  sizeStep: { gap: space.cosy },
  hero: { borderRadius: RADII.card, overflow: 'hidden' },
  noteRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  noteText: { ...type.caption, flex: 1, color: colors.subtle },
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  sizeSlot: { flexGrow: 0, gap: 4 },
  size: {
    minHeight: 92,
    paddingHorizontal: space.cosy,
    paddingVertical: space.cosy,
    borderRadius: RADII.control,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'space-between',
  },
  sizeGlass: { ...glassChip, borderWidth: 1.5 },
  sizeLabel: { ...type.caption, ...fontFor(600), color: colors.subtle },
  sizePrice: { ...type.title, fontSize: 22, color: colors.text, fontVariant: ['tabular-nums'] },
  sizeNote: { ...type.caption, fontSize: 11, lineHeight: 14, color: colors.subtle },
  check: {
    position: 'absolute',
    top: space.snug,
    right: space.snug,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countTag: {
    position: 'absolute',
    top: space.snug,
    right: space.snug,
    paddingHorizontal: 7,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  less: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 32 },
  lessText: { ...type.caption, ...fontFor(600) },

  book: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.snug,
    minHeight: 52,
    paddingHorizontal: space.room,
    borderRadius: RADII.pill,
  },
  bookText: { ...type.label, fontSize: 16, color: colors.onAccent, fontVariant: ['tabular-nums'] },
  bookName: { flexShrink: 1 },
  bookIdle: { color: colors.subtle },
});
