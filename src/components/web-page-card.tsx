/**
 * The shop's web page, from the owner's side.
 *
 * Every shop has one from the moment it is created. This card is where the
 * owner learns that, copies the link for a tarpaulin or a Facebook post, and
 * can switch it off — a shop mid-renovation should not be taking calls from
 * a price list it has not updated.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';

import { GlyphTile } from '@/components/stage-glyph';
import { glassPane } from '@/components/glass';
import { Button, ErrorText, colors, fontFor, space, type } from '@/components/ui-kit';
import { setShopWebEnabled } from '@/lib/api';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { storefrontUrl } from '@/lib/domain/web-links';
import { invalidateShopSurfaces } from '@/lib/query-keys';
import type { Shop } from '@/lib/types';

export function WebPageCard({ shop }: { shop: Shop }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const url = storefrontUrl(shop.slug);
  const isEnabled = shop.web_enabled ?? true;

  const toggle = useMutation({
    mutationFn: (next: boolean) => setShopWebEnabled(shop.id, next),
    onSuccess: async (updated) => {
      setError('');
      await invalidateShopSurfaces(queryClient, shop.id, updated);
    },
    onError: (err: Error) => setError(friendlyMerchantError('save-branding', err.message)),
  });

  const copy = async () => {
    await Clipboard.setStringAsync(url);
    setNote('Link copied.');
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <GlyphTile icon="globe" color={colors.action} size={40} isLifted={false} />
        <View style={styles.words}>
          <Text style={styles.title}>Your web page</Text>
          <Text style={styles.caption}>
            {isEnabled
              ? 'Customers without the app can see your prices and call you here.'
              : 'Switched off. The link shows "not online" until you turn it back on.'}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Web page on"
          value={isEnabled}
          disabled={toggle.isPending}
          onValueChange={(next) => toggle.mutate(next)}
        />
      </View>
      {isEnabled ? (
        <View style={styles.body}>
          <Pressable accessibilityRole="button" accessibilityLabel="Copy link" onPress={copy}>
            <Text style={styles.url} numberOfLines={1}>
              {url}
            </Text>
          </Pressable>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button title="Copy link" variant="outline" onPress={copy} />
            </View>
            <View style={styles.action}>
              <Button
                title="Share"
                variant="outline"
                onPress={() =>
                  Share.share({ message: `See ${shop.name}'s prices and book: ${url}` })
                }
              />
            </View>
          </View>
          {note ? <Text style={styles.note}>{note}</Text> : null}
        </View>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...glassPane,
    borderRadius: 18,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.cosy, padding: space.cosy },
  words: { flex: 1, gap: 2 },
  title: { ...type.body, fontSize: 17, ...fontFor(600), color: colors.text },
  caption: { ...type.caption, color: colors.subtle },
  body: {
    gap: space.cosy,
    padding: space.room,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
  },
  url: { ...type.label, color: colors.actionInk },
  actions: { flexDirection: 'row', gap: space.snug },
  action: { flex: 1 },
  note: { ...type.caption, color: colors.subtle },
});
