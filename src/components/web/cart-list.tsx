/**
 * The price list with a basket in it.
 *
 * Same sections as the read-only list, but every row can be added. A line
 * that is in the basket shows its quantity between − and +; one that is not
 * shows Add. Whole units only: the shop weighs the load anyway.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/components/ui-kit';
import { formatMoneyCompact } from '@/lib/domain/money';
import { formatQuantity, minimumLabel, unitCaption } from '@/lib/domain/price-label';
import { CATEGORY_LABELS, groupServicesByCategory } from '@/lib/domain/service-catalog';
import { adjustLine, type Cart } from '@/lib/domain/web-cart';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import type { StorefrontService } from '@/lib/types';

interface CartListProps {
  services: readonly StorefrontService[];
  cart: Cart;
  onChange: (next: Cart) => void;
  theme: StorefrontTheme;
}

export function CartList({ services, cart, onChange, theme }: CartListProps) {
  const groups = groupServicesByCategory(services);
  return (
    <View style={styles.list}>
      {groups.map((group) => (
        <View key={group.category} style={styles.section}>
          <Text style={[styles.heading, { color: theme.brandInk }]}>
            {CATEGORY_LABELS[group.category]}
          </Text>
          {group.services.map((service) => (
            <CartRow
              key={service.id}
              service={service}
              quantity={cart[service.id] ?? 0}
              onAdd={() => onChange(adjustLine(cart, service, 1))}
              onRemove={() => onChange(adjustLine(cart, service, -1))}
              theme={theme}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

interface CartRowProps {
  service: StorefrontService;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  theme: StorefrontTheme;
}

function CartRow({ service, quantity, onAdd, onRemove, theme }: CartRowProps) {
  const unit = unitCaption(service.unit);
  const minimum = minimumLabel(service);
  const isFlat = service.unit === 'flat';
  return (
    <View style={styles.row}>
      <View style={styles.words}>
        <Text style={styles.name}>{service.name}</Text>
        <Text style={styles.price}>
          {formatMoneyCompact(service.price)}
          {unit}
          {minimum ? ` · ${minimum}` : ''}
        </Text>
      </View>
      {quantity > 0 ? (
        <View style={[styles.stepper, { borderColor: theme.brand }]}>
          <StepButton label="−" hint={`Remove ${service.name}`} onPress={onRemove} ink={theme.brandInk} />
          <Text style={styles.quantity}>{isFlat ? 'Added' : formatQuantity(service.unit, quantity)}</Text>
          {isFlat ? null : (
            <StepButton label="+" hint={`Add more ${service.name}`} onPress={onAdd} ink={theme.brandInk} />
          )}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${service.name}`}
          onPress={onAdd}
          style={({ pressed }) => [styles.add, { backgroundColor: theme.brandSoft }, pressed && styles.pressed]}
        >
          <Text style={[styles.addText, { color: theme.brandInk }]}>Add</Text>
        </Pressable>
      )}
    </View>
  );
}

function StepButton({ label, hint, onPress, ink }: { label: string; hint: string; onPress: () => void; ink: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.step, pressed && styles.pressed]}
    >
      <Text style={[styles.stepText, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.section },
  section: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingTop: space.room,
  },
  heading: {
    ...type.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: space.room,
    paddingBottom: space.snug,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingHorizontal: space.room,
    paddingVertical: space.cosy,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  words: { flex: 1, gap: 2 },
  name: { ...type.body, fontWeight: '600', color: colors.text },
  price: { ...type.caption, color: colors.subtle },
  add: { minHeight: 40, paddingHorizontal: space.room, borderRadius: 999, justifyContent: 'center' },
  addText: { ...type.label },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  step: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepText: { ...type.section },
  quantity: { ...type.label, color: colors.text, minWidth: 56, textAlign: 'center' },
  pressed: { opacity: 0.6 },
});
