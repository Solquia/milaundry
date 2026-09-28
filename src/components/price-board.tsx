/**
 * The owner's price list, drawn as the board on a laundry shop's wall.
 *
 * Each category is its own card with a coloured badge, so the shape of the
 * list shows before a word of it is read. A minimum every row shares moves up
 * into the heading instead of repeating under each row, and every figure
 * carries its unit in words underneath. A long list gets a search box and a
 * row of category chips; a search that finds nothing offers to add the price.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChipRow, type ChipOption } from './chip-row';
import { SearchField } from './search-field';
import { ACCENTS, CROWN, RADII, TAG_TONES, colors, fontFor, space, type } from './ui-kit';
import { formatMoneyCompact } from '@/lib/domain/money';
import {
  boardFilter,
  rowMinimum,
  sharedMinimum,
  unitWord,
  type BoardCategory,
} from '@/lib/domain/price-board';
import {
  CATEGORY_LABELS,
  CATEGORY_SHORT,
  groupServicesByCategory,
  type ServiceCategory,
  type ServiceGroup,
} from '@/lib/domain/service-catalog';
import { categoryIcon } from '@/lib/domain/shop-home';
import type { ServiceRow as ServiceRecord } from '@/lib/types';

/** Fewer prices than this fit on one screen; a search box would only crowd them. */
const SEARCH_THRESHOLD = 6;

/** One colour per category, so a card is recognised by its colour before its label. */
const CATEGORY_ACCENT: Record<ServiceCategory, (typeof ACCENTS)[number]> = {
  wash_fold: ACCENTS[0],
  special_items: ACCENTS[1],
  dry_cleaning: ACCENTS[2],
  ironing: ACCENTS[3],
  other: ACCENTS[4],
  self_service: ACCENTS[5],
};

type Props = {
  services: readonly ServiceRecord[];
  /** The service just saved, lit for a moment so the owner can see where it landed. */
  highlightName: string | null;
  onOpen: (service: ServiceRecord) => void;
  onAdd: () => void;
};

function PriceTag({ service }: { service: ServiceRecord }) {
  if (!(service.price > 0)) {
    return (
      <View style={styles.flag}>
        <Text style={styles.flagText}>Set price</Text>
      </View>
    );
  }
  return (
    <View style={styles.tag}>
      <Text style={styles.figure}>{formatMoneyCompact(service.price)}</Text>
      <Text style={styles.unit}>{unitWord(service)}</Text>
    </View>
  );
}

