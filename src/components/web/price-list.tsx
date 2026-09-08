/**
 * The price list, all of it open.
 *
 * The app folds categories into an accordion because a phone screen has a
 * booking form under the list. The web page has nothing under it but the
 * shop's details, and a customer who arrived from a search wants to see
 * every price without tapping, so each category is a headed section.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/components/ui-kit';
import { formatMoneyCompact } from '@/lib/domain/money';
import { categorySummaryLabel } from '@/lib/domain/price-accordion';
import { minimumLabel, unitCaption } from '@/lib/domain/price-label';
import { CATEGORY_LABELS, groupServicesByCategory } from '@/lib/domain/service-catalog';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import type { StorefrontService } from '@/lib/types';

interface PriceListProps {
  services: readonly StorefrontService[];
  theme: StorefrontTheme;
}

export function PriceList({ services, theme }: PriceListProps) {
  const groups = groupServicesByCategory(services);

  if (groups.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No prices posted yet</Text>
        <Text style={styles.emptyBody}>Call the shop and they will quote you.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {groups.map((group) => (
        <View key={group.category} style={styles.section}>
          <View style={styles.heading}>
            <Text style={[styles.headingLabel, { color: theme.brandInk }]}>
              {CATEGORY_LABELS[group.category]}
            </Text>
            <Text style={styles.headingSummary}>{categorySummaryLabel(group.services)}</Text>
          </View>
          {group.services.map((service) => (
            <ServiceRow key={service.id} service={service} />
          ))}
        </View>
      ))}
    </View>
  );
}

function ServiceRow({ service }: { service: StorefrontService }) {
  const unit = unitCaption(service.unit);
  const minimum = minimumLabel(service);
  return (
    <View style={styles.row}>
      <View style={styles.words}>
        <Text style={styles.name}>{service.name}</Text>
        {service.description ? (
          <Text style={styles.description}>{service.description}</Text>
        ) : null}
      </View>
      <View style={styles.figure}>
        <Text style={styles.price}>
          {formatMoneyCompact(service.price)}
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </Text>
        {minimum ? <Text style={styles.minimum}>{minimum}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.section },
  section: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  heading: {
    paddingHorizontal: space.room,
    paddingTop: space.room,
    paddingBottom: space.snug,
    gap: 2,
  },
  headingLabel: { ...type.caption, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  headingSummary: { ...type.caption, color: colors.subtle },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.cosy,
    paddingHorizontal: space.room,
    paddingVertical: space.cosy,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  words: { flex: 1, gap: 2 },
  name: { ...type.body, fontWeight: '600', color: colors.text },
  description: { ...type.caption, color: colors.subtle },
  figure: { alignItems: 'flex-end', gap: 2 },
  price: { ...type.value, color: colors.text, fontVariant: ['tabular-nums'] },
  unit: { ...type.caption, fontWeight: '400', color: colors.subtle },
  minimum: { ...type.caption, color: colors.subtle },
  empty: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.section,
    gap: space.tight,
  },
  emptyTitle: { ...type.section, color: colors.text },
  emptyBody: { ...type.body, color: colors.subtle },
});
