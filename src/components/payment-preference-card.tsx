/**
 * How this customer usually pays.
 *
 * The reference this was drawn from lists saved cards — a brand, a masked
 * number, an expiry. This product does not have those, and should not: nothing
 * here takes a card online (`card` means the terminal on a shop's counter), and
 * a stored card number would put the whole database inside PCI-DSS scope to
 * decorate one row on a profile screen. What a laundry customer actually
 * repeats is the *choice* — cash at pickup, or the same GCash number every
 * time — so that is what is kept, and that is what a booking arrives carrying.
 *
 * The wallet number is a mobile number, which this app already holds for every
 * account. It is not an instrument, cannot be spent, and is exactly what a shop
 * asks for when it sends a request to pay.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BLUE_FIELD, ErrorText, Field, RADII, colors, elevation, space, type } from './ui-kit';
import {
  PREFERRED_METHODS,
  methodName,
  needsHandle,
  validatePaymentPreference,
  type PreferredMethod,
} from '@/lib/domain/customer-book';

/** One glyph per method, from the family the till's own tiles already use. */
const METHOD_ICONS: Record<PreferredMethod, string> = {
  cash: 'cash-outline',
  gcash: 'phone-portrait-outline',
  maya: 'wallet-outline',
  bank_transfer: 'business-outline',
};

/** What each method actually means at a laundry, in one line. */
const METHOD_NOTES: Record<PreferredMethod, string> = {
  cash: 'Hand it over at pickup, or when we deliver.',
  gcash: 'The shop sends a request to your number.',
  maya: 'The shop sends a request to your number.',
  bank_transfer: 'Transfer to the shop and send the receipt.',
};

interface PaymentPreferenceCardProps {
  method: PreferredMethod | null;
  handle: string;
  onSave: (preference: { method: PreferredMethod; handle: string }) => void;
  isBusy?: boolean;
  error?: string;
}

export function PaymentPreferenceCard({
  method,
  handle,
  onSave,
  isBusy,
  error,
}: PaymentPreferenceCardProps) {
  const [chosen, setChosen] = useState<PreferredMethod | null>(method);
  const [draftHandle, setDraftHandle] = useState(handle);
  const [handleError, setHandleError] = useState('');

  const isDirty = chosen !== method || draftHandle.trim() !== handle;

  const save = (nextMethod: PreferredMethod, nextHandle: string) => {
    const result = validatePaymentPreference({ method: nextMethod, handle: nextHandle });
    if (!result.ok) {
      setHandleError(result.errors.handle ?? '');
      return;
    }
    setHandleError('');
    onSave(result.value);
  };

  const pick = (next: PreferredMethod) => {
    setChosen(next);
    setHandleError('');
    // A method that needs no number is a finished answer, so it saves itself
    // rather than leaving a Save button lit over a decision already made.
    if (!needsHandle(next)) {
      setDraftHandle('');
      onSave({ method: next, handle: '' });
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>How you pay</Text>
      <Text style={styles.note}>
        We will have this chosen for you when you book. Nothing else is kept —
        MiLaundry never stores card numbers.
      </Text>

      <View accessibilityRole="radiogroup" style={styles.methods}>
        {PREFERRED_METHODS.map((option) => {
          const isActive = option === chosen;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive }}
              accessibilityLabel={methodName(option)}
              accessibilityHint={METHOD_NOTES[option]}
              disabled={isBusy}
              onPress={() => pick(option)}
              style={({ pressed }) => [
                styles.method,
                isActive && styles.methodActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.glyph, isActive && styles.glyphActive]}>
                <Ionicons
                  name={METHOD_ICONS[option] as never}
                  size={18}
                  color={isActive ? colors.onAccent : BLUE_FIELD.mid}
                />
              </View>
              <View style={styles.methodWords}>
                <Text style={[styles.methodName, isActive && styles.methodNameActive]}>
                  {methodName(option)}
                </Text>
                <Text style={styles.methodNote}>{METHOD_NOTES[option]}</Text>
              </View>
              {isActive ? (
                <Ionicons name="checkmark-circle" size={20} color={BLUE_FIELD.mid} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {chosen && needsHandle(chosen) ? (
        <View style={styles.handleBlock}>
          <Field
            label={`${methodName(chosen)} number`}
            value={draftHandle}
            onChangeText={setDraftHandle}
            placeholder="0917 555 0123"
            keyboardType="phone-pad"
          />
          <ErrorText>{handleError}</ErrorText>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: Boolean(isBusy) || !isDirty }}
            disabled={Boolean(isBusy) || !isDirty}
            onPress={() => save(chosen, draftHandle)}
            style={({ pressed }) => [
              styles.save,
              (!isDirty || isBusy) && styles.saveOff,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.saveText}>{isBusy ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
      ) : null}

      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    gap: space.cosy,
    ...elevation.rest,
  },
  title: { ...type.section, color: colors.text },
  note: { ...type.caption, color: colors.subtle },

  methods: { gap: space.snug },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    minHeight: 60,
    paddingHorizontal: space.cosy,
    paddingVertical: space.snug,
    borderRadius: RADII.control,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  methodActive: { borderColor: BLUE_FIELD.mid, backgroundColor: colors.actionSurface },
  glyph: {
    width: 36,
    height: 36,
    borderRadius: RADII.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.actionSurface,
  },
  glyphActive: { backgroundColor: BLUE_FIELD.mid },
  methodWords: { flex: 1, gap: 1 },
  methodName: { ...type.label, fontSize: 16, color: colors.text },
  methodNameActive: { color: colors.actionInk },
  methodNote: { ...type.caption, fontSize: 12, color: colors.subtle },

  handleBlock: { gap: space.snug },
  save: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_FIELD.mid,
  },
  saveOff: { opacity: 0.45 },
  saveText: { ...type.label, fontSize: 16, color: colors.onAccent },

  pressed: { opacity: 0.7 },
});