function PriceRow({
  service,
  shared,
  isFirst,
  isHighlighted,
  onOpen,
}: {
  service: ServiceRecord;
  shared: string | null;
  isFirst: boolean;
  isHighlighted: boolean;
  onOpen: () => void;
}) {
  const minimum = rowMinimum(service, shared);
  const figure =
    service.price > 0 ? `${formatMoneyCompact(service.price)} ${unitWord(service)}` : 'no price set';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${service.name}, ${figure}${minimum ? `, ${minimum}` : ''}`}
      accessibilityHint="Opens it to change any detail"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.row,
        !isFirst && styles.rowRuled,
        isHighlighted && styles.rowHighlighted,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={2}>
          {service.name}
        </Text>
        {minimum ? <Text style={styles.rowMeta}>{minimum}</Text> : null}
      </View>
      <PriceTag service={service} />
      <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
    </Pressable>
  );
}

function PriceCard({
  group,
  highlightName,
  onOpen,
}: {
  group: ServiceGroup<ServiceRecord>;
  highlightName: string | null;
  onOpen: (service: ServiceRecord) => void;
}) {
  const accent = CATEGORY_ACCENT[group.category];
  const shared = sharedMinimum(group.services);
  const count = group.services.length;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.badge, { backgroundColor: accent.surface }]}>
          <Ionicons
            name={categoryIcon(group.category) as keyof typeof Ionicons.glyphMap}
            size={18}
            color={accent.ink}
          />
        </View>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            {CATEGORY_LABELS[group.category]}
          </Text>
          {shared ? <Text style={styles.cardMeta}>{`${shared} on each`}</Text> : null}
        </View>
        {count > 1 ? (
          <Text style={[styles.count, { color: accent.ink }]}>{`${count} prices`}</Text>
        ) : null}
      </View>
      <View style={[styles.rule, { backgroundColor: accent.surface }]} />
      {group.services.map((service, index) => (
        <PriceRow
          key={service.id}
          service={service}
          shared={shared}
          isFirst={index === 0}
          isHighlighted={service.name === highlightName}
          onOpen={() => onOpen(service)}
        />
      ))}
    </View>
  );
}

function NoMatch({
  query,
  onClear,
  onAdd,
}: {
  query: string;
  onClear: () => void;
  onAdd: () => void;
}) {
  return (
    <View style={styles.noMatch} accessibilityLiveRegion="polite">
      <Ionicons name="pricetag-outline" size={28} color={colors.subtle} />
      <Text style={styles.noMatchTitle}>{`Nothing called “${query.trim()}” yet`}</Text>
      <Text style={styles.noMatchBody}>Check the spelling, or add it as a new price.</Text>
      <View style={styles.noMatchActions}>
        <Pressable
          accessibilityRole="button"
          onPress={onClear}
          style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
        >
          <Text style={styles.ghostButtonText}>Clear search</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onAdd}
          style={({ pressed }) => [styles.solidButton, pressed && styles.solidPressed]}
        >
          <Ionicons name="add" size={16} color={colors.onAccent} />
          <Text style={styles.solidButtonText}>Add a price</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function PriceBoard({ services, highlightName, onOpen, onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<BoardCategory>('all');

  const allGroups = groupServicesByCategory(services);
  // A category emptied by a removal falls back to everything rather than
  // leaving the owner on a board with nothing on it.
  const category = allGroups.some((group) => group.category === picked) ? picked : 'all';
  const groups = boardFilter(services, category, query);

  const chips: ChipOption<BoardCategory>[] = [
    { key: 'all', label: 'All', count: services.length },
    ...allGroups.map((group) => ({
      key: group.category,
      label: CATEGORY_SHORT[group.category],
      count: group.services.length,
    })),
  ];

  const hasSearch = services.length >= SEARCH_THRESHOLD;
  const hasChips = allGroups.length > 1;
  const shownCount = groups.reduce((sum, group) => sum + group.services.length, 0);

  return (
    <View style={styles.board}>
      {hasSearch ? (
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Find a price"
          accessibilityLabel="Find a price by name"
        />
      ) : null}
      {hasChips ? (
        <ChipRow
          options={chips}
          value={category}
          onChange={setPicked}
          label="Price categories"
          tone="ghost"
        />
      ) : null}

      {groups.length === 0 ? (
        <NoMatch query={query} onClear={() => setQuery('')} onAdd={onAdd} />
      ) : (
        groups.map((group) => (
          <PriceCard
            key={group.category}
            group={group}
            highlightName={highlightName}
            onOpen={onOpen}
          />
        ))
      )}

      {groups.length > 0 ? (
        <Text style={styles.foot}>
          {shownCount === services.length
            ? 'Tap any price to change it.'
            : `Showing ${shownCount} of ${services.length} prices.`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The tail clears the raised scan button, so the last row never ends under it.
  board: { gap: space.cosy, paddingBottom: space.gulf * 2 },

  card: {
    backgroundColor: colors.card,
    ...CROWN,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingHorizontal: space.room,
    paddingTop: space.room,
    paddingBottom: space.cosy,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: RADII.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleWrap: { flex: 1, minWidth: 0 },
  cardTitle: { ...type.body, fontFamily: fontFor(700), color: colors.text },
  cardMeta: { ...type.caption, color: colors.subtle },
  count: { ...type.caption, fontFamily: fontFor(600) },
  rule: { height: 2, marginHorizontal: space.room, borderRadius: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    marginHorizontal: space.room,
    paddingVertical: space.cosy,
    minHeight: 56,
  },
  rowRuled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowHighlighted: {
    backgroundColor: TAG_TONES.settled.bg,
    marginHorizontal: 0,
    paddingHorizontal: space.room,
  },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { ...type.body, color: colors.text },
  rowMeta: { ...type.caption, color: colors.subtle },

  tag: { alignItems: 'flex-end' },
  figure: {
    ...type.body,
    fontSize: 17,
    fontFamily: fontFor(700),
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  unit: { ...type.caption, fontSize: 12, color: colors.subtle },

  flag: {
    paddingHorizontal: space.snug,
    paddingVertical: 2,
    borderRadius: RADII.hair,
    backgroundColor: TAG_TONES.owed.bg,
  },
  flagText: { ...type.caption, fontFamily: fontFor(600), color: TAG_TONES.owed.ink },

  noMatch: {
    alignItems: 'center',
    gap: space.snug,
    paddingVertical: space.gulf,
    paddingHorizontal: space.room,
    borderRadius: RADII.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  noMatchTitle: { ...type.body, fontFamily: fontFor(700), color: colors.text, textAlign: 'center' },
  noMatchBody: { ...type.caption, color: colors.subtle, textAlign: 'center' },
  noMatchActions: { flexDirection: 'row', gap: space.snug, marginTop: space.snug },
  ghostButton: {
    minHeight: 40,
    paddingHorizontal: space.room,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    justifyContent: 'center',
  },
  ghostButtonText: { ...type.label, color: colors.text },
  solidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: space.room,
    borderRadius: RADII.pill,
    backgroundColor: colors.action,
  },
  solidPressed: { opacity: 0.85 },
  solidButtonText: { ...type.label, color: colors.onAccent },

  foot: { ...type.caption, color: colors.subtle, textAlign: 'center', marginTop: space.tight },
});
