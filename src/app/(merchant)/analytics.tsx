import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChipRow } from '@/components/chip-row';
import { CustomerRow } from '@/components/customer-row';
import { SectionHeading } from '@/components/section-heading';
import { ShareRows } from '@/components/share-rows';
import { StatGrid, StatTile } from '@/components/stat-tile';
import { TrendBars } from '@/components/trend-bars';
import {
  Card,
  EmptyState,
  ErrorState,
  Loading,
  Screen,
  TAG_TONES,
  colors,
  elevation,
  formatMoney,
  space,
  type,
  CROWN,
  RADII,
  fontFor,
} from '@/components/ui-kit';
import { getShopCustomers, getShopOrders } from '@/lib/api';
import { RANGES, RANGE_LABELS, rangeCaption, type RangeKey } from '@/lib/domain/analytics-range';
import { buildCustomerBook, sortCustomers } from '@/lib/domain/customer-insights';
import { computeDailyMoney } from '@/lib/domain/daily-analytics';
import { computeEarnings, describeChange, type ChangeTone } from '@/lib/domain/earnings-summary';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { canOpenMerchantRoute } from '@/lib/domain/merchant-access';
import { useActiveShop } from '@/lib/use-active-shop';

const RANGE_OPTIONS = RANGES.map((key) => ({ key, label: RANGE_LABELS[key] }));
const TOP_CUSTOMERS = 3;

/** "1 payment" / "3 payments" — a bare digit under a peso figure reads as money. */
function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

const CHANGE_TONES: Record<ChangeTone, { bg: string; ink: string; icon: string }> = {
  up: { ...TAG_TONES.settled, icon: 'trending-up-outline' },
  down: { ...TAG_TONES.owed, icon: 'trending-down-outline' },
  flat: { ...TAG_TONES.neutral, icon: 'remove-outline' },
};

/**
 * The comparison with the previous window. A pill rather than a bare
 * percentage so a fall reads as a fact about the period, not an alarm: amber
 * is the app's "owed" colour, and last week being better is not an emergency.
 */
function ChangePill({ text, tone }: { text: string; tone: ChangeTone }) {
  const look = CHANGE_TONES[tone];
  return (
    <View style={[styles.changePill, { backgroundColor: look.bg }]}>
      <Ionicons name={look.icon as never} size={14} color={look.ink} />
      <Text style={[styles.changeText, { color: look.ink }]}>{text}</Text>
    </View>
  );
}

