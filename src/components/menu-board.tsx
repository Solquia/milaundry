/**
 * A long price list drawn as a menu board: a row of tabs for the boards, one
 * board at a time, each item one row with its sizes as small price pills.
 *
 * Forty gowns, jackets and toys as forty cards is a wall nobody reads, and as
 * a column of wide price boxes it is a form. A board says what a laundry's
 * own binder says — a heading, the items under it, "S ₱400 · M ₱500 · L
 * ₱600" — and the note every item shares is printed once at the top.
 *
 * The shop page books a pill; the counter puts it on the ticket, so a pill
 * already on it carries its count and a minus beside it.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatMoneyCompact } from '@/lib/domain/money';
import {
  isFromPrice,
  sharedNote,
  type GuideService,
  type MenuBoardSection,
  type MenuGroup,
} from '@/lib/domain/price-guide';

import { CROWN, RADII, colors, fontFor, space, type } from './ui-kit';

export interface BoardTint {
  /** Filled: the active tab and a pill on the ticket. */
  fill: string;
  /** Text on a pale surface. */
  ink: string;
  surface: string;
}

/** An icon for an item by what it is, so a board of names has a shape to scan. */
function itemIcon(name: string): keyof typeof Ionicons.glyphMap {
  if (/package/i.test(name)) return 'water-outline';
  if (/shoe|sneaker/i.test(name)) return 'footsteps-outline';
  if (/cap|hat/i.test(name)) return 'baseball-outline';
  if (/helmet/i.test(name)) return 'bicycle-outline';
  if (/sofa|carpet/i.test(name)) return 'home-outline';
  if (/toy|stuffed/i.test(name)) return 'happy-outline';
  if (/toga/i.test(name)) return 'school-outline';
  if (/dry|spin/i.test(name)) return 'sunny-outline';
  if (/bag/i.test(name)) return 'bag-handle-outline';
  return 'shirt-outline';
}

