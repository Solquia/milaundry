/**
 * The price list, all of it open, on one sheet.
 *
 * The app folds categories into an accordion because a phone screen has a
 * booking form under the list. The web page has nothing under it but the
 * shop's details, and a customer who arrived from a search wants every price
 * without tapping. So: one white sheet, each category a plain heading, each
 * service one row with the figure on the right. Nothing is said twice — the
 * heading no longer announces a "from" price that the first row states a
 * line later.
 *
 * A row is the fastest way to book: tapping it opens the booking page with
 * that service already in the basket. When the shop cannot take bookings the
 * rows are just rows.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/components/ui-kit';
import { formatMoneyCompact } from '@/lib/domain/money';
import { minimumLabel, unitCaption } from '@/lib/domain/price-label';
import { CATEGORY_LABELS, groupServicesByCategory } from '@/lib/domain/service-catalog';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import type { StorefrontService } from '@/lib/types';

interface PriceListProps {
  services: readonly StorefrontService[];
  theme: StorefrontTheme;
  /** Books this service; absent when the shop is not taking bookings. */
  onBook?: (serviceId: string) => void;
}

export function PriceList({ services, theme, onBook }: PriceListProps) {
  const groups = groupServicesByCategory(services);

  if (groups.length === 0) {
    return (
      <View style={styles.sheet}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No prices posted yet</Text>
          <Text style={styles.emptyBody}>Call the shop and they will quote you.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sheet}>
      {groups.map((group, index) => (
        <View key={group.category}>
          <Text style={[styles.heading, index > 0 && styles.headingAfterGroup]}>
            {CATEGORY_LABELS[group.category]}
          </Text>
          {group.services.map((service) => (
            <ServiceRow key={service.id} service={service} theme={theme} onBook={onBook} />
          ))}
        </View>
      ))}
      {onBook ? <Text style={styles.footnote}>Tap a service to book it.</Text> : null}
    </View>
  );
}

interface ServiceRowProps {
  service: StorefrontService;
  theme: StorefrontTheme;
  onBook?: (serviceId: string) => void;
}

function ServiceRow({ service, theme, onBook }: ServiceRowProps) {
  const unit = unitCaption(service.unit);
  const minimum = minimumLabel(service);
  const [isHovered, setIsHovered] = React.useState(false);
  const isBookable = Boolean(onBook);

  return (
    <Pressable
      accessibilityRole={isBookable ? 'button' : undefined}
      accessibilityLabel={isBookable ? `Book ${service.name}` : undefined}
      disabled={!isBookable}
      onPress={() => onBook?.(service.id)}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      style={({ pressed }) => [
        styles.row,
        isBookable && (pressed || isHovered) && { backgroundColor: theme.brandSoft },
      ]}
    >
      <View style={styles.words}>
        <Text style={styles.name}>{service.name}</Text>
        {service.description ? <Text style={styles.description}>{service.description}</Text> : null}
        {minimum ? <Text style={styles.minimum}>{minimum}</Text> : null}
      </View>
      <View style={styles.figure}>
        <Text style={[styles.price, { color: theme.brandInk }]}>
          {formatMoneyCompact(service.price)}
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </Text>
      </View>
      {isBookable ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={isHovered ? theme.brandInk : colors.border}
          style={styles.chevron}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.snug,
    overflow: 'hidden',
  },
  heading: {
    ...type.section,
    color: colors.text,
    paddingHorizontal: space.room,
    paddingTop: space.cosy,
    paddingBottom: space.tight,
  },
  headingAfterGroup: { paddingTop: space.section, borderTopWidth: 1, borderTopColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingHorizontal: space.room,
    paddingVertical: space.cosy,
    minHeight: 56,
    ...Platform.select({ web: { cursor: 'pointer', transitionDuration: '120ms' } as object, default: {} }),
  },
  words: { flex: 1, gap: 2 },
  name: { ...type.body, fontWeight: '600', color: colors.text },
  description: { ...type.caption, color: colors.subtle },
  minimum: { ...type.caption, color: colors.subtle },
  figure: { alignItems: 'flex-end', minWidth: 72 },
  price: { ...type.value, fontVariant: ['tabular-nums'] },
  unit: { ...type.caption, fontWeight: '400', color: colors.subtle },
  chevron: { marginLeft: -space.tight },
  footnote: {
    ...type.caption,
    color: colors.subtle,
    paddingHorizontal: space.room,
    paddingTop: space.cosy,
    paddingBottom: space.tight,
  },
  empty: { padding: space.section, gap: space.tight },
  emptyTitle: { ...type.section, color: colors.text },
  emptyBody: { ...type.body, color: colors.subtle },
});
