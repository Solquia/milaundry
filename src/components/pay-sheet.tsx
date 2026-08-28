/**
 * The paying moment, from the customer's side of the counter they are not at.
 *
 * The money moves in the customer's own banking app; what this sheet does is
 * hand them the number to send to, then take their claim — a screenshot and a
 * reference — and pass it to the shop to verify. Every sentence comes from
 * `payment-proof.ts`, which is deliberate about never saying "payment
 * received": the app cannot see the shop's balance, only the shop can.
 *
 * Which rails appear comes from `shop-payment.ts` — a rail the shop never
 * filled in is not offered, and a cash-only shop says so instead of showing an
 * empty list.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  ErrorText,
  Field,
  Subtle,
  colors,
  formatMoney,
  mono,
  space,
  type,
} from '@/components/ui-kit';
import {
  choosePaymentMethod,
  submitPaymentProof,
  type OrderWithDetails,
} from '@/lib/api';
import { friendlyBookingError } from '@/lib/domain/booking-error';
import {
  customerProofCopy,
  proofState,
  validateReference,
} from '@/lib/domain/payment-proof';
import { PAYMENT_LABELS } from '@/lib/domain/payment-summary';
import {
  availableRails,
  payableMethods,
  railsNotice,
  type PaymentRail,
} from '@/lib/domain/shop-payment';
import type { PaymentMethod } from '@/lib/domain/walk-in-order';

interface PaySheetProps {
  order: OrderWithDetails;
}

export function PaySheet({ order }: PaySheetProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [referenceInput, setReferenceInput] = useState('');

  const state = proofState(order);
  const shopName = order.shop?.name ?? 'the shop';

  const methodMutation = useMutation({
    mutationFn: (method: PaymentMethod) => choosePaymentMethod(order.id, method),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', order.id] }),
    onError: (err: Error) => setError(friendlyBookingError(err.message)),
  });

  const proofMutation = useMutation({
    mutationFn: () =>
      submitPaymentProof(order.id, {
        photoUri: screenshotUri!,
        reference: validateReference(referenceInput)!,
        method: order.payment_method,
      }),
    onSuccess: () => {
      setScreenshotUri(null);
      setReferenceInput('');
      queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    },
    onError: (err: Error) => setError(friendlyBookingError(err.message)),
  });

  /** A payment receipt is a screenshot, so the library comes first. */
  const pickScreenshot = async () => {
    setError('');
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
    });
    if (!picked.canceled) setScreenshotUri(picked.assets[0].uri);
  };

  // Nothing to pay yet, or nothing left to pay: the bill card and the paid
  // card on the order screen already say so.
  if (state === 'not_applicable' || state === 'awaiting_price' || state === 'confirmed') {
    return null;
  }

  const copy = customerProofCopy(state, shopName);
  const amount = formatMoney(order.final_total ?? order.estimated_total);
  const details = order.shop ?? {};
  const methods = payableMethods(details, shopName);
  const rails = availableRails(details, shopName);
  const chosenRail = rails.find((rail) => rail.method === order.payment_method) ?? null;

  // The claim is already with the shop; asking again would read as doubt.
  if (state === 'submitted') {
    return (
      <Card>
        <Text style={styles.heading}>{copy.title}</Text>
        <Subtle>{copy.body}</Subtle>
        {order.payment_reference ? (
          <View style={styles.referenceRow}>
            <Text style={styles.referenceLabel}>Ref</Text>
            <Text style={styles.referenceValue}>{order.payment_reference}</Text>
          </View>
        ) : null}
      </Card>
    );
  }

  const reference = validateReference(referenceInput);
  const canSend = Boolean(screenshotUri && reference) && !proofMutation.isPending;

  return (
    <Card>
      <Text style={styles.heading}>How will you pay {amount}?</Text>

      <View style={styles.methodRow}>
        {methods.map((method) => (
          <View key={method} style={styles.methodSlot}>
            <Button
              title={
                method === 'cash'
                  ? order.fulfillment === 'delivery'
                    ? 'Cash on delivery'
                    : 'Cash at pickup'
                  : PAYMENT_LABELS[method]
              }
              variant={order.payment_method === method ? 'primary' : 'outline'}
              onPress={() => {
                setError('');
                methodMutation.mutate(method);
              }}
            />
          </View>
        ))}
      </View>
      <Subtle>{railsNotice(details, shopName)}</Subtle>

      {state === 'awaiting_counter' && (
        <View style={styles.counterNote}>
          <Ionicons name="storefront-outline" size={18} color={colors.subtle} />
          <Subtle>{copy.body}</Subtle>
        </View>
      )}

      {state === 'awaiting_payment' && chosenRail && (
        <>
          <RailDetails rail={chosenRail} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              screenshotUri ? 'Choose a different receipt' : 'Upload your receipt'
            }
            onPress={pickScreenshot}
            style={styles.proofBox}
          >
            {screenshotUri ? (
              <Image
                source={{ uri: screenshotUri }}
                style={styles.proofImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.proofEmpty}>
                <Ionicons name="image-outline" size={22} color={colors.actionInk} />
                <Text style={styles.proofLabel}>Screenshot of your receipt</Text>
              </View>
            )}
          </Pressable>

          <Field
            label="Reference number on the receipt"
            value={referenceInput}
            onChangeText={setReferenceInput}
            placeholder="e.g. 9021 3345 7788"
            autoCapitalize="characters"
          />
          {referenceInput.trim().length > 0 && !reference && (
            <Subtle>
              That doesn&apos;t look like a reference number — copy it exactly as the
              receipt prints it.
            </Subtle>
          )}

          <Button
            title={proofMutation.isPending ? 'Sending…' : `I've sent ${amount}`}
            disabled={!canSend}
            onPress={() => {
              setError('');
              proofMutation.mutate();
            }}
          />
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

/**
 * Where the money goes: the account's own name and number, set large enough to
 * copy digit by digit into a banking app on the same phone.
 */
function RailDetails({ rail }: { rail: PaymentRail }) {
  return (
    <View style={styles.rail}>
      <View style={styles.railHead}>
        <Ionicons name={rail.icon as never} size={18} color={colors.actionInk} />
        <Text style={styles.railLabel}>{rail.label}</Text>
      </View>
      <Text style={styles.railNumber}>{rail.accountNumber}</Text>
      <Subtle>{rail.accountName}</Subtle>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontWeight: '600', fontSize: 16 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodSlot: { minWidth: 100, flexGrow: 1 },

  counterNote: { flexDirection: 'row', alignItems: 'center', gap: space.snug },

  /** The one fact the whole sheet exists to deliver, framed like one. */
  rail: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.sunken,
    padding: space.cosy,
    gap: space.tight,
  },
  railHead: { flexDirection: 'row', alignItems: 'center', gap: space.tight },
  railLabel: { ...type.label, color: colors.actionInk },
  /** Monospace so the digits column up as they do in the banking app. */
  railNumber: { fontFamily: mono, fontSize: 20, fontWeight: '700', color: colors.text },

  /** Same 16:9 frame the merchant's weigh photo uses. */
  proofBox: {
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sunken,
    overflow: 'hidden',
  },
  proofImage: { width: '100%', height: '100%' },
  proofEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.tight },
  proofLabel: { ...type.label, color: colors.actionInk },

  referenceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.snug },
  referenceLabel: { ...type.label, color: colors.subtle },
  referenceValue: { fontFamily: mono, fontSize: 15, color: colors.text },
});
