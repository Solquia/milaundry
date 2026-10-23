import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { CloseDaySheet } from "@/components/close-day-sheet";
import { ExpenseSheet } from "@/components/expense-sheet";
import { GLASS_GROUND, glassPane } from "@/components/glass";
import { GoalBar } from "@/components/goal-bar";
import { GoalBurst } from "@/components/goal-burst";
import { GoalSheet } from "@/components/goal-sheet";
import { LiveToast } from "@/components/live-toast";
import { NoShopState } from "@/components/no-shop-state";
import { PaymentsSheet } from "@/components/payments-sheet";
import {
  AnalyticsLink,
  GlanceActions,
  KeptHero,
  MoneyTiles,
  PeriodTabs,
} from "@/components/sales-glance";
import { SalesSkeleton } from "@/components/sales-skeleton";
import { ShopLedgerCard } from "@/components/shop-ledger-card";
import {
  ErrorState,
  Screen,
  space,
} from "@/components/ui-kit";
import { getShopOrders } from "@/lib/api";
import { getPeriodOrderCosts } from "@/lib/cost-api";
import { shopLedger } from "@/lib/domain/shop-ledger";
import { splitCollect } from "@/lib/domain/collect-queue";
import type { DaySummary } from "@/lib/domain/day-close";
import { profitOf, toDateKey } from "@/lib/domain/expense-metrics";
import { friendlyMerchantError } from "@/lib/domain/merchant-error";
import { canOpenMerchantRoute } from "@/lib/domain/merchant-access";
import { dailyTotals, suggestGoals } from "@/lib/domain/sales-goal";
import { computeSales } from "@/lib/domain/sales-metrics";
import {
  frameFor,
  type PeriodKind,
  type SalesPeriod,
} from "@/lib/domain/sales-period";
import { useActiveShop } from "@/lib/use-active-shop";
import { useHaptic } from "@/lib/use-app-settings";
import { useNow } from "@/lib/use-now";
import { useShopExpenses } from "@/lib/use-shop-expenses";
import {
  useDayClose,
  useLivePayments,
  useSalesGoal,
} from "@/lib/use-sales-screen";

const TODAY: SalesPeriod = { kind: "day", offset: 0 };
const GOAL_HISTORY_DAYS = 14;

type Sheet = "payments" | "close" | "goal" | "expense" | null;

/**
 * Sales: "how am I doing?" in five seconds. What the shop kept is the
 * headline; money in, spent and still unpaid are the only other numbers, and
 * each opens the list behind it. Everything else — the chart, wallets,
 * bestsellers, rush hours, older periods — is one tap away on full analytics,
 * so the owner is never asked to read a report to learn whether today is good.
 */
