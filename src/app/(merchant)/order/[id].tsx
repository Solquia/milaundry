import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { CollectPayment, ProofReview } from '@/components/collect-payment';
import { OrderHero } from '@/components/order-hero';
import { OrderHolderCard } from '@/components/order-holder-card';
import { OrderLines } from '@/components/order-lines';
import { OrderTimeline } from '@/components/order-timeline';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ErrorText,
  Loading,
  Screen,
  Subtle,
  colors,
  formatMoney,
  space,
  type,
} from '@/components/ui-kit';
import { WeighSheet } from '@/components/weigh-sheet';
import {
  getOrder,
  getOrderHistory,
  getShopCustomers,
  markOrderPaid,
  updateOrderStatus,
} from '@/lib/api';
import { changeFor } from '@/lib/domain/cash-payment';
import { cancelOrderPrompt, markPaidPrompt } from '@/lib/domain/confirm-prompts';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { shortOrderId } from '@/lib/domain/order-card';
import { advanceActionLabel, nextStatuses, type OrderStatus } from '@/lib/domain/order-status';
import { proofState } from '@/lib/domain/payment-proof';
import { PAYMENT_LABELS } from '@/lib/domain/payment-summary';
import { printerCopy } from '@/lib/domain/printer';
import { buildOrderQr } from '@/lib/domain/qr';
import type { PaymentMethod } from '@/lib/domain/walk-in-order';
import { useActiveShop } from '@/lib/use-active-shop';
import { usePrinter } from '@/lib/use-printer';
import { confirmAction } from '@/lib/confirm';

/**
 * One order, top to bottom in the order the counter works it: who and how
 * much, where it is, what is on the ticket, the scale, the money, and — pinned
 * under everything so it never scrolls away — the one step that moves it on.
 */
