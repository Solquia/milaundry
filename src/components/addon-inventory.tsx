/**
 * The add-on shelf's stock: how many packs are in the shop, how many are left,
 * what sold, and what sells best.
 *
 * The owner counts the shelf once; after that every order counts down by
 * itself, because "left" is worked out from the order lines (0049), not kept
 * by hand. A delivery is added on top of what is left, and a fresh count puts
 * the number right whenever the shelf and the app disagree.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getAddonCosts,
  getAddonSales,
  getShopAddons,
  setAddonCost,
  setAddonStock,
  undoAddonStock,
} from '@/lib/api';
import {
  RECENT_DAYS,
  STOCK_STATUS_LABEL,
  bestSellers,
  parseCostInput,
  parseStockInput,
  profitPerPack,
  restockOrder,
  restockedCount,
  stockLines,
  stockSummary,
  type StockLine,
  type StockStatus,
} from '@/lib/domain/addon-inventory';
import { formatMoney, formatMoneyCompact } from '@/lib/domain/money';
import { ADDON_KIND_SHORT } from '@/lib/domain/shop-addons';

import { AddonPicture } from './addon-shelf';
import { glassChip, glassPane } from './glass';
import {
  Button,
  ErrorText,
  Field,
  Loading,
  RADII,
  Subtle,
  TAG_TONES,
  colors,
  fontFor,
  space,
  type,
} from './ui-kit';

const THUMB = 52;

const STATUS_TONE: Record<StockStatus, { bg: string; ink: string }> = {
  out: { bg: '#FDE8E8', ink: colors.danger },
  low: TAG_TONES.owed,
  ok: TAG_TONES.settled,
  untracked: TAG_TONES.neutral,
};

function packs(count: number): string {
  return `${count} ${count === 1 ? 'pack' : 'packs'}`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function BestSellers({ lines }: { lines: StockLine[] }) {
  const top = bestSellers(lines);
  return (
    <View style={styles.pane}>
      <Text style={styles.paneTitle}>Best sellers</Text>
      <Subtle>{`Last ${RECENT_DAYS} days`}</Subtle>
      {top.length === 0 ? (
        <Text style={styles.empty}>No add-ons sold yet. They show here as orders come in.</Text>
      ) : (
        top.map((line, index) => (
          <View key={line.addon.id} style={styles.rankRow}>
            <Text style={[styles.rank, index === 0 && styles.rankFirst]}>{index + 1}</Text>
            <View style={styles.rankThumb}>
              <AddonPicture addon={line.addon} width={40} height={40} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.name} numberOfLines={1}>
                {line.addon.name}
              </Text>
              <Text style={styles.meta}>{ADDON_KIND_SHORT[line.addon.kind]}</Text>
            </View>
            <View style={styles.rankFigures}>
              <Text style={styles.rankSold}>{`${line.soldRecent} sold`}</Text>
              <Text style={styles.meta}>{formatMoneyCompact(line.revenueRecent)}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

type Editing = 'delivery' | 'count' | 'erase' | null;

/** "Sells ₱15 · Cost ₱9 · ₱6 profit each", or a nudge to enter the cost. */
function priceLine(line: StockLine): string {
  const sells = `Sells ${formatMoney(line.addon.price)}`;
  const profit = profitPerPack(line);
  if (line.unitCost === null || profit === null) return `${sells} · No cost entered yet`;
  return `${sells} · Cost ${formatMoney(line.unitCost)} · ${formatMoney(profit)} profit each`;
}