function PricePill<S extends GuideService>({
  label,
  service,
  count,
  tint,
  onPick,
  onLess,
  formatCount,
}: {
  label: string;
  service: S;
  count: number;
  tint: BoardTint;
  onPick?: (service: S) => void;
  onLess?: (service: S) => void;
  formatCount?: (service: S, count: number) => string;
}) {
  const price = `${formatMoneyCompact(service.price)}${isFromPrice(service.description) ? '+' : ''}`;
  const isOn = count > 0;
  return (
    <View style={styles.pillWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${service.name}, ${price}${isOn ? `, ${count} on the ticket` : ''}`}
        disabled={!onPick}
        onPress={onPick ? () => onPick(service) : undefined}
        style={({ pressed }) => [
          styles.pill,
          { borderColor: isOn ? tint.fill : colors.border },
          isOn && { backgroundColor: tint.fill },
          pressed && styles.pressed,
        ]}
      >
        {label ? (
          <Text style={[styles.pillLabel, { color: isOn ? colors.onAccent : tint.ink }]} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
        <Text style={[styles.pillPrice, isOn && { color: colors.onAccent }]} numberOfLines={1}>
          {price}
        </Text>
        {isOn ? (
          <View style={styles.countBadge}>
            <Text style={[styles.countText, { color: tint.fill }]}>
              {formatCount ? formatCount(service, count) : count}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {isOn && onLess ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`One less ${service.name}`}
          onPress={() => onLess(service)}
          hitSlop={6}
          style={({ pressed }) => [styles.less, pressed && styles.pressed]}
        >
          <Ionicons name="remove" size={16} color={tint.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ItemRow<S extends GuideService>({
  group,
  note,
  isFirst,
  tint,
  counts,
  onPick,
  onLess,
  formatCount,
}: {
  group: MenuGroup<S>;
  /** The board's shared note; an item repeats nothing it already says. */
  note: string;
  isFirst: boolean;
  tint: BoardTint;
  counts?: Readonly<Record<string, number>>;
  onPick?: (service: S) => void;
  onLess?: (service: S) => void;
  formatCount?: (service: S, count: number) => string;
}) {
  const own = new Set(group.options.map((option) => option.service.description?.trim() ?? ''));
  // An item says only what the board's note does not.
  const itemNote = own.size === 1 && [...own][0] !== note ? [...own][0] : '';
  // One price with nothing to choose sits at the end of its own line.
  const isSingle = group.options.length === 1 && !group.options[0].label;
  const pills = group.options.map((option) => (
    <PricePill
      key={option.service.id}
      label={option.label}
      service={option.service}
      count={counts?.[option.service.id] ?? 0}
      tint={tint}
      onPick={onPick}
      onLess={onLess}
      formatCount={formatCount}
    />
  ));
  return (
    <View style={[styles.item, isSingle && styles.itemSingle, !isFirst && styles.ruled]}>
      <View style={[styles.badge, { backgroundColor: tint.surface }]}>
        <Ionicons name={itemIcon(group.name)} size={18} color={tint.ink} />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemName}>{group.name}</Text>
        {itemNote ? (
          <Text style={styles.itemNote} numberOfLines={2}>
            {itemNote}
          </Text>
        ) : null}
        {isSingle ? null : <View style={styles.pills}>{pills}</View>}
      </View>
      {isSingle ? pills : null}
    </View>
  );
}

export function MenuBoard<S extends GuideService>({
  sections,
  tint,
  counts,
  onPick,
  onLess,
  formatCount,
  isFlat = false,
}: {
  sections: MenuBoardSection<S>[];
  tint: BoardTint;
  /** Service id → how many are on the ticket (the counter only). */
  counts?: Readonly<Record<string, number>>;
  onPick?: (service: S) => void;
  onLess?: (service: S) => void;
  /** How a ticket count reads on its pill: "2", or "9 kg" for a weighed load. */
  formatCount?: (service: S, count: number) => string;
  /** Drawn straight on the page rather than on a card of its own. */
  isFlat?: boolean;
}) {
  const [picked, setPicked] = useState(sections[0]?.key ?? '');
  const board = sections.find((section) => section.key === picked) ?? sections[0];
  if (!board) return null;
  const note = sharedNote(board.groups);
  return (
    <View style={styles.wrap}>
      {sections.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
          accessibilityRole="tablist"
        >
          {sections.map((section) => {
            const isOn = section.key === board.key;
            const items = section.groups.length;
            return (
              <Pressable
                key={section.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: isOn }}
                onPress={() => setPicked(section.key)}
                style={({ pressed }) => [
                  styles.tab,
                  isOn ? { backgroundColor: tint.fill, borderColor: tint.fill } : null,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.tabText, isOn && styles.tabTextOn]}>{section.title}</Text>
                <Text style={[styles.tabCount, isOn && styles.tabTextOn]}>{items}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <View style={[styles.board, isFlat && styles.boardFlat]}>
        {note ? (
          <View style={[styles.noteBar, { backgroundColor: tint.surface }]}>
            <Ionicons name="information-circle-outline" size={16} color={tint.ink} />
            <Text style={[styles.noteText, { color: tint.ink }]}>{note}</Text>
          </View>
        ) : null}
        {board.groups.map((group, index) => (
          <ItemRow
            key={group.name}
            group={group}
            note={note}
            isFirst={index === 0}
            tint={tint}
            counts={counts}
            onPick={onPick}
            onLess={onLess}
            formatCount={formatCount}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.cosy },
  pressed: { opacity: 0.7 },
  ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },

  tabs: { gap: space.snug, paddingRight: space.room },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tabText: { ...type.label, color: colors.text },
  tabCount: { ...type.caption, fontSize: 12, fontFamily: fontFor(700), color: colors.subtle },
  tabTextOn: { color: colors.onAccent },

  board: {
    ...CROWN,
    paddingHorizontal: space.room,
    paddingVertical: space.snug,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boardFlat: { borderWidth: 0, paddingHorizontal: 0 },
  noteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.snug,
    marginBottom: space.tight,
    paddingHorizontal: space.cosy,
    paddingVertical: space.snug,
    borderRadius: RADII.chip,
  },
  noteText: { ...type.caption, flex: 1 },

  item: { flexDirection: 'row', gap: space.cosy, paddingVertical: space.cosy },
  itemSingle: { alignItems: 'center' },
  badge: { width: 36, height: 36, borderRadius: RADII.chip, alignItems: 'center', justifyContent: 'center' },
  itemBody: { flex: 1, minWidth: 0, gap: 6 },
  itemName: { ...type.body, fontFamily: fontFor(700), color: colors.text },
  itemNote: { ...type.caption, color: colors.subtle, marginTop: -4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },

  pillWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: RADII.pill,
    borderWidth: 1.5,
    backgroundColor: colors.sunken,
  },
  pillLabel: { ...type.caption, fontSize: 12, fontFamily: fontFor(700) },
  pillPrice: { ...type.label, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  countBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.onAccent,
  },
  countText: { ...type.caption, fontSize: 12, fontFamily: fontFor(700) },
  less: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
});