export default function MerchantOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const [error, setError] = useState('');
  const { shop: activeShop } = useActiveShop();
  const printer = usePrinter();
  const [receipt, setReceipt] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);

  const {
    data: order,
    isLoading,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id!),
    enabled: Boolean(id),
  });
  const { data: history } = useQuery({
    queryKey: ['order-history', id],
    queryFn: () => getOrderHistory(id!),
    enabled: Boolean(id),
  });
  // Same key the Customers tab holds, so the account behind a claimed ticket
  // is usually already in the cache and the card never flickers in.
  const { data: accounts } = useQuery({
    queryKey: ['shop-customers', order?.shop_id],
    queryFn: () => getShopCustomers(order!.shop_id),
    enabled: Boolean(order?.customer_id),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] });
    queryClient.invalidateQueries({ queryKey: ['order-history', id] });
    queryClient.invalidateQueries({ queryKey: ['shop-orders'] });
  };

  const handleTransition = async (to: OrderStatus) => {
    if (!id) return;
    setError('');
    setIsPending(true);
    try {
      await updateOrderStatus(id, to);
      refresh();
    } catch (err: unknown) {
      setError(friendlyMerchantError('move-order', err instanceof Error ? err.message : ''));
    } finally {
      setIsPending(false);
    }
  };

  const handleMarkPaid = async (chosen: PaymentMethod, amount: number, tendered?: number) => {
    if (!id) return;
    setError('');
    setIsPending(true);
    try {
      await markOrderPaid(id, chosen);
      setReceipt(
        tendered === undefined
          ? `Paid · ${PAYMENT_LABELS[chosen]}`
          : `Paid · ${PAYMENT_LABELS[chosen]} · give ${formatMoney(changeFor(amount, tendered).change)} change`
      );
      refresh();
    } catch (err: unknown) {
      setError(friendlyMerchantError('save-payment', err instanceof Error ? err.message : ''));
    } finally {
      setIsPending(false);
    }
  };

  if (isLoading) return <Loading />;

  if (loadError) {
    return (
      <Screen>
        <ErrorState
          message={friendlyMerchantError('open-order', loadError.message)}
          onRetry={() => refetch()}
        />
      </Screen>
    );
  }

  // A deleted or mistyped id used to sit on an endless spinner.
  if (!order) {
    return (
      <Screen>
        <EmptyState
          message="This order no longer exists. It may have been removed."
          actionLabel="Back to orders"
          onAction={() => router.replace('/(merchant)/orders')}
        />
      </Screen>
    );
  }

  const total = order.final_total ?? order.estimated_total;
  const qrValue = buildOrderQr(order.id, order.claim_token);
  const forward = nextStatuses(order.status);
  const advance = forward.filter((to) => to !== 'cancelled');
  const canCancel = forward.includes('cancelled');
  const selectedMethod = method ?? order.payment_method;

  const confirmMarkPaid = (tendered?: number) => {
    const prompt = markPaidPrompt(total, PAYMENT_LABELS[selectedMethod], tendered);
    confirmAction(prompt, () => handleMarkPaid(selectedMethod, total, tendered), {
      isDestructive: false,
    });
  };

  const confirmCancel = () => {
    const prompt = cancelOrderPrompt(shortOrderId(order.id), total);
    confirmAction(prompt, () => handleTransition('cancelled'));
  };

  // The next step lives in a pinned footer: it is the one decision this
  // screen exists to support, and it must not scroll away under six cards.
  const footer =
    advance.length > 0 ? (
      <View style={styles.footer}>
        <ErrorText>{error}</ErrorText>
        {advance.map((to) => (
          <Button
            key={to}
            title={isPending ? 'Saving…' : advanceActionLabel(to)}
            onPress={() => handleTransition(to)}
            disabled={isPending}
          />
        ))}
      </View>
    ) : undefined;

  return (
    <Screen footer={footer}>
      <OrderHero order={order} now={now} />
      <OrderHolderCard
        order={order}
        accounts={accounts}
        now={now}
        onOpen={(bookKey) =>
          router.push(`/(merchant)/customer/${encodeURIComponent(bookKey)}` as never)
        }
      />
      <OrderTimeline status={order.status} history={history ?? []} now={now} />
      <OrderLines order={order} now={now} />

      {/* Sits above Payment deliberately: the price has to be true before it
          can be collected, and an owner works down the screen in that order. */}
      <Card>
        <WeighSheet order={order} onWeighed={() => setMethod(null)} />
      </Card>

      <Card>
        <Text style={styles.cardHeading}>Payment</Text>
        {proofState(order) === 'submitted' && <ProofReview order={order} />}
        {order.payment_status === 'paid' ? (
          <>
            <Subtle>{PAYMENT_LABELS[order.payment_method]} · paid</Subtle>
            {receipt ? (
              <Text style={styles.receipt} accessibilityLiveRegion="polite">
                {receipt}
              </Text>
            ) : null}
          </>
        ) : order.status === 'cancelled' ? (
          <Subtle>This order was cancelled. Nothing left to collect.</Subtle>
        ) : (
          <CollectPayment
            total={total}
            method={selectedMethod}
            onChangeMethod={setMethod}
            onConfirm={confirmMarkPaid}
            isPending={isPending}
          />
        )}
      </Card>

      <Card>
        <Text style={styles.cardHeading}>Receipt</Text>
        <Subtle>
          Prints the docket on the thermal printer, with the QR for this order at the bottom so
          the customer can scan it and follow the order on their phone.
        </Subtle>
        <Button
          title={printer.state.kind === 'printing' ? 'Printing…' : 'Print receipt'}
          variant="outline"
          disabled={printer.state.kind === 'printing' || !printer.saved}
          onPress={() =>
            printer.printReceipt(order, {
              name: activeShop?.name ?? order.shop?.name ?? 'MiLaundry',
              address: activeShop?.address,
              phone: activeShop?.phone,
            })
          }
        />
        {printer.state.kind === 'error' ? <ErrorText>{printerCopy(printer.state).caption}</ErrorText> : null}
        {!printer.saved && printer.state.kind !== 'error' ? (
          <Subtle>{printerCopy(printer.state).caption}</Subtle>
        ) : null}
      </Card>

      {order.customer_id === null && (
        <Card>
          <Text style={styles.cardHeading}>QR code for this customer</Text>
          <Subtle>
            Let the customer scan this with their phone, or send it to them. They can then follow
            this order and book with your shop again.
          </Subtle>
          <View style={styles.qrFrame}>
            <QRCode value={qrValue} size={180} />
          </View>
          <Button
            title="Share link"
            variant="outline"
            onPress={() => Share.share({ message: qrValue })}
          />
        </Card>
      )}

      {footer === undefined ? <ErrorText>{error}</ErrorText> : null}

      {/* Cancel is deliberately not a full-width danger button in the stack:
          it used to sit directly under the button the owner meant to press,
          same size and width, and voided a paid order on a single tap. */}
      {canCancel && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel this order"
          onPress={confirmCancel}
          disabled={isPending}
          hitSlop={8}
          style={styles.cancelLink}
        >
          <Text style={styles.cancelText}>Cancel this order</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHeading: { ...type.section, color: colors.text },
  receipt: { ...type.label, color: colors.moneyIn },
  qrFrame: { alignItems: 'center', padding: space.cosy },
  footer: { gap: space.snug },
  cancelLink: { alignSelf: 'center', paddingVertical: space.cosy, paddingHorizontal: space.room },
  cancelText: { ...type.body, fontWeight: '600', color: colors.dangerInk },
});
