/**
 * The sign on the shop's door, as one slim strip at the top of the merchant's
 * orders.
 *
 * It used to hang as a plaque on two strings from a nail, which cost the
 * orders list a card's height to say one word. Now it is a single line: OPEN
 * in green with the power light breathing, or CLOSED in red with when it will
 * be back. One tap on "Close" drops the choices a counter actually needs — 30
 * minutes, an hour, the rest of the day, until I reopen — with an optional
 * word for customers ("Water interruption"). A flip gives the strip a small
 * bounce so the change is noticed.
 *
 * Any member can flip it: the person at the counter is the one who goes to
 * lunch. The weekly hours and days closed ahead live in Settings, for owners.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PowerLight, STATUS_TONES } from './shop-status-pill';
import { ErrorText, colors, space, type } from './ui-kit';
import { setShopPause } from '@/lib/api';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import {
  PAUSE_NOTE_MAX,
  pauseChoices,
  readAvailability,
  shopStatus,
  type PauseChoice,
  type ShopState,
} from '@/lib/domain/shop-availability';
import { invalidateShopSurfaces } from '@/lib/query-keys';
import type { Shop } from '@/lib/types';
import { useHaptic } from '@/lib/use-app-settings';
import { useNow } from '@/lib/use-now';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/** How much the strip swells when flipped. */
const BOUNCE_SCALE = 0.04;

const PLAQUES = {
  open: { surface: '#EAF7EF', edge: '#9BD3B0' },
  shut: { surface: '#FDECEF', edge: '#F2B5C3' },
  after: { surface: colors.bg, edge: colors.borderStrong },
} as const;

