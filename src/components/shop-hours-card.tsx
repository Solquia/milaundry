/**
 * The hours painted on the door, and the days the shop will be shut — owner
 * only, in Settings. The quick "closed for now" lives on the door sign on the
 * orders screen; this is the plan the sign reads from.
 *
 * Hours are optional: switched off, the shop reads as open all day, as every
 * shop did before hours existed. Times move in half hours with arrows rather
 * than a keyboard — nobody opens at 8:07, and a clock picker is three taps for
 * what an arrow does in one. Closed days are a start, an end, and a word for
 * customers: "Fiesta", "Christmas", "Renovation".
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button, ErrorText, colors, space, type } from './ui-kit';
import { setShopSchedule } from '@/lib/api';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import {
  CLOSURE_NOTE_MAX,
  DEFAULT_DAY,
  WEEKDAYS_LONG,
  describeClosureDates,
  formatClock,
  formatShopDate,
  readAvailability,
  setDayHours,
  shiftShopDay,
  shopDayFrom,
  stepTime,
  upcomingClosures,
  validateClosure,
  weekOrDefault,
  type Closure,
  type DayHours,
  type WeekHours,
} from '@/lib/domain/shop-availability';
import { invalidateShopSurfaces } from '@/lib/query-keys';
import type { Shop } from '@/lib/types';
import { useNow } from '@/lib/use-now';

/** Monday first on screen, the way a shop's week reads; stored Sunday first. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
/** The shortest opening a day can be squeezed to with the arrows. */
const MIN_OPEN_MINUTES = 30;

