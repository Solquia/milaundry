/**
 * The shelf: a shop's services, searchable, as a grid of porthole cards.
 *
 * The price list was a static grid under a heading. On a shop with a dozen
 * services that is a wall a customer scrolls past rather than reads, and there
 * was no way to answer "do they do curtains" except with a thumb. So the shelf
 * carries its own search, and typing does not just hide rows — every card that
 * survives the query lands again, in order, so the grid visibly re-forms
 * around what was asked. That re-flow is the shelf's one authored moment; the
 * cards themselves only lean when touched.
 *
 * The same component serves the app's shopfront and the shop's own web page,
 * so the two cannot drift apart. What a card *says* is decided in
 * `domain/service-shelf.ts` and `domain/service-showcase.ts`.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { SearchField } from './search-field';
import { SectionHeading } from './section-heading';
import { ServiceTileCard, type ShowcaseCardService } from './service-tile-card';
import { RADII, colors, fontFor, space, type } from './ui-kit';
import { staggerDelay } from '@/lib/domain/entrance';
import { filterShelf, shelfEmptyNote, type ShelfEntry } from '@/lib/domain/service-shelf';
import { gridRows } from '@/lib/domain/web-layout';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/** Below this many services a search box is a control with nothing to do. */
const SEARCH_FLOOR = 4;

/** The app's own stepper colours; the web page passes the shop's brand instead. */
const APP_BOOK_TONE = { bg: colors.action, ink: colors.onAccent };

/**
 * One card landing.
 *
 * Re-runs whenever `generation` changes — which is every time the query does —
 * so a card that survives a search arrives rather than simply being there.
 * Under Reduce Motion it is there, settled, and the re-flow is instant.
 */
function ShelfCard({
  generation,
  index,
  delay,
  children,
}: {
  /** What the grid is currently answering; a change re-runs the landing. */
  generation: string;
  index: number;
  delay: number;
  children: React.ReactNode;
}) {
  const isReduced = useReducedMotion();
  const [land] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    if (isReduced) {
      land.setValue(1);
      return;
    }
    land.setValue(0);
    const run = Animated.spring(land, {
      toValue: 1,
      damping: 18,
      stiffness: 170,
      mass: 0.85,
      useNativeDriver: true,
    });
    const timer = setTimeout(() => run.start(), delay + staggerDelay(index));
    return () => {
      clearTimeout(timer);
      run.stop();
    };
  }, [generation, index, delay, isReduced, land]);

  return (
    <Animated.View
      style={[
        styles.column,
        {
          opacity: land,
          transform: [
            { translateY: land.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
            { scale: land.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

interface ServiceShelfProps<T extends ShowcaseCardService> {
  /** Labelled and already in the order the categories put them in. */
  entries: readonly ShelfEntry<T>[];
  /** Books this service. Absent when the shop is not taking bookings. */
  onBook?: (service: T) => void;
  /** Shown but not bookable yet — the app before the customer has connected. */
  isDisabled?: boolean;
  /** Cards abreast. Two on a phone; the web page widens it with the window. */
  columns?: number;
  /** The stepper's colours — the shop's brand on web, action blue in the app. */
  bookTone?: { bg: string; ink: string };
  /** Milliseconds before the first card lands, for a screen with an entrance. */
  delay?: number;
  /** What this shelf is called. */
  title?: string;
  /**
   * A line under the grid — the web's "tap a card to book". Drawn only when
   * there are cards to tap: under an empty search it was telling the customer
   * to press something that was not there.
   */
  footnote?: string;
}

export function ServiceShelf<T extends ShowcaseCardService>({
  entries,
  onBook,
  isDisabled = false,
  columns = 2,
  bookTone = APP_BOOK_TONE,
  delay = 0,
  title = 'Our Services',
  footnote,
}: ServiceShelfProps<T>) {
  const [query, setQuery] = React.useState('');
  const hasSearch = entries.length >= SEARCH_FLOOR;
  const shown = React.useMemo(
    () => (hasSearch ? filterShelf(entries, query) : [...entries]),
    [entries, query, hasSearch]
  );

  /**
   * What the cards are currently answering. The cascade keys off this rather
   * than off the query itself, so a keystroke that changes nothing about the
   * result — a second letter of a word already matched — does not restart the
   * whole grid under the customer's thumb.
   */
  const generation = React.useMemo(
    () => shown.map((entry) => entry.service.id).join('|'),
    [shown]
  );
  /**
   * The count, said only while it is news. "6 services" under a heading that
   * already sits above six cards is a label reading itself out; "2 of 6" while
   * a search is narrowing them is the one number worth having.
   */
  const caption =
    query.trim() && shown.length !== entries.length
      ? `${shown.length} of ${entries.length}`
      : undefined;

  return (
    <View style={styles.shelf}>
      {hasSearch ? (
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search services or items"
          accessibilityLabel="Search this shop's services"
        />
      ) : null}

      <SectionHeading title={title} caption={caption} />

      {shown.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{shelfEmptyNote(query)}</Text>
          {query.trim() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear the search"
              onPress={() => setQuery('')}
              style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={15} color={colors.actionInk} />
              <Text style={styles.clearText}>Clear search</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View
          style={styles.grid}
          accessibilityLabel={
            caption ? `${shown.length} of ${entries.length} services` : undefined
          }
        >
          {gridRows(shown, columns).map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((entry, column) =>
                entry ? (
                  <ShelfCard
                    key={entry.service.id}
                    generation={generation}
                    index={rowIndex * columns + column}
                    delay={delay}
                  >
                    <ServiceTileCard
                      service={entry.service}
                      categoryLabel={entry.label}
                      bookTone={bookTone}
                      isDisabled={isDisabled}
                      onBook={onBook ? () => onBook(entry.service) : undefined}
                    />
                  </ShelfCard>
                ) : (
                  <View key={`blank-${column}`} style={styles.blank} />
                )
              )}
            </View>
          ))}
          {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /** The search, the heading, and the block of cards: three things, not a list. */
  shelf: { gap: space.cosy },
  /** Tight: the cards are one block, not a list of separated panels. */
  grid: { gap: space.snug },
  row: { flexDirection: 'row', gap: space.snug, alignItems: 'stretch' },
  /** A card in a row has to carry the column's width itself. */
  column: { flex: 1, minWidth: 0 },
  blank: { flex: 1 },

  empty: {
    alignItems: 'flex-start',
    gap: space.cosy,
    padding: space.room,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
  },
  footnote: {
    ...type.caption,
    fontSize: 13,
    color: colors.actionInk,
    paddingHorizontal: space.tight,
    marginTop: space.tight,
  },
  emptyText: { ...type.body, color: colors.subtle },
  clear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
    minHeight: 44,
    paddingHorizontal: space.cosy,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearText: { ...type.label, fontFamily: fontFor(700), color: colors.actionInk },
  pressed: { opacity: 0.6 },
});
