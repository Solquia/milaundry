import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { shopInitials } from '@/lib/domain/connected-shops';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { type PendingScan, authHandoffNote } from '@/lib/domain/welcome-flow';

import { ACCENTS, colors, space, type } from './ui-kit';

/**
 * The scan, riding on top of the form.
 *
 * A guest who scanned a laundry and was then shown a sign-in form has every
 * reason to think the scan was lost. This row keeps the laundry in view — its
 * mark, in the colour it will wear on their home screen — and says in one line
 * what happens the moment they are in. A promise, not a step.
 */
export function HandoffNote({ scan }: { scan: PendingScan }) {
  const accent = ACCENTS[resolveAccent(scan.shop, ACCENTS.length)];
  const note = authHandoffNote(scan);

  return (
    <View
      accessibilityRole="text"
      style={[styles.row, { backgroundColor: accent.surface, borderColor: accent.ink }]}
    >
      <View style={[styles.mark, { borderColor: accent.ink }]}>
        <Text style={[styles.markText, { color: accent.ink }]}>
          {shopInitials(scan.shop.name)}
        </Text>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.name, { color: accent.ink }]} numberOfLines={1}>
          {scan.shop.name}
        </Text>
        <Text style={styles.note}>{note}</Text>
      </View>
      <Ionicons name="link-outline" size={18} color={accent.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.cosy,
    paddingRight: space.room,
    borderRadius: 16,
    borderWidth: 1,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  markText: { ...type.label, fontSize: 15, letterSpacing: 0.4 },
  copy: { flex: 1, gap: 2 },
  name: { ...type.label },
  note: { ...type.caption, fontSize: 13, lineHeight: 17, color: colors.text },
});