export function DoorSign({ shop }: { shop: Shop }) {
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const now = useNow();
  const isReduced = useReducedMotion();
  // Held in state, not a ref: the value is read while rendering (interpolate).
  const [swing] = useState(() => new Animated.Value(0));
  const [isChoosing, setIsChoosing] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const availability = readAvailability(shop);
  const status = shopStatus(availability, now);
  const isShut = !status.isTakingOrders;
  const isAfterHours = status.state === 'closed';
  const plaque = isShut ? PLAQUES.shut : isAfterHours ? PLAQUES.after : PLAQUES.open;
  const tone = STATUS_TONES[status.state];

  const flip = useMutation({
    mutationFn: (until: Date | null) => setShopPause(shop.id, until, until ? note : ''),
    onSuccess: async (updated) => {
      setError('');
      setIsChoosing(false);
      setNote('');
      await invalidateShopSurfaces(queryClient, shop.id, updated);
    },
    onError: (err: Error) => setError(friendlyMerchantError('flip-sign', err.message)),
  });

  // Bounce on every flip, so a sign that just changed catches the eye.
  const wasShut = useRef(isShut);
  useEffect(() => {
    if (wasShut.current === isShut) return;
    wasShut.current = isShut;
    if (isReduced) return;
    swing.setValue(1);
    Animated.spring(swing, { toValue: 0, friction: 3, tension: 60, useNativeDriver: true }).start();
  }, [isShut, isReduced, swing]);

  const choose = (choice: PauseChoice) => {
    haptic('tap');
    flip.mutate(choice.until);
  };

  const reopen = () => {
    haptic('tap');
    flip.mutate(null);
  };

  const toggleChoices = () => {
    haptic('select');
    setIsChoosing((open) => !open);
  };

  return (
    <View>
      <Animated.View
        style={[
          styles.plaque,
          { backgroundColor: plaque.surface, borderColor: plaque.edge },
          {
            transform: [
              {
                scale: swing.interpolate({
                  inputRange: [-1, 1],
                  outputRange: [1 - BOUNCE_SCALE, 1 + BOUNCE_SCALE],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.face}>
          <PowerLight color={tone.light} isLive={!isShut && !isAfterHours} />
          <Text style={styles.words} numberOfLines={1}>
            <Text style={[styles.word, { color: tone.ink }]}>{isShut || isAfterHours ? 'CLOSED' : 'OPEN'}</Text>
            <Text style={styles.detail}>{`  ·  ${signLine(status.state, status.detail)}`}</Text>
          </Text>
          {status.state === 'paused' ? (
            <SignButton label="Open now" icon="sunny" isFilled onPress={reopen} isBusy={flip.isPending} />
          ) : status.state === 'holiday' ? null : (
            <SignButton
              label={isChoosing ? 'Cancel' : 'Close'}
              icon={isChoosing ? 'close' : 'moon'}
              onPress={toggleChoices}
              isBusy={flip.isPending}
            />
          )}
        </View>

        {isChoosing && !isShut ? (
          <View style={styles.choices}>
            <Text style={styles.ask}>Stop online orders for…</Text>
            <View style={styles.chips}>
              {pauseChoices(availability, now).map((choice) => (
                <Pressable
                  key={choice.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Close for ${choice.label}${choice.hint ? `, ${choice.hint}` : ''}`}
                  disabled={flip.isPending}
                  onPress={() => choose(choice)}
                  style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                >
                  <Text style={styles.chipLabel}>{choice.label}</Text>
                  {choice.hint ? <Text style={styles.chipHint}>{choice.hint}</Text> : null}
                </Pressable>
              ))}
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={PAUSE_NOTE_MAX}
              placeholder="A word for customers (optional), e.g. Water interruption"
              placeholderTextColor={colors.subtle}
              style={styles.note}
              accessibilityLabel="Note for customers"
            />
            <Text style={styles.fine}>Walk-ins at the counter still go through.</Text>
          </View>
        ) : null}
      </Animated.View>
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

/** The small line under OPEN / CLOSED, in the merchant's terms. */
function signLine(state: ShopState, detail: string | null): string {
  const tail = detail ? ` · ${detail}` : '';
  if (state === 'paused') return `Not taking online orders${tail}`;
  if (state === 'holiday') return `Closed day${tail}. Change it in Settings.`;
  if (state === 'closed') return 'After hours. Customers can still book ahead.';
  if (state === 'closing-soon') return `Closing soon${tail}`;
  return detail ? `Taking orders ${detail}` : 'Taking orders';
}

function SignButton({
  label,
  icon,
  isFilled = false,
  isBusy,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  isFilled?: boolean;
  isBusy: boolean;
  onPress: () => void;
}) {
  const ink = isFilled ? colors.onAccent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: isBusy }}
      disabled={isBusy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isFilled ? styles.buttonFilled : styles.buttonQuiet,
        (pressed || isBusy) && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={12} color={ink} />
      <Text style={[styles.buttonText, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plaque: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 6,
    paddingLeft: space.cosy,
    paddingRight: 6,
    gap: space.cosy,
  },
  face: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  words: { flex: 1 },
  word: { ...type.label, fontSize: 13, letterSpacing: 1.5 },
  detail: { ...type.caption, fontSize: 12, color: colors.subtle },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
    paddingHorizontal: 10,
    minHeight: 30,
    borderRadius: 999,
  },
  buttonQuiet: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonFilled: { backgroundColor: colors.moneyIn },
  buttonText: { ...type.label, fontSize: 12 },
  choices: { gap: space.snug },
  ask: { ...type.caption, color: colors.text, fontFamily: type.label.fontFamily },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  chip: {
    flexGrow: 1,
    flexBasis: '45%',
    paddingVertical: space.snug,
    paddingHorizontal: space.cosy,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipLabel: { ...type.label, fontSize: 14, color: colors.text },
  chipHint: { ...type.caption, fontSize: 11, color: colors.subtle },
  note: {
    ...type.body,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: space.cosy,
    paddingVertical: space.snug,
  },
  fine: { ...type.caption, fontSize: 11, color: colors.subtle },
  pressed: { opacity: 0.7 },
});