export default function MerchantEarnings() {
  const router = useRouter();
  const { shop, shopRole, isLoading: isShopLoading } = useActiveShop();
  // One clock for the whole screen, so the caption and the figures can never
  // disagree about which day it is.
  const now = useMemo(() => new Date(), []);
  const [range, setRange] = useState<RangeKey>('today');

  const {
    data: orders,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['shop-orders', shop?.id],
    queryFn: () => getShopOrders(shop!.id),
    enabled: Boolean(shop),
    refetchInterval: 15_000,
  });
  const { data: registered } = useQuery({
    queryKey: ['shop-customers', shop?.id],
    queryFn: () => getShopCustomers(shop!.id),
    enabled: Boolean(shop),
  });

  const earnings = useMemo(() => computeEarnings(orders ?? [], range, now), [orders, range, now]);
  const daily = useMemo(() => computeDailyMoney(orders ?? [], now), [orders, now]);
  const book = useMemo(
    () => buildCustomerBook(orders ?? [], registered ?? [], now),
    [orders, registered, now]
  );
  const topCustomers = useMemo(
    () =>
      sortCustomers(book.customers, 'value')
        .filter((customer) => customer.orderCount > 0)
        .slice(0, TOP_CUSTOMERS),
    [book]
  );

  if (isShopLoading || isLoading) return <Loading />;
  // Owner-only. A staff login has no tab for this screen, but a stale link or
  // a typed web address can still land here; the RPCs behind it would refuse
  // them, so send them back to the counter instead of showing an error.
  if (!canOpenMerchantRoute(shopRole, 'analytics')) {
    return <Redirect href="/(merchant)/orders" />;
  }
  if (!shop) {
    return (
      <EmptyState message="Your account is not connected to a shop yet. Ask your administrator to add you." />
    );
  }

  const caption = rangeCaption(range, now);
  const change = describeChange(earnings.changePct, range);
  const { summary } = book;
  const trendLabel =
    earnings.trendPeak > 0
      ? `Collections over time. Best ${range === 'today' || range === '7d' ? 'day' : 'period'}: ${formatMoney(earnings.trendPeak)}.`
      : 'Collections over time. Nothing collected yet.';

  return (
    <Screen>
      {error ? (
        <ErrorState
          message={friendlyMerchantError('load-earnings', error.message)}
          onRetry={() => refetch()}
        />
      ) : null}

      <ChipRow options={RANGE_OPTIONS} value={range} onChange={setRange} label="Choose the period" />

      {/* A tinted field rather than a coloured rule or a badge: the whole card
          is the period's takings, so the whole card is the thing that changes. */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Collected · {caption}</Text>
        <Text style={styles.figure} accessibilityRole="header">
          {formatMoney(earnings.collected)}
        </Text>
        <View style={styles.heroLine}>
          <Text style={styles.heroHint}>{countLabel(earnings.paymentsCount, 'payment')}</Text>
          {change ? <ChangePill text={change.text} tone={change.tone} /> : null}
        </View>
        <TrendBars
          points={earnings.trend}
          peak={earnings.trendPeak}
          accessibilityLabel={trendLabel}
        />
      </View>

      <StatGrid>
        <StatTile label="Orders taken" value={String(earnings.ordersTaken)} hint={caption} />
        <StatTile
          label="Average order"
          value={formatMoney(earnings.averageOrder)}
          hint="Per order taken"
        />
        <StatTile
          label="Still to collect"
          value={formatMoney(earnings.receivables)}
          tone="owed"
          hint={`${countLabel(earnings.unpaidCount, 'unpaid order')}, any date`}
        />
        {range === 'today' ? (
          <StatTile
            label="Expected by end of day"
            value={formatMoney(daily.projectedToday)}
            hint="Collected, plus today's orders still to be paid"
          />
        ) : (
          <StatTile
            label="Payments received"
            value={String(earnings.paymentsCount)}
            hint={caption}
          />
        )}
      </StatGrid>

      <SectionHeading title="Where the money came from" caption={caption} />
      <Card>
        <Text style={styles.subheading}>By source</Text>
        <ShareRows items={earnings.sources} emptyText="Nothing collected in this period yet." />
        <View style={styles.divider} />
        <Text style={styles.subheading}>By payment method</Text>
        <ShareRows items={earnings.methods} emptyText="Nothing collected in this period yet." />
      </Card>

      <SectionHeading title="Top services" caption="By revenue from orders taken" />
      <Card>
        <ShareRows
          items={earnings.topServices.map((service) => ({
            key: service.name,
            label: service.name,
            amount: service.revenue,
            share: service.share,
            note: countLabel(service.count, 'order line'),
          }))}
          emptyText="No orders taken in this period yet."
        />
      </Card>

      <SectionHeading
        title="Customers"
        caption="Across everything you have taken"
        actionLabel="See all"
        onAction={() => router.push('/(merchant)/customers')}
      />
      <StatGrid>
        <StatTile
          label="Customers"
          value={String(summary.total)}
          hint={`${summary.ordering} have ordered`}
        />
        <StatTile
          label="Repeat rate"
          value={`${summary.repeatRate}%`}
          hint="Came back at least once"
        />
        <StatTile
          label="Average lifetime value"
          value={formatMoney(summary.averageLifetimeValue)}
          tone="in"
          hint="Per customer who has ordered"
        />
        <StatTile
          label="New this month"
          value={String(summary.newThisMonth)}
          hint="First order in the last 30 days"
        />
      </StatGrid>
      {topCustomers.length > 0 ? (
        <>
          <Text style={styles.subheading}>Top customers by lifetime value</Text>
          {topCustomers.map((customer) => (
            <CustomerRow
              key={customer.key}
              customer={customer}
              now={now}
              onPress={() =>
                router.push(`/(merchant)/customer/${encodeURIComponent(customer.key)}` as never)
              }
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: space.cosy,
    padding: space.section,
    ...CROWN,
    backgroundColor: colors.takingsSurface,
    ...elevation.rest,
  },
  heroLabel: { ...type.label, color: colors.subtle },
  figure: { ...type.hero, color: colors.moneyIn },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: space.snug, flexWrap: 'wrap' },
  heroHint: { ...type.caption, color: colors.subtle },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADII.pill,
    paddingHorizontal: space.cosy,
    paddingVertical: 3,
  },
  changeText: { ...type.caption, fontFamily: fontFor(600) },
  subheading: { ...type.label, color: colors.subtle },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.tight },
});
