import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BestsellerRail } from "@/components/bestseller-rail";
import { CloseDaySheet } from "@/components/close-day-sheet";
import { CollectLanes } from "@/components/collect-lanes";
import { DrawerCard } from "@/components/drawer-card";
import { GoalBurst } from "@/components/goal-burst";
import { GoalSheet } from "@/components/goal-sheet";
import { LiveToast } from "@/components/live-toast";
import { NudgeSheet } from "@/components/nudge-sheet";
import { PaymentsSheet } from "@/components/payments-sheet";
import { PeriodSheet } from "@/components/period-sheet";
import { RushHeatmap } from "@/components/rush-heatmap";
import { SalesHero } from "@/components/sales-hero";
import { SalesSkeleton } from "@/components/sales-skeleton";
import { SectionHeading } from "@/components/section-heading";
import {
  EmptyState,
  ErrorState,
  ErrorText,
  RADII,
  Screen,
  colors,
  elevation,
  space,
  type,
} from "@/components/ui-kit";
import { getShopCustomers, getShopOrders } from "@/lib/api";
import { splitCollect } from "@/lib/domain/collect-queue";
import { buildCustomerBook } from "@/lib/domain/customer-insights";
import type { DaySummary } from "@/lib/domain/day-close";
import { friendlyMerchantError } from "@/lib/domain/merchant-error";
import { canOpenMerchantRoute } from "@/lib/domain/merchant-access";
import { rushGrid } from "@/lib/domain/rush-hours";
import { dailyTotals, suggestGoals } from "@/lib/domain/sales-goal";
import { computeSales, type MetricKey } from "@/lib/domain/sales-metrics";
import {
  frameFor,
  isSamePeriod,
  stepPeriod,
  type SalesPeriod,
} from "@/lib/domain/sales-period";
import { useActiveShop } from "@/lib/use-active-shop";
import { useHaptic } from "@/lib/use-app-settings";
import { useNow } from "@/lib/use-now";
import {
  useDayClose,
  useLivePayments,
  useSalesGoal,
} from "@/lib/use-sales-screen";

const TODAY: SalesPeriod = { kind: "day", offset: 0 };
const GOAL_HISTORY_DAYS = 14;

type Sheet = "period" | "payments" | "nudge" | "close" | "goal" | null;

/**
 * Sales: the owner's counter, not a report. Every figure opens something —
 * the big number lists its payments, the owed lanes open the orders or a
 * reminder, the drawer closes the day — and the comparison is always with the
 * same point in the period before, so a normal morning reads as normal.
 */
