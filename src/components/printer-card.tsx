/**
 * The "Connect printer" row in merchant settings.
 *
 * Folded away until wanted: a row that says which printer this phone
 * remembers, and a body that scans for a new one. Pairing is a single tap
 * on a scan result, because BLE receipt printers have no PIN step, and the
 * test print is there so the merchant knows the pairing worked before a
 * customer is standing at the counter.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  TEXT_SIZES,
  looksLikePrinter,
  printerCopy,
  type PrinterPaper,
  type ScannedDevice,
} from '@/lib/domain/printer';
import type { Shop } from '@/lib/types';
import { usePrinter } from '@/lib/use-printer';

import { glassChip, glassPane } from './glass';
import { GlyphTile } from './stage-glyph';
import { Button, colors, space, type } from './ui-kit';

const PAPERS: PrinterPaper[] = ['58mm', '80mm'];

function DeviceRow({ device, onPress }: { device: ScannedDevice; onPress: () => void }) {
  const isPrinter = looksLikePrinter(device.name);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pair ${device.name ?? 'unnamed device'}`}
      onPress={onPress}
      style={styles.device}
    >
      <Ionicons
        name={isPrinter ? 'print-outline' : 'bluetooth-outline'}
        size={18}
        color={isPrinter ? colors.actionInk : colors.subtle}
      />
      <View style={styles.words}>
        <Text style={styles.deviceName}>{device.name ?? 'Unnamed device'}</Text>
        <Text style={styles.caption}>{device.id}</Text>
      </View>
      <Text style={styles.toggle}>Pair</Text>
    </Pressable>
  );
}

function Chip({ label, isOn, onPress }: { label: string; isOn: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isOn }}
      onPress={onPress}
      style={[styles.paper, isOn && styles.paperOn]}
    >
      <Text style={[styles.paperText, isOn && styles.paperTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** Paper width and text size: the two things a slip is laid out by. */
function ReceiptChoices() {
  const printer = usePrinter();
  return (
    <>
      <View style={styles.papers}>
        {PAPERS.map((paper) => (
          <Chip
            key={paper}
            label={`${paper} paper`}
            isOn={printer.paper === paper}
            onPress={() => printer.setPaper(paper)}
          />
        ))}
      </View>
      <Text style={styles.caption}>Receipt text size</Text>
      <View style={styles.papers}>
        {TEXT_SIZES.map(({ size, label }) => (
          <Chip
            key={size}
            label={label}
            isOn={printer.settings.textSize === size}
            onPress={() => printer.setTextSize(size)}
          />
        ))}
      </View>
    </>
  );
}

export function PrinterCard({ shop }: { shop: Shop }) {
  const [isOpen, setOpen] = useState(false);
  const printer = usePrinter();
  const copy = printerCopy(printer.state);
  const isBusy = printer.state.kind === 'scanning' || printer.state.kind === 'printing';

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isOpen ? 'Hide printer settings' : 'Show printer settings'}
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setOpen((open) => !open)}
        style={styles.row}
      >
        <GlyphTile icon="print" color={colors.action} size={40} isLifted={false} />
        <View style={styles.words}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.caption}>{copy.caption}</Text>
        </View>
        {isBusy ? <ActivityIndicator color={colors.actionInk} /> : null}
        <Text style={styles.toggle}>{isOpen ? 'Hide' : 'Show'}</Text>
      </Pressable>

      {isOpen && printer.isBrowser ? (
        <View style={styles.body}>
          <ReceiptChoices />
          <Button title="Print a test slip" onPress={() => printer.testPrint(shop)} disabled={isBusy} />
        </View>
      ) : null}

      {isOpen && printer.isSupported ? (
        <View style={styles.body}>
          {printer.saved ? (
            <>
              <ReceiptChoices />
              <Button title="Print a test slip" onPress={() => printer.testPrint(shop)} disabled={isBusy} />
              <Button title="Forget this printer" variant="outline" onPress={printer.forget} disabled={isBusy} />
            </>
          ) : null}

          {printer.state.kind === 'scanning' ? (
            <Button title="Stop looking" variant="outline" onPress={printer.stopScan} />
          ) : (
            <Button
              title={printer.saved ? 'Pair a different printer' : 'Look for printers'}
              variant={printer.saved ? 'outline' : 'primary'}
              onPress={printer.scan}
              disabled={isBusy}
            />
          )}

          {printer.devices.map((device) => (
            <DeviceRow key={device.id} device={device} onPress={() => printer.pair(device)} />
          ))}
          {printer.state.kind === 'scanning' && printer.devices.length === 0 ? (
            <Text style={styles.caption}>Nothing yet. Most printers show a blue light when they are ready.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...glassPane,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.cosy, padding: space.cosy },
  words: { flex: 1, gap: 2 },
  title: { ...type.body, fontWeight: '600', color: colors.text },
  caption: { ...type.caption, color: colors.subtle },
  toggle: { ...type.label, color: colors.actionInk, paddingHorizontal: space.tight },
  body: {
    gap: space.cosy,
    padding: space.room,
    borderTopWidth: 1,
    borderTopColor: 'rgba(60, 60, 67, 0.12)',
  },
  papers: { flexDirection: 'row', gap: space.tight },
  paper: {
    flex: 1,
    paddingVertical: space.tight,
    ...glassChip,
    borderRadius: 10,
    alignItems: 'center',
  },
  paperOn: { backgroundColor: colors.actionSurface, borderColor: colors.actionInk },
  paperText: { ...type.label, color: colors.subtle },
  paperTextOn: { color: colors.actionInk },
  device: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingVertical: space.tight,
    borderTopWidth: 1,
    borderTopColor: 'rgba(60, 60, 67, 0.12)',
  },
  deviceName: { ...type.body, color: colors.text },
});