export default function MerchantSales() {
  const router = useRouter();
  const haptic = useHaptic();
  const { shop, shopRole, isLoading: isShopLoading } = useActiveShop();
  // Ticks, so a counter tablet left open overnight turns over to the new day.
  const now = useNow();
  const [kind, setKind] = useState<PeriodKind>("day");
  const [sheet, setSheet] = useState<Sheet>(null);

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

  const period = useMemo<SalesPeriod>(() => ({ kind, offset: 0 }), [kind]);
  const all = useMemo(() => orders ?? [], [orders]);
  const todayFrame = useMemo(() => frameFor(TODAY, now), [now]);
  const frame = useMemo(() => frameFor(period, now), [period, now]);
  const today = useMemo(() => computeSales(all, todayFrame), [all, todayFrame]);
  const sales = useMemo(
    () => (kind === "day" ? today : computeSales(all, frame)),
    [all, frame, kind, today],
  );
  const split = useMemo(() => splitCollect(all, now), [all, now]);
  // The orders the ledger costs: refetch when one is added or changes total.
  const ledgerKey = useMemo(
    () =>
      all
        .filter((order) => {
          const time = new Date(order.created_at).getTime();
          return time >= frame.start && time < frame.end;
        })
        .map((order) => `${order.id}:${order.final_total ?? order.estimated_total}`)
        .join(","),
    [all, frame.start, frame.end],
  );
  const costs = useQuery({
    queryKey: ["period-order-costs", shop?.id, frame.start, frame.end, ledgerKey],
    queryFn: () => getPeriodOrderCosts(shop!.id, frame.start, frame.end),
    enabled: Boolean(shop) && canOpenMerchantRoute(shopRole, "analytics"),
    placeholderData: (previous) => previous,
  });
  const ledger = useMemo(
    () => shopLedger(all, costs.data, frame),
    [all, costs.data, frame],
  );
  const goalIdeas = useMemo(
    () => suggestGoals(dailyTotals(all, now, GOAL_HISTORY_DAYS)),
    [all, now],
  );

  const goal = useSalesGoal(shop?.id, today.metrics.sales.total, now);
  const live = useLivePayments(shop?.id, today.payments);
  const dayClose = useDayClose(shop?.id, now);
  const expenses = useShopExpenses(shop?.id, frame);

  if (isShopLoading || (isLoading && !orders)) return <SalesSkeleton />;
  // Owner-only. A staff login has no tab for this screen, but a stale link or
  // a typed web address can still land here; send them back to the counter.
  if (!canOpenMerchantRoute(shopRole, "analytics")) {
    return <Redirect href="/(merchant)/orders" />;
  }
  if (!shop) {
    return (
      <NoShopState />
    );
  }

  const isToday = kind === "day";
  const owedTotal =
    split.ready.amount + split.overdue.amount + split.washing.amount;
  // The tile matches the Orders screen's "To collect": laundry that is ready
  // or handed over. Loads still in the machines are paid at pickup, not chased.
  const chaseable = [split.ready, split.overdue];
  const unpaidTotal = chaseable.reduce((sum, lane) => sum + lane.amount, 0);
  const unpaidCount = chaseable.reduce((sum, lane) => sum + lane.count, 0);
  const daySummary: DaySummary = {
    caption: todayFrame.caption,
    sales: today.metrics.sales.total,
    payments: today.payments.length,
    ordersTaken: today.metrics.orders.total,
    methods: today.methods,
    toCollect: owedTotal,
  };
  const moneyIn = sales.metrics.sales.total;
  const spent = expenses.summary.total;
  const { profit } = profitOf(moneyIn, spent);
  const periodQuery = `kind=${period.kind}&offset=${period.offset}`;

  return (
    <View style={styles.shell}>
      <Screen>
        {error ? (
          <ErrorState
            message={friendlyMerchantError("load-earnings", error.message)}
            onRetry={() => refetch()}
          />
        ) : null}

        <PeriodTabs
          value={kind}
          isLive={frame.isLive}
          onChange={(next) => {
            haptic("select");
            setKind(next);
          }}
        />

        <KeptHero
          kind={kind}
          profit={profit}
          spent={spent}
          salesDelta={sales.metrics.sales.delta}
          compareLabel={frame.compareLabel}
          isLoading={expenses.isLoading}
        />

        <MoneyTiles
          moneyIn={moneyIn}
          payments={sales.payments.length}
          spent={spent}
          expenses={expenses.summary.count}
          unpaid={unpaidTotal}
          unpaidOrders={unpaidCount}
          onOpenPayments={() => setSheet("payments")}
          onOpenExpenses={() =>
            router.push(`/(merchant)/expenses?${periodQuery}` as never)
          }
          onOpenUnpaid={() =>
            router.push("/(merchant)/orders?view=collect" as never)
          }
        />

        <ShopLedgerCard
          ledger={ledger}
          unit={frame.unit}
          hasCosts={Boolean(costs.data)}
          onOpenOrder={(orderId) => router.push(`/(merchant)/order/${orderId}`)}
          onOpenAll={() => router.push("/(merchant)/orders?view=all" as never)}
          onSetUpCosts={() => router.push("/(merchant)/services" as never)}
        />

        {isToday ? (
          <View style={styles.goal}>
            <GoalBar
              collected={today.metrics.sales.total}
              goal={goal.goal}
              onEdit={() => setSheet("goal")}
            />
          </View>
        ) : null}

        <GlanceActions
          canCloseDay={isToday}
          closeLabel={dayClose.saved ? "Count again" : "Close the day"}
          onAddExpense={() => setSheet("expense")}
          onCloseDay={() => setSheet("close")}
        />

        <AnalyticsLink
          onPress={() =>
            router.push(`/(merchant)/sales-analytics?${periodQuery}` as never)
          }
        />
      </Screen>

      <LiveToast payment={live.toast} onDone={live.clearToast} />
      <GoalBurst goal={goal.burst} onDone={goal.clearBurst} />

      <PaymentsSheet
        visible={sheet === "payments"}
        title={frame.title}
        payments={sales.payments}
        total={moneyIn}
        unit={frame.unit}
        onOpenOrder={(orderId) => {
          setSheet(null);
          router.push(`/(merchant)/order/${orderId}`);
        }}
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
      {sheet === "expense" ? (
        <ExpenseSheet
          visible
          shopId={shop.id}
          expense={null}
          today={toDateKey(now)}
          onSaved={() => {
            haptic("success");
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
  shell: { flex: 1, backgroundColor: GLASS_GROUND },
  goal: {
    ...glassPane,
    padding: space.room,
  },
});
