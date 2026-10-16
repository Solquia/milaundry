/**
 * The new-order bell in merchant settings: a mute, and a way to hear it now.
 *
 * The test button is the whole point of this card existing. A shop that
 * cannot hear a ring until a real customer books will never know whether
 * the bell is on.
 */
import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { doorbellCard } from '@/lib/domain/shop-doorbell';
import { toggleStateLabel } from '@/lib/domain/app-settings';
import { useShopDoorbell } from '@/lib/use-shop-doorbell';

import { glassPane } from './glass';
import { GlyphTile } from './stage-glyph';
import { Button, colors, space, type } from './ui-kit';

export function DoorbellCard() {
  const doorbell = useShopDoorbell();
  const copy = doorbellCard(doorbell.enabled);
  const [rang, setRang] = useState(false);

  const onTest = () => {
    doorbell.testRing();
    setRang(true);
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <GlyphTile icon="notifications" color={colors.action} size={40} isLifted={false} />
        <View style={styles.words}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.caption}>{copy.caption}</Text>
        </View>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel={toggleStateLabel(copy.title, doorbell.enabled)}
          accessibilityState={{ checked: doorbell.enabled }}
          value={doorbell.enabled}
          onValueChange={doorbell.setEnabled}
          trackColor={{ false: colors.borderStrong, true: colors.actionMuted }}
          thumbColor={doorbell.enabled ? colors.action : colors.card}
        />
      </View>
      <View style={styles.body}>
        <Button
          title={copy.testLabel}
          variant="outline"
          onPress={onTest}
          accessibilityLabel={copy.testLabel}
        />
        {rang ? <Text style={styles.rang}>{copy.rangCaption}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...glassPane,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.cosy,
  },
  words: { flex: 1, gap: 2 },
  title: { ...type.body, fontWeight: '600', color: colors.text },
  caption: { ...type.caption, color: colors.subtle },
  body: {
    gap: space.snug,
    padding: space.room,
    paddingTop: 0,
  },
  rang: { ...type.caption, color: colors.subtle },
});