export default function MerchantSales() {
  const router = useRouter();
  const haptic = useHaptic();
  const { shop, shopRole, isLoading: isShopLoading } = useActiveShop();
  // Ticks, so a counter tablet left open overnight turns over to the new day.
  const now = useNow();
  const [period, setPeriod] = useState<SalesPeriod>(TODAY);
  const [metric, setMetric] = useState<MetricKey>("sales");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notice, setNotice] = useState("");

  // The merchant shell already polls this query (the doorbell) and listens
  // for new orders, so this screen reads the shared cache and adds no traffic.
  const {
    data: orders,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["shop-orders", shop?.id],
    queryFn: () => getShopOrders(shop!.id),
    enabled: Boolean(shop),
  });
  const { data: registered } = useQuery({
    queryKey: ["shop-customers", shop?.id],
    queryFn: () => getShopCustomers(shop!.id),
    enabled: Boolean(shop),
  });

  const all = useMemo(() => orders ?? [], [orders]);
  const todayFrame = useMemo(() => frameFor(TODAY, now), [now]);
  const frame = useMemo(() => frameFor(period, now), [period, now]);
  const today = useMemo(() => computeSales(all, todayFrame), [all, todayFrame]);
  const sales = useMemo(
    () => (isSamePeriod(period, TODAY) ? today : computeSales(all, frame)),
    [all, frame, period, today],
  );
  const split = useMemo(() => splitCollect(all, now), [all, now]);
  const rush = useMemo(() => rushGrid(all, now), [all, now]);
  const book = useMemo(
    () => buildCustomerBook(all, registered ?? [], now),
    [all, registered, now],
  );
  const goalIdeas = useMemo(
    () => suggestGoals(dailyTotals(all, now, GOAL_HISTORY_DAYS)),
    [all, now],
  );

  const goal = useSalesGoal(shop?.id, today.metrics.sales.total, now);
  const live = useLivePayments(shop?.id, today.payments);
  const dayClose = useDayClose(shop?.id, now);

  if (isShopLoading || (isLoading && !orders)) return <SalesSkeleton />;
  // Owner-only. A staff login has no tab for this screen, but a stale link or
  // a typed web address can still land here; send them back to the counter.
  if (!canOpenMerchantRoute(shopRole, "analytics")) {
    return <Redirect href="/(merchant)/orders" />;
  }
  if (!shop) {
    return (
      <EmptyState message="Your account is not connected to a shop yet. Ask your administrator to add you." />
    );
  }

  const isToday = isSamePeriod(period, TODAY);
  const owedTotal =
    split.ready.amount + split.overdue.amount + split.washing.amount;
  const daySummary: DaySummary = {
    caption: todayFrame.caption,
    sales: today.metrics.sales.total,
    payments: today.payments.length,
    ordersTaken: today.metrics.orders.total,
    methods: today.methods,
    toCollect: owedTotal,
  };
  const later = stepPeriod(period, 1);
  const choosePeriod = (next: SalesPeriod) => {
    haptic("select");
    setPeriod(next);
    setSheet(null);
  };
  const openOrder = (orderId: string) => {
    setSheet(null);
    router.push(`/(merchant)/order/${orderId}`);
  };

  return (
    <View style={styles.shell}>
      <Screen>
        {error ? (
          <ErrorState
            message={friendlyMerchantError("load-earnings", error.message)}
            onRetry={() => refetch()}
          />
        ) : null}
        <ErrorText>{notice}</ErrorText>

        <SalesHero
          frame={frame}
          sales={sales}
          metric={metric}
          onMetric={(next) => {
            haptic("select");
            setMetric(next);
          }}
          onOpenPeriods={() => setSheet("period")}
          onStepBack={() => choosePeriod(stepPeriod(period, -1) ?? period)}
          onStepForward={later ? () => choosePeriod(later) : null}
          goal={goal.goal}
          onEditGoal={() => setSheet("goal")}
          onOpenPayments={() => setSheet("payments")}
        />

        <SectionHeading title="To collect" caption="Unpaid orders, any date" />
        <CollectLanes
          split={split}
          onOpenReady={() =>
            router.push("/(merchant)/orders?view=collect" as never)
          }
          onNudge={() => setSheet("nudge")}
        />

        <SectionHeading
          title="Drawer & wallets"
          caption={`Money in · ${frame.caption}`}
        />
        <DrawerCard
          methods={sales.methods}
          canClose={isToday}
          savedClose={isToday ? dayClose.saved : null}
          onCloseDay={() => setSheet("close")}
        />

        <SectionHeading
          title="Bestsellers"
          caption={`Orders taken · ${frame.caption}`}
        />
        <BestsellerRail items={sales.bestsellers} />

        <SectionHeading
          title="Rush hours"
          caption="Orders taken, last 8 weeks"
        />
        <RushHeatmap grid={rush} />

        <Pressable
          onPress={() => router.push("/(merchant)/customers")}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.customers,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="people-outline" size={20} color={colors.actionInk} />
          <View style={styles.customersWords}>
            <Text style={styles.customersTitle}>Customer book</Text>
            <Text style={styles.customersHint}>
              {book.summary.repeatRate}% come back · {book.summary.newThisMonth}{" "}
              new this month
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        </Pressable>
      </Screen>

      <LiveToast payment={live.toast} onDone={live.clearToast} />
      <GoalBurst goal={goal.burst} onDone={goal.clearBurst} />

      <PeriodSheet
        visible={sheet === "period"}
        value={period}
        onChoose={choosePeriod}
        onClose={() => setSheet(null)}
      />
      <PaymentsSheet
        visible={sheet === "payments"}
        title={frame.title}
        payments={sales.payments}
        total={sales.metrics.sales.total}
        unit={frame.unit}
        onOpenOrder={openOrder}
        onClose={() => setSheet(null)}
      />
      <NudgeSheet
        visible={sheet === "nudge"}
        orders={[...split.overdue.orders, ...split.ready.orders]}
        shop={shop}
        now={now}
        onError={setNotice}
        onClose={() => setSheet(null)}
      />
      {/* Mounted per opening, so each count starts blank. */}
      {sheet === "close" ? (
        <CloseDaySheet
          visible
          summary={daySummary}
          shopName={shop.name}
          onSaved={(close) => {
            dayClose.save(close);
            haptic(close.tone === "short" ? "warning" : "success");
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "goal" ? (
        <GoalSheet
          visible
          goal={goal.goal}
          suggestions={goalIdeas}
          onSave={(next) => {
            goal.setGoal(next);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
  customers: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.cosy,
    padding: space.room,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    ...elevation.rest,
  },
  customersWords: { flex: 1, gap: 2 },
  customersTitle: { ...type.label, color: colors.text },
  customersHint: { ...type.caption, color: colors.subtle },
});
