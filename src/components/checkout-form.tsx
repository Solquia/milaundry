/**
 * Who it is for and how it is paid — the questions a till asks last.
 *
 * The old form asked the customer's name before a single service was tapped,
 * so the counter typed before it counted. Here the details come after the
 * ticket, in the order a shop actually says them: who, where it goes, how they
 * pay, and whether the money has already changed hands.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { paymentMethodIcon } from '@/lib/domain/pos-ticket';
import { PAYMENT_LABELS, paymentSummaryLine } from '@/lib/domain/payment-summary';
import {
  PAYMENT_METHODS,
  type WalkInErrors,
  type WalkInInput,
} from '@/lib/domain/walk-in-order';

import { ErrorText, Field, PhoneField, RADII, TAG_TONES, colors, space, type } from './ui-kit';

/** Two or three answers to one question, one of them always lit. */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { key: T; label: string; icon: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.segments} accessibilityRole="radiogroup">
        {options.map((option) => {
          const isActive = option.key === value;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive }}
              accessibilityLabel={option.label}
              onPress={() => onChange(option.key)}
              style={({ pressed }) => [
                styles.segment,
                isActive && styles.segmentActive,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={option.icon as never}
                size={18}
                color={isActive ? colors.onAccent : colors.subtle}
              />
              <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function CheckoutForm({
  value,
  errors,
  total,
  onChange,
}: {
  value: WalkInInput;
  errors: WalkInErrors;
  total: number | null;
  onChange: (patch: Partial<WalkInInput>) => void;
}) {
  const isDelivery = value.fulfillment === 'delivery';
  const tone = value.isPaid ? TAG_TONES.settled : TAG_TONES.owed;

  return (
    <View style={styles.form}>
      {/* The one group that is all inputs keeps a white ground: a sunken field
          laid straight on the page tint is a faint patch, not a place to type. */}
      <View style={[styles.block, styles.inputCard]}>
        <Text style={styles.blockTitle}>Customer</Text>
        <Field
          label="Name"
          value={value.customerName}
          onChangeText={(customerName) => onChange({ customerName })}
          placeholder="Maria Santos"
          autoCapitalize="words"
          returnKeyType="next"
        />
        <ErrorText>{errors.customerName}</ErrorText>
        <PhoneField
          label="Mobile number (optional)"
          value={value.customerPhone}
          onChangeText={(customerPhone) => onChange({ customerPhone })}
        />
        <ErrorText>{errors.customerPhone}</ErrorText>
      </View>

      <View style={styles.block}>
        <Segmented
          label="How does it get back to them?"
          options={[
            { key: 'pickup', label: 'They pick up', icon: 'storefront-outline' },
            { key: 'delivery', label: 'We deliver', icon: 'bicycle-outline' },
          ]}
          value={value.fulfillment}
          onChange={(fulfillment) => onChange({ fulfillment })}
        />
        {isDelivery ? (
          <>
            <Field
              label="Delivery address"
              value={value.deliveryAddress}
              onChangeText={(deliveryAddress) => onChange({ deliveryAddress })}
              placeholder="12 Mabini St, Quezon City"
            />
            <ErrorText>{errors.deliveryAddress}</ErrorText>
          </>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Payment</Text>
        <View style={styles.methods} accessibilityRole="radiogroup">
          {PAYMENT_METHODS.map((method) => {
            const isActive = value.paymentMethod === method;
            return (
              <Pressable
                key={method}
                accessibilityRole="radio"
                accessibilityState={{ checked: isActive }}
                accessibilityLabel={PAYMENT_LABELS[method]}
                onPress={() => onChange({ paymentMethod: method })}
                style={({ pressed }) => [
                  styles.method,
                  isActive && styles.methodActive,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={paymentMethodIcon(method) as never}
                  size={22}
                  color={isActive ? colors.onAccent : colors.actionInk}
                />
                <Text
                  style={[styles.methodText, isActive && styles.methodTextActive]}
                  numberOfLines={2}
                >
                  {PAYMENT_LABELS[method]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <ErrorText>{errors.paymentMethod}</ErrorText>

        <Segmented
          label="Has the money changed hands?"
          options={[
            { key: 'paid', label: 'Paid now', icon: 'checkmark-circle-outline' },
            {
              key: 'later',
              label: isDelivery ? 'Pay on delivery' : 'Pay at pickup',
              icon: 'time-outline',
            },
          ]}
          value={value.isPaid ? 'paid' : 'later'}
          onChange={(next) => onChange({ isPaid: next === 'paid' })}
        />

        {/* The same two tones the order tags wear, so "paid" and "owed" mean
            here exactly what they mean on the orders list. */}
        <View style={[styles.summary, { backgroundColor: tone.bg }]}>
          <Ionicons
            name={value.isPaid ? 'checkmark-circle' : 'alert-circle-outline'}
            size={18}
            color={tone.ink}
          />
          <Text style={[styles.summaryText, { color: tone.ink }]}>
            {paymentSummaryLine({
              paymentMethod: value.paymentMethod,
              isPaid: value.isPaid,
              fulfillment: value.fulfillment,
              total: total ?? 0,
            })}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The seam between the slip and the first question is the biggest break on
  // the page, so it carries the biggest gap; the groups below share the same.
  form: { gap: space.gulf, marginTop: space.section },
  inputCard: {
    backgroundColor: colors.card,
    borderRadius: RADII.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
  },
  /**
   * Groups sit straight on the field under their headings. The slip above is
   * the one object on this page; boxing each group in a card put bordered
   * tiles inside bordered cards, and nothing on the screen stood out.
   */
  block: { gap: space.cosy },
  blockTitle: { ...type.section, color: colors.text },

  group: { gap: space.snug },
  groupLabel: { ...type.label, color: colors.text },
  segments: {
    flexDirection: 'row',
    gap: space.tight,
    padding: space.tight,
    borderRadius: RADII.control,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: space.snug,
    borderRadius: RADII.chip,
  },
  segmentActive: { backgroundColor: colors.action },
  segmentText: { ...type.label, color: colors.text },
  segmentTextActive: { color: colors.onAccent },

  /** Three to a row; every method the same size so none looks preferred. */
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  method: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.tight,
    borderRadius: RADII.control,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: space.snug,
  },
  methodActive: { backgroundColor: colors.action, borderColor: colors.action },
  methodText: { ...type.label, fontSize: 13, color: colors.text, textAlign: 'center' },
  methodTextActive: { color: colors.onAccent },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    padding: space.cosy,
    borderRadius: RADII.chip,
  },
  summaryText: { ...type.label, flex: 1 },

  pressed: { opacity: 0.7 },
});
