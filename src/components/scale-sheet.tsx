/**
 * The scale, pulled up over the till.
 *
 * Weight is the one quantity a tap cannot set, so a per-kg tile opens this
 * instead of adding anything. The reading is set with the same drag-ruler the
 * customer used to guess it, plus chips for the loads a counter sees all day,
 * and the button quotes the exact charge before the ticket moves.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { quickWeights, scaleSheetCta } from '@/lib/domain/pos-ticket';
import { minimumChargeNotice, priceSubtitle } from '@/lib/domain/price-label';
import { openingQuantity } from '@/lib/domain/service-intake';
import { MAX_SCALE_KG } from '@/lib/domain/weigh-order';
import type { ServiceRow } from '@/lib/types';

import { WeightScale } from './quantity-picker';
import { Button, RADII, colors, space, type } from './ui-kit';

type ScaleSheetProps = {
  /** The per-kg service being weighed, or null when the sheet is down. */
  service: ServiceRow | null;
  /** What the ticket already holds for it; 0 when it is being added. */
  currentKg: number;
  onConfirm: (kg: number) => void;
  onRemove: () => void;
  onClose: () => void;
};

export function ScaleSheet({ service, ...rest }: ScaleSheetProps) {
  if (!service) return null;
  // Keyed on the service so each opening mounts fresh and reads its starting
  // weight once, instead of an effect chasing the props after the first paint.
  return <OpenScale key={service.id} service={service} {...rest} />;
}

function OpenScale({
  service,
  currentKg,
  onConfirm,
  onRemove,
  onClose,
}: ScaleSheetProps & { service: ServiceRow }) {
  const insets = useSafeAreaInsets();
  const isEditing = currentKg > 0;
  // Starts from what the ticket holds, or from the shop's own minimum, so the
  // figure on the ruler is one the customer will actually be billed.
  const [kg, setKg] = useState(() => (isEditing ? currentKg : openingQuantity(service)));

  const chips = quickWeights(service, MAX_SCALE_KG);
  const notice = minimumChargeNotice(service, kg);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close the scale"
          onPress={onClose}
          style={styles.scrim}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.room) }]}>
          <View style={styles.grip} />
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.title}>{service.name}</Text>
              <Text style={styles.subtitle}>{priceSubtitle(service)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close the scale"
              onPress={onClose}
              hitSlop={space.snug}
              style={({ pressed }) => [styles.closeKey, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={22} color={colors.subtle} />
            </Pressable>
          </View>

          <WeightScale valueKg={kg} onChange={setKg} maxKg={MAX_SCALE_KG} />

          <View style={styles.chips}>
            {chips.map((load) => {
              const isActive = load === kg;
              return (
                <Pressable
                  key={load}
                  accessibilityRole="button"
                  accessibilityLabel={`${load} kilograms`}
                  accessibilityState={{ selected: isActive }}
                  onPress={() => setKg(load)}
                  style={({ pressed }) => [
                    styles.chip,
                    isActive && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {load} kg
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {notice ? (
            <Text style={styles.notice} accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}

          <Button
            title={scaleSheetCta(service, kg, isEditing)}
            disabled={kg <= 0}
            onPress={() => onConfirm(kg)}
          />
          {isEditing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Take ${service.name} off the ticket`}
              onPress={onRemove}
              style={({ pressed }) => [styles.removeKey, pressed && styles.pressed]}
            >
              <Text style={styles.removeText}>Take it off the ticket</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(11, 27, 43, 0.45)',
  },
  scrim: { flex: 1 },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.room,
    paddingTop: space.snug,
    gap: space.cosy,
  },
  grip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: space.tight,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.cosy },
  headText: { flex: 1, gap: 2 },
  title: { ...type.section, color: colors.text },
  subtitle: { ...type.body, color: colors.subtle },
  closeKey: {
    width: 36,
    height: 36,
    borderRadius: RADII.card,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  chip: {
    minWidth: 64,
    height: 44,
    paddingHorizontal: space.cosy,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.action, borderColor: colors.action },
  chipText: { fontSize: 16, fontWeight: '700', color: colors.text },
  chipTextActive: { color: colors.onAccent },

  notice: { ...type.caption, fontSize: 13, color: colors.moneyOut },
  removeKey: {
    alignSelf: 'center',
    paddingVertical: space.snug,
    paddingHorizontal: space.room,
  },
  removeText: { ...type.label, color: colors.dangerInk },
  pressed: { opacity: 0.7 },
});
