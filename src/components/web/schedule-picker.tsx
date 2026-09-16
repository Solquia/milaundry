/**
 * How the laundry travels: dropped off, or collected and brought back.
 *
 * Both legs use the same calendar the app does, tinted with the shop's own
 * accent. Delivery counts its earliest day from pickup rather than from today,
 * so it can never be offered before the collection it depends on.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AddressChips } from '@/components/address-book';
import { SlotCalendar } from '@/components/slot-calendar';
import { ErrorText, Field, colors, space, type } from '@/components/ui-kit';
import type { BookingScheduleErrors } from '@/lib/domain/booking-schedule';
import type { SavedAddress } from '@/lib/domain/customer-book';
import {
  BOOKING_WINDOW_DAYS,
  keepDeliveryAfterPickup,
  turnaroundNote,
  type Slot,
} from '@/lib/domain/booking-slot';
import type { Fulfillment } from '@/lib/domain/walk-in-order';
import type { StorefrontTheme } from '@/lib/domain/web-theme';

export interface ScheduleValue {
  fulfillment: Fulfillment;
  address: string;
  pickup: Slot;
  deliver: Slot;
  notes: string;
}

export const DEFAULT_SCHEDULE: ScheduleValue = {
  fulfillment: 'delivery',
  address: '',
  pickup: { dayOffset: 0, hour: 16 },
  deliver: { dayOffset: 1, hour: 16 },
  notes: '',
};

interface SchedulePickerProps {
  value: ScheduleValue;
  onChange: (next: ScheduleValue) => void;
  errors: BookingScheduleErrors;
  theme: StorefrontTheme;
  /** What this customer has saved, so the street is picked rather than typed. */
  addresses?: readonly SavedAddress[];
}

export function SchedulePicker({
  value,
  onChange,
  errors,
  theme,
  addresses = [],
}: SchedulePickerProps) {
  const now = new Date();
  const set = (patch: Partial<ScheduleValue>) => onChange({ ...value, ...patch });
  // The calendar takes the shop's accent; its neutrals stay the app's, so a
  // pale brand cannot make an unbookable day look bookable.
  const tone = {
    accent: theme.brand,
    onAccent: theme.onBrand,
    accentSoft: theme.brandSoft,
  };

  return (
    <View style={styles.stack}>
      <View style={styles.pair}>
        <Choice
          label="Pick up & deliver"
          isSelected={value.fulfillment === 'delivery'}
          onPress={() => set({ fulfillment: 'delivery' })}
          theme={theme}
        />
        <Choice
          label="I'll drop it off"
          isSelected={value.fulfillment === 'pickup'}
          onPress={() => set({ fulfillment: 'pickup' })}
          theme={theme}
        />
      </View>

      {value.fulfillment === 'delivery' ? (
        <>
          {/* The places this customer has saved, over the field rather than
              instead of it: somewhere new still has to be typeable. */}
          <AddressChips
            addresses={addresses}
            value={value.address}
            onPick={(pick) => set({ address: pick.address })}
          />
          <Field
            label="Pickup & delivery address"
            value={value.address}
            onChangeText={(address) => set({ address })}
            placeholder="12 Mabini St, Quezon City"
            autoComplete="street-address"
          />
          <ErrorText>{errors.deliveryAddress}</ErrorText>

          <SlotCalendar
            label="Pickup"
            value={value.pickup}
            onChange={(pickup) =>
              set({ pickup, deliver: keepDeliveryAfterPickup(value.deliver, pickup) })
            }
            minOffset={0}
            maxOffset={BOOKING_WINDOW_DAYS}
            now={now}
            tone={tone}
          />
          <ErrorText>{errors.pickupAt}</ErrorText>
          <SlotCalendar
            label="Delivered back"
            value={value.deliver}
            onChange={(deliver) => set({ deliver })}
            minOffset={value.pickup.dayOffset}
            maxOffset={value.pickup.dayOffset + BOOKING_WINDOW_DAYS}
            now={now}
            tone={tone}
          />
          <Text style={styles.note}>{turnaroundNote(value.pickup, value.deliver)}</Text>
          <ErrorText>{errors.deliverBy}</ErrorText>
        </>
      ) : (
        <Text style={styles.note}>
          Bring your laundry to the shop and collect it yourself once it is ready.
        </Text>
      )}

      <Field
        label="Notes for the shop (optional)"
        value={value.notes}
        onChangeText={(notes) => set({ notes })}
        placeholder="Gate code, allergies, separate the whites…"
        multiline
      />
    </View>
  );
}

interface ChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  theme: StorefrontTheme;
}

function Choice({ label, isSelected, onPress, theme }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={[styles.choice, isSelected && { backgroundColor: theme.brand, borderColor: theme.brand }]}
    >
      <Text style={[styles.choiceText, isSelected && { color: theme.onBrand }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.cosy },
  pair: { flexDirection: 'row', gap: space.snug },
  choice: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  choiceText: { ...type.label, color: colors.text },
  note: { ...type.caption, color: colors.subtle },
});
