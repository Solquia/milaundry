/**
 * End of day at the counter: type the float you started with and the cash you
 * counted, and the sheet says at once whether the drawer is even, over or
 * short. Then the Z-report goes to the thermal printer, or the day's numbers
 * go to Messenger or Viber, and the count is kept so the card can show it.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import {
  closeDay,
  dayCloseShareText,
  parseCount,
  zReportLines,
  type DaySummary,
  type DrawerClose,
} from '@/lib/domain/day-close';
import { formatMoney } from '@/lib/domain/money';
import { usePrinter } from '@/lib/use-printer';

import { SalesSheet } from './sales-sheet';
import { Button, ErrorText, Field, RADII, TAG_TONES, colors, space, type } from './ui-kit';

const VERDICT: Record<DrawerClose['tone'], { bg: string; ink: string; icon: string; word: string }> = {
  even: { ...TAG_TONES.settled, icon: 'checkmark-circle', word: 'Drawer is even' },
  over: { ...TAG_TONES.linked, icon: 'arrow-up-circle', word: 'Drawer is over' },
  short: { ...TAG_TONES.owed, icon: 'alert-circle', word: 'Drawer is short' },
};

function Line({ label, value, isStrong }: { label: string; value: string; isStrong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, isStrong && styles.strong]}>{label}</Text>
      <Text style={[styles.lineValue, isStrong && styles.strong]}>{value}</Text>
    </View>
  );
}

export function CloseDaySheet({
  visible,
  summary,
  shopName,
  onSaved,
  onClose,
}: {
  visible: boolean;
  summary: DaySummary;
  shopName: string;
  onSaved: (close: DrawerClose) => void;
  onClose: () => void;
}) {
  const printer = usePrinter();
  const [floatText, setFloatText] = useState('');
  const [countedText, setCountedText] = useState('');
  const [error, setError] = useState('');

  const float = floatText.trim() === '' ? 0 : parseCount(floatText);
  const counted = parseCount(countedText);
  const close = float !== null && counted !== null ? closeDay(summary, { float, counted }) : null;
  const cashSales = summary.methods.find((method) => method.key === 'cash')?.amount ?? 0;
  const canPrint = printer.isSupported && printer.saved !== null;

  const finish = async (how: 'print' | 'share' | 'save') => {
    if (float === null) {
      setError('The opening float should be pesos, like 500.');
      return;
    }
    if (!close) {
      setError('Type the cash you counted in the drawer.');
      return;
    }
    if (how === 'print') {
      const printed = await printer.printLines((columns) =>
        zReportLines(summary, close, { name: shopName }, columns, new Date())
      );
      if (!printed) {
        setError('The Z-report did not print. Check the printer in Settings, then try again.');
        return;
      }
    }
    if (how === 'share') {
      try {
        await Share.share({ message: dayCloseShareText(summary, close, shopName) });
      } catch {
        setError('Could not open the share sheet.');
        return;
      }
    }
    onSaved(close);
  };

  const verdict = close ? VERDICT[close.tone] : null;

  return (
    <SalesSheet visible={visible} title="Close the day" subtitle={summary.caption} onClose={onClose}>
      <View style={styles.summary}>
        <Line label="Sales today" value={formatMoney(summary.sales)} isStrong />
        {summary.methods.map((method) => (
          <Line key={method.key} label={`  ${method.label}`} value={formatMoney(method.amount)} />
        ))}
      </View>
      <Field
        label="Opening float (₱)"
        value={floatText}
        onChangeText={setFloatText}
        keyboardType="decimal-pad"
        placeholder="0"
      />
      <Field
        label="Cash counted in the drawer (₱)"
        value={countedText}
        onChangeText={(next) => {
          setCountedText(next);
          setError('');
        }}
        keyboardType="decimal-pad"
        placeholder="Count every bill and coin"
      />
      <View style={styles.summary}>
        <Line label="Float + cash sales" value={formatMoney((float ?? 0) + cashSales)} />
        <Line label="Counted" value={counted === null ? '—' : formatMoney(counted)} />
      </View>
      {close && verdict ? (
        <View style={[styles.verdict, { backgroundColor: verdict.bg }]} accessibilityLiveRegion="polite">
          <Ionicons name={verdict.icon as never} size={22} color={verdict.ink} />
          <Text style={[styles.verdictText, { color: verdict.ink }]}>
            {verdict.word}
            {close.tone === 'even' ? '' : ` by ${formatMoney(Math.abs(close.difference))}`}
          </Text>
        </View>
      ) : null}
      <ErrorText>{error}</ErrorText>
      {canPrint ? (
        <Button
          title={printer.state.kind === 'printing' ? 'Printing…' : 'Save and print Z-report'}
          onPress={() => void finish('print')}
          disabled={printer.state.kind === 'printing'}
        />
      ) : null}
      <Button
        title="Save and share"
        variant={canPrint ? 'outline' : 'primary'}
        onPress={() => void finish('share')}
      />
      <Button title="Just save" variant="outline" onPress={() => void finish('save')} />
    </SalesSheet>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 4, padding: space.cosy, borderRadius: RADII.control, backgroundColor: colors.sunken },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.snug },
  lineLabel: { ...type.caption, color: colors.subtle },
  lineValue: { ...type.caption, color: colors.text },
  strong: { fontWeight: '700', color: colors.text, fontSize: 14 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: space.snug, padding: space.cosy, borderRadius: RADII.control },
  verdictText: { ...type.label, fontSize: 16 },
});