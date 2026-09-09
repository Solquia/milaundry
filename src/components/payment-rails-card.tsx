/**
 * Where a shop publishes how it takes money.
 *
 * These are not credentials. They are the same digits already printed on the
 * tarpaulin above the till, and the customer cannot pay without them — so the
 * screen treats them as public facts to be checked, not secrets to be hidden.
 * What it does insist on is that a saved rail is a *complete* one: a bank name
 * with no account number would show the customer a dead end.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  ErrorText,
  Field,
  Subtle,
  colors,
  space,
  type,
} from '@/components/ui-kit';
import { setShopPaymentDetails } from '@/lib/api';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { availableRails, type ShopPaymentDetails } from '@/lib/domain/shop-payment';
import { invalidateShopSurfaces } from '@/lib/query-keys';
import type { Shop } from '@/lib/types';

interface PaymentRailsCardProps {
  shop: Shop;
}

/** The shop's saved rails, as a form can hold them. */
function detailsOf(shop: Shop): ShopPaymentDetails {
  return {
    gcash_number: shop.gcash_number ?? '',
    gcash_name: shop.gcash_name ?? '',
    maya_number: shop.maya_number ?? '',
    bank_name: shop.bank_name ?? '',
    bank_account_name: shop.bank_account_name ?? '',
    bank_account_number: shop.bank_account_number ?? '',
  };
}

export function PaymentRailsCard({ shop }: PaymentRailsCardProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ShopPaymentDetails>(() => detailsOf(shop));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const set = (key: keyof ShopPaymentDetails) => (value: string) => {
    setSaved('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const mutation = useMutation({
    mutationFn: () => setShopPaymentDetails(shop.id, form),
    onSuccess: async (updated) => {
      await invalidateShopSurfaces(queryClient, shop.id, updated);
      const count = availableRails(detailsOf(updated), updated.name).length;
      setSaved(
        count === 0
          ? 'Saved. Your customers will be told you take cash only.'
          : `Saved. Customers can now pay you ${count} way${count === 1 ? '' : 's'} online.`
      );
    },
    onError: (err: Error) => setError(friendlyMerchantError('save-price', err.message)),
  });

  const rails = availableRails(form, shop.name);

  return (
    <Card>
      <Text style={styles.heading}>How customers pay you</Text>
      <Subtle>
        Shown to customers booking online, once you have weighed their laundry.
        Leave a field blank and it simply is not offered.
      </Subtle>

      <Text style={styles.groupLabel}>GCash</Text>
      <Field
        label="GCash number"
        value={form.gcash_number}
        onChangeText={set('gcash_number')}
        placeholder="09171234567"
        keyboardType="phone-pad"
      />
      <Field
        label="Account name"
        value={form.gcash_name}
        onChangeText={set('gcash_name')}
        placeholder={shop.name}
      />
      <Subtle>Also used for Maya — usually the same person.</Subtle>

      <Text style={styles.groupLabel}>Maya</Text>
      <Field
        label="Maya number"
        value={form.maya_number}
        onChangeText={set('maya_number')}
        placeholder="09181234567"
        keyboardType="phone-pad"
      />

      <Text style={styles.groupLabel}>Bank transfer</Text>
      <Field
        label="Bank"
        value={form.bank_name}
        onChangeText={set('bank_name')}
        placeholder="BPI"
      />
      <Field
        label="Account name"
        value={form.bank_account_name}
        onChangeText={set('bank_account_name')}
        placeholder={shop.name}
      />
      <Field
        label="Account number"
        value={form.bank_account_number}
        onChangeText={set('bank_account_number')}
        placeholder="1234567890"
        keyboardType="number-pad"
      />

      {/* States what the customer will actually see, so an incomplete bank
          entry is visibly missing here rather than silently dropped later. */}
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Customers will see</Text>
        <Text style={styles.summaryValue}>
          {rails.length === 0
            ? 'Cash only'
            : rails.map((rail) => rail.label).join(' · ')}
        </Text>
      </View>

      <ErrorText>{error}</ErrorText>
      {saved ? (
        <Text style={styles.saved} accessibilityLiveRegion="polite">
          {saved}
        </Text>
      ) : null}
      <Button
        title={mutation.isPending ? 'Saving…' : 'Save payment details'}
        disabled={mutation.isPending}
        onPress={() => {
          setError('');
          mutation.mutate();
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { ...type.section, color: colors.text },
  /** Names the rail the fields beneath belong to; three groups, one card. */
  groupLabel: {
    ...type.caption,
    fontWeight: '600',
    color: colors.subtle,
    marginTop: space.cosy,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.snug,
    marginTop: space.cosy,
  },
  summaryLabel: { ...type.label, color: colors.subtle },
  summaryValue: { ...type.label, color: colors.text, flexShrink: 1, textAlign: 'right' },
  saved: { ...type.body, color: colors.actionInk },
});
