import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { WeighSheet } from '@/components/weigh-sheet';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ErrorText,
  Field,
  Loading,
  STATUS_LABELS,
  Screen,
  StatusBadge,
  Subtle,
  Tag,
  Title,
  colors,
  formatMoney,
  space,
} from '@/components/ui-kit';
import {
  getOrder,
  markOrderPaid,
  orderPhotoUrl,
  updateOrderStatus,
  type OrderWithDetails,
} from '@/lib/api';
import { changeFor, parseAmount, tenderSuggestions } from '@/lib/domain/cash-payment';
import { cancelOrderPrompt, markPaidPrompt } from '@/lib/domain/confirm-prompts';
import { shortOrderId } from '@/lib/domain/order-card';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import {
  ORDER_STATUSES,
  advanceActionLabel,
  nextStatuses,
  type OrderStatus,
} from '@/lib/domain/order-status';
import { orderTags } from '@/lib/domain/order-tags';
import { merchantProofCopy, proofState } from '@/lib/domain/payment-proof';
import { PAYMENT_LABELS } from '@/lib/domain/payment-summary';
import { buildOrderQr } from '@/lib/domain/qr';
import type { PaymentMethod } from '@/lib/domain/walk-in-order';

/** The forward pipeline shown in the stage tracker (cancel handled separately). */
const PIPELINE: readonly OrderStatus[] = ORDER_STATUSES.filter(
  (status) => status !== 'pending' && status !== 'cancelled'
);

/**
 * The three ways almost every neighbourhood laundry actually gets paid. The
 * rest stay behind a disclosure so the money moment is a three-way choice
 * rather than a six-button grid.
 */
const COMMON_METHODS: readonly PaymentMethod[] = ['cash', 'gcash', 'maya'];
const OTHER_METHODS: readonly PaymentMethod[] = ['card', 'bank_transfer', 'other'];

