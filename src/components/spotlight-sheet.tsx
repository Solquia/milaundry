/**
 * One service up close: the photo large, what it is, what the shop needs to
 * know about the load, and the price beside the button that adds it — the
 * sheet Shopee and McDonald's raise over the grid when a product is tapped.
 *
 * It answers in place: adding here updates the card and the basket bar
 * underneath, and the sheet stays up so a second piece is one more tap.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ServicePhoto } from './service-photo';
import { AddControl } from './spotlight-grid';
import { ACCENTS, CROWN, RADII, colors, space, type } from './ui-kit';
import { capacityLabel, minimumLabel } from '@/lib/domain/price-label';
import { CATEGORY_LABELS } from '@/lib/domain/service-catalog';
import { showcaseBlurb, showcaseTitle } from '@/lib/domain/service-showcase';
import { spotlightPrice, type ServiceFrame, type SpotlightService } from '@/lib/domain/spotlight';

type Accent = (typeof ACCENTS)[number];

interface SpotlightSheetProps {
  service: SpotlightService | null;
  frame: ServiceFrame | undefined;
  quantity: number;
  accent: Accent;
  /** Shown but not addable: the app before the customer has connected. */
  isDisabled: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export function SpotlightSheet({
  service,
  frame,
  quantity,
  accent,
  isDisabled,
  onAdd,
  onRemove,
  onClose,
}: SpotlightSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={service !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" onPress={onClose} />
        {service ? (
          <SheetBody
            service={service}
            frame={frame}
            quantity={quantity}
            accent={accent}
            isDisabled={isDisabled}
            bottom={insets.bottom}
            onAdd={onAdd}
            onRemove={onRemove}
            onClose={onClose}
          />
        ) : null}
      </View>
    </Modal>
  );
}

interface SheetBodyProps extends Omit<SpotlightSheetProps, 'service'> {
  service: SpotlightService;
  bottom: number;
}

function SheetBody({ service, frame, quantity, accent, isDisabled, bottom, onAdd, onRemove, onClose }: SheetBodyProps) {
  const { figure, unit } = spotlightPrice(service);
  const facts = [minimumLabel(service), capacityLabel(service)].filter((fact): fact is string => Boolean(fact));
  const isWeighed = service.unit === 'per_kg';

  return (
    <View style={[styles.sheet, { paddingBottom: bottom + space.room }]} accessibilityViewIsModal>
      <View style={[styles.photo, { backgroundColor: accent.surface }]}>
        {frame ? (
          <ServicePhoto
            photo={frame.photo}
            uri={frame.imageUrl}
            style={[styles.photoWell, { backgroundColor: accent.surface }]}
          />
        ) : null}
        <View style={[styles.grab, { backgroundColor: accent.ink }]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={8}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={[styles.chip, { backgroundColor: accent.surface }]}>
          <Text style={[styles.chipText, { color: accent.ink }]}>{CATEGORY_LABELS[service.category]}</Text>
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {showcaseTitle(service.name)}
        </Text>
        <Text style={styles.blurb}>{showcaseBlurb(service)}</Text>
        {facts.map((fact) => (
          <View key={fact} style={styles.fact}>
            <Ionicons name="information-circle-outline" size={16} color={colors.subtle} />
            <Text style={styles.factText}>{fact}</Text>
          </View>
        ))}
        {isWeighed ? (
          <View style={styles.fact}>
            <Ionicons name="scale-outline" size={16} color={colors.subtle} />
            <Text style={styles.factText}>Charged by weight — the shop weighs your load and confirms the total.</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.foot}>
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>Price</Text>
          <Text style={[styles.price, { color: accent.ink }]}>
            {figure}
            <Text style={styles.unit}>{unit}</Text>
          </Text>
        </View>
        {isDisabled ? (
          <Text style={styles.disabled}>Connect to the shop to order</Text>
        ) : (
          <AddControl service={service} quantity={quantity} accent={accent} onAdd={onAdd} onRemove={onRemove} isLarge />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,16,26,0.55)' },
  sheet: {
    ...CROWN,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: colors.card,
    overflow: 'hidden',
    maxHeight: '92%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  photo: { height: 280, padding: space.room, paddingTop: space.gulf },
  photoWell: { flex: 1, borderRadius: RADII.card },
  grab: {
    position: 'absolute',
    top: space.snug,
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.35,
  },
  close: {
    position: 'absolute',
    top: space.cosy,
    right: space.cosy,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  body: { padding: space.room, gap: space.snug },
  chip: { alignSelf: 'flex-start', paddingHorizontal: space.snug, paddingVertical: 3, borderRadius: RADII.pill },
  chipText: { ...type.caption, fontWeight: '700' },
  title: { ...type.title, color: colors.text },
  blurb: { ...type.body, color: colors.subtle },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: space.snug },
  factText: { ...type.caption, color: colors.subtle, flex: 1 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.cosy,
    paddingHorizontal: space.room,
    paddingTop: space.cosy,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  priceBlock: { gap: 2 },
  priceLabel: { ...type.caption, color: colors.subtle },
  price: { ...type.value },
  unit: { ...type.body, color: colors.subtle },
  disabled: { ...type.label, color: colors.subtle, flexShrink: 1, textAlign: 'right' },
});