export function ShopHoursCard({ shop }: { shop: Shop }) {
  const queryClient = useQueryClient();
  const now = useNow();
  const [hours, setHours] = useState<WeekHours | null>(() => readAvailability(shop).hours);
  const [closures, setClosures] = useState<readonly Closure[]>(() =>
    upcomingClosures(readAvailability(shop).closures, now)
  );
  const [draft, setDraft] = useState<Closure>(() => ({
    from: shopDayFrom(now, 1),
    to: shopDayFrom(now, 1),
    note: '',
  }));
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const save = useMutation({
    mutationFn: () => setShopSchedule(shop.id, hours, closures),
    onSuccess: async (updated) => {
      setError('');
      setIsDirty(false);
      setNote('Saved. Customers see the new hours now.');
      await invalidateShopSurfaces(queryClient, shop.id, updated);
    },
    onError: (err: Error) => setError(friendlyMerchantError('save-hours', err.message)),
  });

  const touch = () => {
    setIsDirty(true);
    setNote('');
  };

  const changeHours = (next: WeekHours | null) => {
    setHours(next);
    touch();
  };

  const setDay = (weekday: number, day: DayHours | null) =>
    changeHours(setDayHours(weekOrDefault(hours), weekday, day));

  const copyMondayToAll = () => {
    const week = weekOrDefault(hours);
    changeHours(week.map(() => week[1]));
  };

  const addClosure = () => {
    const problem = validateClosure(draft, now);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setClosures(upcomingClosures([...closures, { ...draft, note: draft.note.trim() }], now));
    setDraft({ ...draft, note: '' });
    touch();
  };

  const removeClosure = (index: number) => {
    setClosures(closures.filter((_, i) => i !== index));
    touch();
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.mark}>
          <Ionicons name="time-outline" size={20} color={colors.actionInk} />
        </View>
        <View style={styles.words}>
          <Text style={styles.title}>Opening hours</Text>
          <Text style={styles.caption}>
            {hours
              ? 'Shown to customers. After hours they can still book ahead.'
              : 'Off: customers see you as open all day.'}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Set opening hours"
          value={hours !== null}
          onValueChange={(isOn) => changeHours(isOn ? weekOrDefault(null) : null)}
        />
      </View>

      {hours ? (
        <View style={styles.body}>
          {WEEK_ORDER.map((weekday) => (
            <DayRow
              key={weekday}
              name={WEEKDAYS_LONG[weekday]}
              day={hours[weekday]}
              onChange={(day) => setDay(weekday, day)}
            />
          ))}
          <Pressable accessibilityRole="button" onPress={copyMondayToAll} style={styles.link}>
            <Text style={styles.linkText}>Use Monday's hours every day</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.body}>
        <Text style={styles.subTitle}>Closed days</Text>
        <Text style={styles.caption}>
          No online orders on these days. Customers see your note and when you are back.
        </Text>
        {closures.map((closure, index) => (
          <View key={`${closure.from}:${closure.to}:${index}`} style={styles.closure}>
            <Ionicons name="calendar-outline" size={16} color={colors.subtle} />
            <Text style={styles.closureText} numberOfLines={1}>
              {describeClosureDates(closure)}
              {closure.note ? ` · ${closure.note}` : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove closed days ${describeClosureDates(closure)}`}
              onPress={() => removeClosure(index)}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={20} color={colors.subtle} />
            </Pressable>
          </View>
        ))}

        <View style={styles.dates}>
          <DateStepper
            label="From"
            day={draft.from}
            onChange={(from) => setDraft({ ...draft, from, to: draft.to < from ? from : draft.to })}
          />
          <DateStepper label="To" day={draft.to} onChange={(to) => setDraft({ ...draft, to })} />
        </View>
        <TextInput
          value={draft.note}
          onChangeText={(text) => setDraft({ ...draft, note: text })}
          maxLength={CLOSURE_NOTE_MAX}
          placeholder="Why (optional), e.g. Fiesta"
          placeholderTextColor={colors.subtle}
          style={styles.input}
          accessibilityLabel="Reason for closing"
        />
        <Button title="Add closed days" variant="outline" onPress={addClosure} />
      </View>

      <View style={styles.footer}>
        <Button
          title={save.isPending ? 'Saving…' : 'Save hours'}
          onPress={() => save.mutate()}
          disabled={!isDirty || save.isPending}
        />
        {note ? <Text style={styles.caption}>{note}</Text> : null}
        <ErrorText>{error}</ErrorText>
      </View>
    </View>
  );
}

function DayRow({
  name,
  day,
  onChange,
}: {
  name: string;
  day: DayHours | null;
  onChange: (day: DayHours | null) => void;
}) {
  const stepOpens = (steps: number) => {
    if (!day) return;
    onChange({ ...day, opens: Math.min(stepTime(day.opens, steps), day.closes - MIN_OPEN_MINUTES) });
  };
  const stepCloses = (steps: number) => {
    if (!day) return;
    onChange({ ...day, closes: Math.max(stepTime(day.closes, steps), day.opens + MIN_OPEN_MINUTES) });
  };

  return (
    <View style={styles.day}>
      <Text style={[styles.dayName, !day && styles.dayOff]}>{name.slice(0, 3)}</Text>
      {day ? (
        <View style={styles.times}>
          <TimeStepper label={`${name} opens`} minutes={day.opens} onStep={stepOpens} />
          <Text style={styles.dash}>–</Text>
          <TimeStepper label={`${name} closes`} minutes={day.closes} onStep={stepCloses} />
        </View>
      ) : (
        <Text style={[styles.times, styles.closedText]}>Closed</Text>
      )}
      <Switch
        accessibilityLabel={`Open on ${name}`}
        value={day !== null}
        onValueChange={(isOn) => onChange(isOn ? DEFAULT_DAY : null)}
      />
    </View>
  );
}

function TimeStepper({
  label,
  minutes,
  onStep,
}: {
  label: string;
  minutes: number;
  onStep: (steps: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Arrow icon="chevron-back" label={`${label} earlier`} onPress={() => onStep(-1)} />
      <Text style={styles.time} accessibilityLabel={`${label} ${formatClock(minutes)}`}>
        {formatClock(minutes)}
      </Text>
      <Arrow icon="chevron-forward" label={`${label} later`} onPress={() => onStep(1)} />
    </View>
  );
}

function DateStepper({
  label,
  day,
  onChange,
}: {
  label: string;
  day: string;
  onChange: (day: string) => void;
}) {
  return (
    <View style={styles.dateBox}>
      <Text style={styles.dateLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Arrow
          icon="chevron-back"
          label={`${label} a day earlier`}
          onPress={() => onChange(shiftShopDay(day, -1))}
        />
        <Text style={styles.time}>{formatShopDate(day)}</Text>
        <Arrow
          icon="chevron-forward"
          label={`${label} a day later`}
          onPress={() => onChange(shiftShopDay(day, 1))}
        />
      </View>
    </View>
  );
}

function Arrow({
  icon,
  label,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={14} color={colors.actionInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.cosy, padding: space.cosy },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.actionSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flex: 1, gap: 2 },
  title: { ...type.body, fontWeight: '600', color: colors.text },
  subTitle: { ...type.label, color: colors.text },
  caption: { ...type.caption, color: colors.subtle },
  body: {
    gap: space.snug,
    padding: space.room,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  day: { flexDirection: 'row', alignItems: 'center', gap: space.snug, minHeight: 40 },
  dayName: { ...type.label, width: 36, color: colors.text },
  dayOff: { color: colors.subtle },
  times: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  closedText: { ...type.caption, color: colors.subtle },
  dash: { ...type.caption, color: colors.subtle },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  time: { ...type.caption, fontSize: 12, color: colors.text, minWidth: 54, textAlign: 'center' },
  arrow: {
    width: 22,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: colors.actionSurface,
  },
  link: { alignSelf: 'flex-start', paddingVertical: space.tight },
  linkText: { ...type.label, fontSize: 13, color: colors.actionInk },
  closure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    padding: space.snug,
    borderRadius: 10,
    backgroundColor: colors.bg,
  },
  closureText: { ...type.body, fontSize: 14, color: colors.text, flex: 1 },
  dates: { flexDirection: 'row', gap: space.cosy },
  dateBox: { flex: 1, gap: space.tight },
  dateLabel: { ...type.caption, color: colors.subtle },
  input: {
    ...type.body,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: space.cosy,
    paddingVertical: space.snug,
  },
  footer: {
    gap: space.snug,
    padding: space.room,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pressed: { opacity: 0.6 },
});