function StageTracker({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') return null;
  const currentIndex = PIPELINE.indexOf(status);
  return (
    <Card>
      <Text style={styles.cardHeading}>Where this order is</Text>
      {PIPELINE.map((stage, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <View key={stage} style={styles.stageRow}>
            <Text style={styles.stageMark}>{isDone ? '✓' : isCurrent ? '●' : '○'}</Text>
            <Text style={[styles.stageLabel, isCurrent && styles.stageLabelCurrent]}>
              {STATUS_LABELS[stage]}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

/**
 * Taking the money.
 *
 * This used to be one button reading "Mark as paid": no amount on it, no
 * method choice, no cash arithmetic, no confirmation, and a silent re-render
 * as the only sign it had worked. At a counter that silence is exactly when
 * people reopen the app to check. Now the amount is on the button and on the
 * confirmation, cash gets tender-and-change, and the result is announced.
 *
 * There is deliberately no undo: the backend has no reverse-payment call, so
 * the confirmation beforehand is the safeguard rather than a promise after.
 */
function PaymentSheet({
  total,
  method,
  onChangeMethod,
  onConfirm,
  isPending,
}: {
  total: number;
  method: PaymentMethod;
  onChangeMethod: (method: PaymentMethod) => void;
  onConfirm: (tendered?: number) => void;
  isPending: boolean;
}) {
  const [showAllMethods, setShowAllMethods] = useState(false);
  const [tenderInput, setTenderInput] = useState('');

  const isCash = method === 'cash';
  const tendered = isCash ? parseAmount(tenderInput) : null;
  const cash = tendered === null ? null : changeFor(total, tendered);
  const visibleMethods = showAllMethods ? [...COMMON_METHODS, ...OTHER_METHODS] : COMMON_METHODS;
  const isShort = Boolean(cash && !cash.isEnough);

  return (
    <>
      <Text style={styles.dueLabel}>To collect</Text>
      <Text style={styles.dueAmount}>{formatMoney(total)}</Text>

      <Text style={styles.fieldHeading}>How did the customer pay?</Text>
      <View style={styles.methodRow}>
        {visibleMethods.map((option) => (
          <View key={option} style={styles.methodSlot}>
            <Button
              title={PAYMENT_LABELS[option]}
              variant={method === option ? 'primary' : 'outline'}
              onPress={() => onChangeMethod(option)}
            />
          </View>
        ))}
      </View>
      {!showAllMethods && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowAllMethods(true)}
          hitSlop={8}
          style={styles.disclosure}
        >
          <Text style={styles.disclosureText}>Another way to pay</Text>
        </Pressable>
      )}

      {isCash && (
        <View style={styles.cashBlock}>
          <Text style={styles.fieldHeading}>How much cash did they hand over?</Text>
          <View style={styles.tenderRow}>
            {tenderSuggestions(total).map((amount) => (
              <Pressable
                key={amount}
                accessibilityRole="button"
                accessibilityLabel={`Received ${formatMoney(amount)}`}
                accessibilityState={{ selected: tendered === amount }}
                onPress={() => setTenderInput(String(amount))}
                hitSlop={8}
                style={[styles.tenderChip, tendered === amount && styles.tenderChipSelected]}
              >
                <Text
                  style={[
                    styles.tenderChipText,
                    tendered === amount && styles.tenderChipTextSelected,
                  ]}
                >
                  {formatMoney(amount)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Or type the amount"
            value={tenderInput}
            onChangeText={setTenderInput}
            keyboardType="decimal-pad"
            placeholder="3000"
            accessibilityLabel="Cash received from customer"
          />
          {cash ? (
            <Text
              style={[styles.changeLine, isShort && styles.changeLineShort]}
              accessibilityLiveRegion="polite"
            >
              {cash.isEnough
                ? // An instruction, not a label: the owner is about to count
                  // notes out of the drawer.
                  `Give ${formatMoney(cash.change)} change`
                : `Short by ${formatMoney(cash.shortfall)}. That is not enough for this order.`}
            </Text>
          ) : (
            <Subtle>Leave this blank if they paid the exact amount.</Subtle>
          )}
        </View>
      )}

      <Button
        title={isPending ? 'Recording…' : `Mark ${formatMoney(total)} as paid`}
        onPress={() => onConfirm(isCash && cash?.isEnough ? (tendered ?? undefined) : undefined)}
        disabled={isPending || isShort}
      />
    </>
  );
}

/**
 * The customer's claim, laid beside the button that would confirm it.
 *
 * The app cannot see the shop's wallet, so this never says "payment
 * received" — it shows the screenshot and the reference the customer sent,
 * and `merchantProofCopy` says the rest: check your own app first.
 */
function ProofReview({ order }: { order: OrderWithDetails }) {
  const copy = merchantProofCopy('submitted');
  const { data: proofUrl } = useQuery({
    queryKey: ['order-photo', order.payment_proof_path],
    queryFn: () => orderPhotoUrl(order.payment_proof_path),
    enabled: Boolean(order.payment_proof_path),
    // Under the signed link's one-hour TTL, so a screen left open refetches
    // before the link dies.
    staleTime: 45 * 60 * 1000,
  });

  return (
    <View style={styles.proofBlock}>
      <Text style={styles.proofTitle}>{copy.title}</Text>
      {proofUrl ? (
        <View style={styles.proofFrame}>
          <Image
            source={{ uri: proofUrl }}
            style={styles.proofImage}
            contentFit="cover"
            accessibilityLabel="Receipt the customer uploaded"
          />
        </View>
      ) : null}
      {order.payment_reference ? (
        <Text style={styles.proofReference}>Ref: {order.payment_reference}</Text>
      ) : null}
      <Subtle>{copy.body}</Subtle>
    </View>
  );
}

export default function MerchantOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
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

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] });
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

  const handleMarkPaid = async (
    chosen: PaymentMethod,
    amount: number,
    tendered?: number
  ) => {
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
    Alert.alert(prompt.title, prompt.message, [
      { text: prompt.dismissLabel, style: 'cancel' },
      {
        text: prompt.confirmLabel,
        onPress: () => handleMarkPaid(selectedMethod, total, tendered),
      },
    ]);
  };

  const confirmCancel = () => {
    const prompt = cancelOrderPrompt(shortOrderId(order.id), total);
    Alert.alert(prompt.title, prompt.message, [
      { text: prompt.dismissLabel, style: 'cancel' },
      {
        text: prompt.confirmLabel,
        style: 'destructive',
        onPress: () => handleTransition('cancelled'),
      },
    ]);
  };

  return (
    <Screen>
      <Title>Order {shortOrderId(order.id)}</Title>
      <View style={styles.tagRow}>
        <StatusBadge status={order.status} />
        {orderTags(order).map((tag) => (
          <Tag key={tag} label={tag} />
        ))}
      </View>

      <Card>
        <Text style={styles.cardHeading}>Customer</Text>
        <Text style={styles.customerName}>{order.customer_name || 'Walk-in customer'}</Text>
        {order.customer_phone ? (
          <Text
            style={styles.phoneLink}
            onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}
            accessibilityRole="link"
            accessibilityLabel={`Call ${order.customer_phone}`}
          >
            {order.customer_phone} · call
          </Text>
        ) : (
          <Subtle>No contact number on file</Subtle>
        )}
        {order.fulfillment === 'delivery' && (
          <Subtle>Deliver to: {order.delivery_address || 'No address given'}</Subtle>
        )}
        {order.notes ? <Subtle>Notes: {order.notes}</Subtle> : null}
      </Card>

      <StageTracker status={order.status} />

      <Card>
        <Text style={styles.cardHeading}>Services</Text>
        {order.order_items.map((item) => (
          <View key={item.id} style={styles.lineItem}>
            <Text style={styles.lineItemName} numberOfLines={2}>
              {item.service_name} × {item.quantity}
              {item.unit === 'per_kg' ? ' kg' : ''}
            </Text>
            <Text>{formatMoney(item.subtotal)}</Text>
          </View>
        ))}
        <Text style={styles.totalLine}>
          {order.final_total === null ? 'Estimated total' : 'Total'}: {formatMoney(total)}
        </Text>
      </Card>

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
          <PaymentSheet
            total={total}
            method={selectedMethod}
            onChangeMethod={setMethod}
            onConfirm={confirmMarkPaid}
            isPending={isPending}
          />
        )}
      </Card>

      {order.customer_id === null && (
        <Card>
          <Text style={styles.cardHeading}>QR code for this customer</Text>
          <Subtle>
            Let the customer scan this with their phone, or send it to them. They can then follow
            this order and book with your shop again.
          </Subtle>
          <View style={styles.qrFrame}>
            <QRCode value={qrValue} size={200} />
          </View>
          <Button
            title="Share link"
            variant="outline"
            onPress={() => Share.share({ message: qrValue })}
          />
        </Card>
      )}

      <ErrorText>{error}</ErrorText>
      {advance.map((to) => (
        <Button
          key={to}
          title={advanceActionLabel(to)}
          onPress={() => handleTransition(to)}
          disabled={isPending}
        />
      ))}

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
  cardHeading: { fontWeight: '600', fontSize: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.tight },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  stageMark: { fontSize: 16, minWidth: 24, textAlign: 'center' },
  stageLabel: { fontSize: 15, color: colors.subtle, flexShrink: 1 },
  stageLabelCurrent: { color: colors.text, fontWeight: '700' },
  customerName: { fontSize: 18, fontWeight: '700' },
  phoneLink: { fontSize: 16, color: colors.actionInk, fontWeight: '600' },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', gap: space.snug },
  lineItemName: { flexShrink: 1, minWidth: 0 },
  totalLine: { fontWeight: '700', fontSize: 16 },
  dueLabel: { fontSize: 13, fontWeight: '600', color: colors.subtle },
  // The one figure this card exists to deliver, in the colour that means the
  // shop has not been paid it yet.
  dueAmount: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: colors.moneyOut },
  fieldHeading: { fontSize: 13, fontWeight: '600', color: colors.subtle, marginTop: space.snug },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  methodSlot: { minWidth: 96, flexGrow: 1 },
  disclosure: { paddingVertical: space.snug },
  disclosureText: { fontSize: 14, fontWeight: '600', color: colors.actionInk },
  cashBlock: { gap: space.snug },
  tenderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  tenderChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tenderChipSelected: { borderColor: colors.action, backgroundColor: colors.action },
  tenderChipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  tenderChipTextSelected: { color: colors.onAccent },
  // Change owed back is money leaving the drawer but the sale is settled —
  // green here reads "done", which is what the owner needs at that moment.
  changeLine: { fontSize: 18, fontWeight: '700', color: colors.moneyIn },
  changeLineShort: { color: colors.danger },
  receipt: { fontSize: 14, fontWeight: '600', color: colors.moneyIn },

  /** The customer's receipt, boxed apart from the shop's own controls. */
  proofBlock: {
    gap: space.snug,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.sunken,
    padding: space.cosy,
  },
  proofTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  proofFrame: { height: 180, borderRadius: 8, overflow: 'hidden' },
  proofImage: { width: '100%', height: '100%' },
  proofReference: { fontSize: 14, fontWeight: '600', color: colors.text },

  qrFrame: { alignItems: 'center', padding: space.cosy },
  cancelLink: { alignSelf: 'center', paddingVertical: space.cosy, paddingHorizontal: space.room },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.danger },
});
