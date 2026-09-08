/**
 * How the laundry travels: dropped off, or collected and brought back.
 *
 * The same days and hours the app offers, as plain chips. Pickup and delivery
 * are each a row of days and a row of hours; delivery counts its days from
 * pickup so it can never be offered before it.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorText, Field, colors, space, type } from '@/components/ui-kit';
import type { BookingScheduleErrors } from '@/lib/domain/booking-schedule';
import {
  dayLabel,
  deliveryDayOffsets,
  hourLabel,
  keepDeliveryAfterPickup,
  turnaroundNote,
  type Slot,
} from '@/lib/domain/booking-slot';
import type { Fulfillment } from '@/lib/domain/walk-in-order';
import type { StorefrontTheme } from '@/lib/domain/web-theme';

export const SLOT_HOURS = [8, 10, 12, 14, 16, 18];
export const DAY_OFFSETS = [0, 1, 2, 3];

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
}

export function SchedulePicker({ value, onChange, errors, theme }: SchedulePickerProps) {
  const now = new Date();
  const set = (patch: Partial<ScheduleValue>) => onChange({ ...value, ...patch });

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
          <Field
            label="Pickup & delivery address"
            value={value.address}
            onChangeText={(address) => set({ address })}
            placeholder="12 Mabini St, Quezon City"
            autoComplete="street-address"
          />
          <ErrorText>{errors.deliveryAddress}</ErrorText>

          <Leg
            title="Pickup"
            slot={value.pickup}
            dayOffsets={DAY_OFFSETS}
            now={now}
            onChange={(pickup) =>
              set({ pickup, deliver: keepDeliveryAfterPickup(value.deliver, pickup) })
            }
            theme={theme}
          />
          <ErrorText>{errors.pickupAt}</ErrorText>
          <Leg
            title="Delivered back"
            slot={value.deliver}
            dayOffsets={deliveryDayOffsets(value.pickup)}
            now={now}
            onChange={(deliver) => set({ deliver })}
            theme={theme}
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

interface LegProps {
  title: string;
  slot: Slot;
  dayOffsets: number[];
  now: Date;
  onChange: (next: Slot) => void;
  theme: StorefrontTheme;
}

function Leg({ title, slot, dayOffsets, now, onChange, theme }: LegProps) {
  return (
    <View style={styles.leg}>
      <Text style={styles.legTitle}>{title}</Text>
      <View style={styles.chips}>
        {dayOffsets.map((offset) => (
          <Chip
            key={offset}
            label={dayLabel(offset, now)}
            isSelected={slot.dayOffset === offset}
            onPress={() => onChange({ ...slot, dayOffset: offset })}
            theme={theme}
          />
        ))}
      </View>
      <View style={styles.chips}>
        {SLOT_HOURS.map((hour) => (
          <Chip
            key={hour}
            label={hourLabel(hour)}
            isSelected={slot.hour === hour}
            onPress={() => onChange({ ...slot, hour })}
            theme={theme}
          />
        ))}
      </View>
    </View>
  );
}

interface ChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  theme: StorefrontTheme;
}

function Chip({ label, isSelected, onPress, theme }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={[styles.chip, isSelected && { backgroundColor: theme.brand, borderColor: theme.brand }]}
    >
      <Text style={[styles.chipText, isSelected && { color: theme.onBrand }]}>{label}</Text>
    </Pressable>
  );
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
  leg: { gap: space.snug },
  legTitle: { ...type.label, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.cosy,
    minHeight: 36,
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  chipText: { ...type.caption, fontWeight: '600', color: colors.text },
  note: { ...type.caption, color: colors.subtle },
});
