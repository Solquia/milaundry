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
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
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
import {
  COPY_FEEDBACK_MS,
  copyConfirmation,
  copyPrompt,
  copyableNumber,
} from '@/lib/domain/payment-copy';
import { PAYMENT_LABELS } from '@/lib/domain/payment-summary';
import {
  availableRails,
  payableMethods,
  railsNotice,
  type PaymentRail,
} from '@/lib/domain/shop-payment';
import type { PaymentMethod } from '@/lib/domain/walk-in-order';
import { useHaptic } from '@/lib/use-app-settings';

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
 * Where the money goes: the account's own name and number, and a way to take
 * the number with you.
 *
 * The number used to be set large and left there, which made copying it a
 * transcription job — read four digits, switch apps, type them, switch back.
 * Ten digits typed by eye between two apps is how a customer pays a stranger,
 * and nothing about that mistake is recoverable. So the figure keeps the shape
 * the shop typed it in, for checking against the tarpaulin, and the clipboard
 * gets the run of digits a banking field will take.
 */
function RailDetails({ rail }: { rail: PaymentRail }) {
  const haptic = useHaptic();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const payload = copyableNumber(rail.accountNumber);

  // The confirmation stands down on its own. A customer who copies, pastes,
  // and comes back to check should find the control offering to copy again
  // rather than still congratulating itself about the last time.
  useEffect(() => {
    if (state !== 'copied') return;
    const timer = setTimeout(() => setState('idle'), COPY_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = () => {
    Clipboard.setStringAsync(payload)
      .then(() => {
        haptic('success');
        setState('copied');
      })
      .catch(() => {
        // A clipboard that refused is not a copy that happened. Saying so is
        // the difference between a customer checking their paste and a
        // customer pasting an old string into a payment.
        haptic('error');
        setState('failed');
      });
  };

  const isCopied = state === 'copied';

  return (
    <View style={styles.rail}>
      <View style={styles.railHead}>
        <Ionicons name={rail.icon as never} size={18} color={colors.actionInk} />
        <Text style={styles.railLabel}>{rail.label}</Text>
      </View>

      <View style={styles.railRow}>
        <Text style={styles.railNumber} selectable>
          {rail.accountNumber}
        </Text>
        {payload ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isCopied ? copyConfirmation(rail) : copyPrompt(rail)}
            onPress={copy}
            hitSlop={space.snug}
            style={({ pressed }) => [
              styles.copyKey,
              isCopied && styles.copyKeyDone,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={isCopied ? 'checkmark' : 'copy-outline'}
              size={16}
              color={isCopied ? colors.success : colors.actionInk}
            />
            {/* Fixed width across both words, so confirming the copy does not
                shuffle the number beside it. */}
            <Text style={[styles.copyText, isCopied && styles.copyTextDone]}>
              {isCopied ? 'Copied' : 'Copy'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Subtle>{rail.accountName}</Subtle>

      {state === 'failed' ? (
        <Text style={styles.copyFailed} accessibilityLiveRegion="polite">
          Your phone would not let us copy that. Type the number across instead.
        </Text>
      ) : null}
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
  railRow: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  /** Monospace so the digits column up as they do in the banking app. */
  railNumber: {
    flex: 1,
    fontFamily: mono,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },

  /**
   * The copy control sits on the number's own line rather than under the card,
   * because it acts on the number and nothing else in the sheet does.
   */
  copyKey: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.tight,
    minWidth: 92,
    minHeight: 40,
    paddingHorizontal: space.cosy,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.actionMuted,
    backgroundColor: colors.card,
  },
  copyKeyDone: { borderColor: colors.takingsBorder, backgroundColor: colors.takingsSurface },
  copyText: { ...type.label, color: colors.actionInk },
  copyTextDone: { color: colors.success },
  copyFailed: { ...type.caption, color: colors.dangerInk },

  pressed: { opacity: 0.7 },

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
