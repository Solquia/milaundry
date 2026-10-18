import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BestsellerRail } from "@/components/bestseller-rail";
import { ClearOrdersSheet } from "@/components/clear-orders-sheet";
import { CollectLanes } from "@/components/collect-lanes";
import { DrawerCard } from "@/components/drawer-card";
import { GLASS_GROUND, glassPane } from "@/components/glass";
import { GoalSheet } from "@/components/goal-sheet";
import { NudgeSheet } from "@/components/nudge-sheet";
import { NoShopState } from "@/components/no-shop-state";
import { PaymentsSheet } from "@/components/payments-sheet";
import { PeriodSheet } from "@/components/period-sheet";
import { RushHeatmap } from "@/components/rush-heatmap";
import { SalesHero } from "@/components/sales-hero";
import { SalesSkeleton } from "@/components/sales-skeleton";
import { SectionHeading } from "@/components/section-heading";
import {
  ErrorState,
  ErrorText,
  Screen,
  colors,
  space,
  type,
} from "@/components/ui-kit";
import { getShopCustomers, getShopOrders } from "@/lib/api";
import { splitCollect } from "@/lib/domain/collect-queue";
import { buildCustomerBook } from "@/lib/domain/customer-insights";
import { friendlyMerchantError } from "@/lib/domain/merchant-error";
import { canOpenMerchantRoute } from "@/lib/domain/merchant-access";
import { rushGrid } from "@/lib/domain/rush-hours";
import { dailyTotals, suggestGoals } from "@/lib/domain/sales-goal";
import { computeSales, type MetricKey } from "@/lib/domain/sales-metrics";
import {
  frameFor,
  periodFromParams,
  stepPeriod,
  type SalesPeriod,
} from "@/lib/domain/sales-period";
import { useActiveShop } from "@/lib/use-active-shop";
import { useHaptic } from "@/lib/use-app-settings";
import { useNow } from "@/lib/use-now";
import { useDayClose, useSalesGoal } from "@/lib/use-sales-screen";

const TODAY: SalesPeriod = { kind: "day", offset: 0 };
const GOAL_HISTORY_DAYS = 14;

type Sheet = "period" | "payments" | "nudge" | "goal" | "clear" | null;

/**
 * Full analytics: everything the simple Sales screen leaves out. The chart
 * with its metric switch, any period back through history, the owed lanes,
 * the drawer split by wallet, bestsellers, rush hours and the customer book.
 * Opens on the period the Sales screen was showing.
 */
export default function MerchantSalesAnalytics() {
  const router = useRouter();
  const haptic = useHaptic();
  const params = useLocalSearchParams<{ kind?: string; offset?: string }>();
  const { shop, shopRole, isLoading: isShopLoading } = useActiveShop();
  const now = useNow();
  const [period, setPeriod] = useState<SalesPeriod>(() =>
    periodFromParams(params.kind, params.offset, TODAY),
  );
  const [metric, setMetric] = useState<MetricKey>("sales");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notice, setNotice] = useState("");

  // Shared with the Sales tab and the merchant shell's doorbell: no extra traffic.
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
  const sales = useMemo(() => computeSales(all, frame), [all, frame]);
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
  const dayClose = useDayClose(shop?.id, now);

  if (isShopLoading || (isLoading && !orders)) return <SalesSkeleton />;
  if (!canOpenMerchantRoute(shopRole, "sales-analytics")) {
    return <Redirect href="/(merchant)/orders" />;
  }
  if (!shop) {
    return (
      <NoShopState />
    );
  }

  const isToday = frame.isLive && period.kind === "day";
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
        <Pressable
          onPress={() => router.navigate("/(merchant)/analytics")}
          accessibilityRole="link"
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.actionInk} />
          <Text style={styles.backText}>Sales</Text>
        </Pressable>

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
          title="How they paid"
          caption={`Money in by wallet · ${frame.caption}`}
        />
        {/* Closing the day lives on the Sales screen; here it is only reported. */}
        <DrawerCard
          methods={sales.methods}
          canClose={false}
          savedClose={isToday ? dayClose.saved : null}
          onCloseDay={() => router.navigate("/(merchant)/analytics")}
        />

        <SectionHeading
          title="Bestsellers"
          caption={`Orders taken · ${frame.caption}`}
        />
        <BestsellerRail items={sales.bestsellers} />

        <SectionHeading
          title="Busiest hours"
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

        {/* Owners try the app on themselves before going live; those orders
            would skew every figure above, so they can be picked out here. */}
        <Pressable
          onPress={() => setSheet("clear")}
          accessibilityRole="button"
          accessibilityHint={`Lists the orders taken in ${frame.title.toLowerCase()} so you can delete test runs`}
          style={({ pressed }) => [
            styles.customers,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.dangerInk} />
          <View style={styles.customersWords}>
            <Text style={styles.customersTitle}>Clear test orders</Text>
            <Text style={styles.customersHint}>
              Delete orders that were only a test · {frame.caption}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        </Pressable>
      </Screen>

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
      <ClearOrdersSheet
        visible={sheet === "clear"}
        orders={all}
        frame={frame}
        now={now}
        onClose={() => setSheet(null)}
      />
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
  shell: { flex: 1, backgroundColor: GLASS_GROUND },
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
  backText: { ...type.label, color: colors.actionInk },
  customers: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.cosy,
    padding: space.room,
    ...glassPane,
  },
  customersWords: { flex: 1, gap: 2 },
  customersTitle: { ...type.label, color: colors.text },
  customersHint: { ...type.caption, color: colors.subtle },
});