function StockRow({ line, onSaved }: { line: StockLine; onSaved: () => void }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [text, setText] = useState('');
  const [costText, setCostText] = useState('');
  const [error, setError] = useState('');
  const tone = STATUS_TONE[line.status];
  const isCounted = line.left !== null;

  const done = {
    onSuccess: () => {
      setEditing(null);
      setText('');
      setError('');
      onSaved();
    },
    onError: (err: Error) => setError(err.message),
  };

  // The cost first: a delivery saved without its cost would show a profit
  // worked out from the old one.
  const save = useMutation({
    mutationFn: async ({ count, cost }: { count: number; cost: number | null }) => {
      if (cost !== null && cost !== line.unitCost) await setAddonCost(line.addon.id, cost);
      await setAddonStock(line.addon.id, count);
    },
    ...done,
  });
  const erase = useMutation({ mutationFn: () => undoAddonStock(line.addon.id), ...done });

  const open = (mode: Exclude<Editing, null>) => {
    setError('');
    setText(mode === 'count' && line.left !== null ? String(line.left) : '');
    setCostText(line.unitCost === null ? '' : String(line.unitCost));
    setEditing((current) => (current === mode ? null : mode));
  };

  const submit = () => {
    const parsed = parseStockInput(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const cost = parseCostInput(costText);
    if (!cost.ok) {
      setError(cost.error);
      return;
    }
    const count = editing === 'delivery' ? restockedCount(line, parsed.value) : parsed.value;
    save.mutate({ count, cost: cost.value });
  };
  const isBusy = save.isPending || erase.isPending;

  return (
    <View style={[styles.row, !line.addon.is_active && styles.rowHidden]}>
      <View style={styles.rowHead}>
        <View style={styles.thumb}>
          <AddonPicture addon={line.addon} width={THUMB} height={THUMB} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.name} numberOfLines={1}>
            {line.addon.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {ADDON_KIND_SHORT[line.addon.kind]}
            {line.addon.is_active ? '' : ' · Hidden from customers'}
          </Text>
          <Text style={styles.meta}>{priceLine(line)}</Text>
          <View style={[styles.pill, { backgroundColor: tone.bg }]}>
            <Text style={[styles.pillText, { color: tone.ink }]}>{STOCK_STATUS_LABEL[line.status]}</Text>
          </View>
        </View>
        <View style={styles.leftCol}>
          {isCounted ? (
            <>
              <Text style={[styles.leftNumber, { color: line.status === 'ok' ? colors.text : tone.ink }]}>
                {line.left}
              </Text>
              <Text style={styles.meta}>{`left of ${line.counted}`}</Text>
            </>
          ) : (
            <Text style={styles.meta}>—</Text>
          )}
        </View>
      </View>

      <View style={styles.soldRow}>
        {isCounted ? (
          <Text style={styles.soldText}>
            <Text style={styles.soldStrong}>{line.soldSinceCount}</Text> sold since count
          </Text>
        ) : null}
        <Text style={styles.soldText}>
          <Text style={styles.soldStrong}>{line.soldRecent}</Text>
          {` in ${RECENT_DAYS} days`}
        </Text>
        <Text style={styles.soldText}>
          <Text style={styles.soldStrong}>{line.soldTotal}</Text> all time
        </Text>
        {line.profitRecent !== null ? (
          <Text style={styles.soldText}>
            <Text style={styles.soldStrong}>{formatMoney(line.profitRecent)}</Text>
            {` profit in ${RECENT_DAYS} days`}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        {isCounted ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: editing === 'delivery' }}
            accessibilityLabel={`Add a delivery of ${line.addon.name}`}
            onPress={() => open('delivery')}
            style={[styles.action, editing === 'delivery' && styles.actionOn]}
          >
            <Text style={[styles.actionText, editing === 'delivery' && styles.actionTextOn]}>+ Add delivery</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: editing === 'count' }}
          accessibilityLabel={`Count the ${line.addon.name} on the shelf`}
          onPress={() => open('count')}
          style={[styles.action, editing === 'count' && styles.actionOn]}
        >
          <Text style={[styles.actionText, editing === 'count' && styles.actionTextOn]}>
            {isCounted ? 'Recount shelf' : 'Count the shelf'}
          </Text>
        </Pressable>
      </View>
      {isCounted ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: editing === 'erase' }}
          accessibilityLabel={`Erase the last count or delivery of ${line.addon.name}`}
          onPress={() => open('erase')}
          style={styles.eraseLink}
        >
          <Text style={styles.eraseText}>Typed it wrong? Erase last entry</Text>
        </Pressable>
      ) : null}

      {editing === 'erase' ? (
        <View style={styles.editor}>
          <Text style={styles.meta}>
            {`This puts ${line.addon.name} back to how it was before your last count or delivery. Press again to go back further.`}
          </Text>
          <Button
            title={erase.isPending ? 'Erasing…' : 'Erase last entry'}
            variant="outline"
            onPress={() => erase.mutate()}
            disabled={isBusy}
          />
        </View>
      ) : editing ? (
        <View style={styles.editor}>
          <Field
            label={
              editing === 'delivery'
                ? `How many packs came in? (${packs(line.left ?? 0)} left now)`
                : 'How many packs are on the shelf right now?'
            }
            value={text}
            onChangeText={setText}
            keyboardType="number-pad"
            placeholder="0"
            autoFocus
          />
          <Field
            label={`What did one pack cost you? (Customers and staff see ${formatMoney(line.addon.price)})`}
            value={costText}
            onChangeText={setCostText}
            keyboardType="decimal-pad"
            placeholder="₱0.00"
          />
          <Button
            title={save.isPending ? 'Saving…' : editing === 'delivery' ? 'Add to stock' : 'Save count'}
            onPress={submit}
            disabled={isBusy}
          />
        </View>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export function AddonInventory({ shopId }: { shopId: string }) {
  const queryClient = useQueryClient();
  const addons = useQuery({ queryKey: ['shop-addons', shopId], queryFn: () => getShopAddons(shopId) });
  const sales = useQuery({
    queryKey: ['addon-sales', shopId, RECENT_DAYS],
    queryFn: () => getAddonSales(shopId, RECENT_DAYS),
  });
  const costs = useQuery({
    queryKey: ['addon-costs', shopId, RECENT_DAYS],
    queryFn: () => getAddonCosts(shopId, RECENT_DAYS),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['shop-addons', shopId] });
    void queryClient.invalidateQueries({ queryKey: ['addon-sales', shopId] });
    void queryClient.invalidateQueries({ queryKey: ['addon-costs', shopId] });
  };

  const error = addons.error ?? sales.error ?? costs.error;
  if (error) {
    return (
      <View style={styles.pane}>
        <ErrorText>{error.message}</ErrorText>
        <Button title="Try again" variant="outline" onPress={refresh} />
      </View>
    );
  }
  if (!addons.data || !sales.data || !costs.data) return <Loading />;

  const lines = stockLines(addons.data, sales.data, costs.data);
  if (lines.length === 0) {
    return (
      <View style={styles.pane}>
        <Text style={styles.paneTitle}>Stock</Text>
        <Subtle>Put soaps and fabcons on the Add-ons tab first, then count them here.</Subtle>
      </View>
    );
  }

  const summary = stockSummary(lines);

  return (
    <View style={styles.sheet}>
      <View style={styles.pane}>
        <Text style={styles.paneTitle}>Stock</Text>
        <Subtle>
          Count each shelf once. After that, every order with an add-on counts it down for you.
        </Subtle>
        <View style={styles.tiles}>
          <Tile label="Left in shop" value={String(summary.left)} />
          <Tile label={`Sold · ${RECENT_DAYS} days`} value={String(summary.soldRecent)} />
          <Tile label={`Earned · ${RECENT_DAYS} days`} value={formatMoneyCompact(summary.revenueRecent)} />
          <Tile
            label={`Profit · ${RECENT_DAYS} days`}
            value={summary.profitRecent === null ? '—' : formatMoneyCompact(summary.profitRecent)}
          />
        </View>
        {summary.profitRecent === null ? (
          <Text style={styles.meta}>Enter what each pack cost you to see your profit. Only you see costs.</Text>
        ) : null}
        {summary.needRestock > 0 ? (
          <View style={[styles.notice, { backgroundColor: TAG_TONES.owed.bg }]} accessibilityLiveRegion="polite">
            <Text style={[styles.noticeText, { color: TAG_TONES.owed.ink }]}>
              {summary.needRestock === 1
                ? '1 add-on is running low or out.'
                : `${summary.needRestock} add-ons are running low or out.`}
            </Text>
          </View>
        ) : null}
        {summary.uncounted > 0 ? (
          <Text style={styles.meta}>
            {summary.uncounted === 1
              ? '1 add-on is not counted yet.'
              : `${summary.uncounted} add-ons are not counted yet.`}
          </Text>
        ) : null}
      </View>

      <BestSellers lines={lines} />

      <View style={styles.list}>
        {restockOrder(lines).map((line) => (
          <StockRow
            key={`${line.addon.id}:${line.counted}:${line.addon.stock_counted_at ?? ''}`}
            line={line}
            onSaved={refresh}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: space.cosy },
  pane: {
    ...glassPane,
    borderRadius: RADII.card,
    padding: space.room,
    gap: space.snug,
  },
  paneTitle: { ...type.section, color: colors.text },
  tiles: { flexDirection: 'row', gap: space.snug, marginTop: space.tight },
  tile: {
    ...glassChip,
    flex: 1,
    minWidth: 0,
    borderRadius: RADII.control,
    paddingVertical: space.snug,
    paddingHorizontal: space.tight,
    alignItems: 'center',
    gap: 2,
  },
  tileValue: { ...type.section, ...fontFor(800), color: colors.text },
  tileLabel: { ...type.caption, fontSize: 11, color: colors.subtle, textAlign: 'center' },
  notice: { borderRadius: RADII.control, padding: space.snug },
  noticeText: { ...type.label },
  empty: { ...type.body, color: colors.subtle },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: space.cosy, paddingVertical: 4 },
  rank: { ...type.label, ...fontFor(800), width: 18, textAlign: 'center', color: colors.subtle },
  rankFirst: { color: colors.actionInk },
  rankThumb: { width: 40, height: 40, borderRadius: RADII.chip, overflow: 'hidden' },
  rankFigures: { alignItems: 'flex-end' },
  rankSold: { ...type.label, ...fontFor(800), color: colors.text },
  list: { gap: space.snug },
  row: {
    ...glassPane,
    borderRadius: RADII.card,
    padding: space.cosy,
    gap: space.snug,
  },
  rowHidden: { opacity: 0.7 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  thumb: { width: THUMB, height: THUMB, borderRadius: RADII.chip, overflow: 'hidden' },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.body, ...fontFor(700), color: colors.text },
  meta: { ...type.caption, color: colors.subtle },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: RADII.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
  },
  pillText: { ...type.caption, ...fontFor(700), fontSize: 11 },
  leftCol: { alignItems: 'flex-end', minWidth: 64 },
  leftNumber: { fontSize: 28, lineHeight: 32, ...fontFor(800) },
  soldRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.cosy, rowGap: 2 },
  soldText: { ...type.caption, color: colors.subtle },
  soldStrong: { ...fontFor(800), color: colors.text },
  actions: { flexDirection: 'row', gap: space.snug },
  action: {
    ...glassChip,
    flex: 1,
    minHeight: 40,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.snug,
  },
  actionOn: { backgroundColor: colors.action, borderColor: colors.action },
  actionText: { ...type.label, color: colors.actionInk },
  actionTextOn: { color: colors.onAccent },
  editor: { gap: space.snug },
  eraseLink: { alignSelf: 'flex-start', paddingVertical: 4 },
  eraseText: { ...type.caption, color: colors.actionInk, textDecorationLine: 'underline' },
});
