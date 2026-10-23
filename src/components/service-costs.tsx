/**
 * The owner's costs for each service, the way a restaurant costs a dish: the
 * free supplies a load goes out with, what each costs by the ml, how much of
 * each a service uses, and so what a load costs and makes (0051).
 *
 * Staff never reach this screen; the database refuses them the figures too.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getAddonCosts, getAddonSales, getServices, getShopAddons } from '@/lib/api';
import {
  addSupply,
  deleteSupply,
  getServiceCosts,
  getServiceSupplies,
  getSupplies,
  setServiceSupplies,
  updateSupply,
} from '@/lib/cost-api';
import { confirmAction } from '@/lib/confirm';
import { RECENT_DAYS, stockLines, type StockLine } from '@/lib/domain/addon-inventory';
import { formatMoney, formatMoneyCompact } from '@/lib/domain/money';
import { stockLeftLabel, supplyFromStock } from '@/lib/domain/supply-stock';
import {
  SUPPLY_UNITS,
  SUPPLY_UNIT_LABEL,
  USAGE_BASIS_LABEL,
  formatUnitCost,
  parseAmount,
  parseSupplyDraft,
  recipeCost,
  serviceProfitLines,
  serviceProfitSummary,
  type ServiceProfitLine,
  type ServiceSupply,
  type Supply,
  type SupplyUnit,
} from '@/lib/domain/service-costs';

import { glassChip, glassPane } from './glass';
import { Segmented } from './segmented';
import { Button, ErrorText, Field, Loading, RADII, Subtle, TAG_TONES, colors, fontFor, space, type } from './ui-kit';

const UNIT_OPTIONS = SUPPLY_UNITS.map((unit) => ({ key: unit, label: SUPPLY_UNIT_LABEL[unit] }));

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

/** Free add-ons first: they are the ones that hand a free supply out. */
function linkableStock(stock: readonly StockLine[]): StockLine[] {
  return stock
    .filter((line) => line.addon.is_active)
    .sort(
      (a, b) =>
        Number(a.addon.price > 0) - Number(b.addon.price > 0) || a.addon.name.localeCompare(b.addon.name)
    );
}

/**
 * The first step of a new supply: take it from what is already on the shelf.
 * Picking fills the name and cost and links the two, so each wash that uses
 * it comes off that item's count and the supply shows how much is left.
 */
function StockPicker({
  stock,
  value,
  onPick,
}: {
  stock: readonly StockLine[];
  value: string | null;
  onPick: (line: StockLine | null) => void;
}) {
  const options = linkableStock(stock);
  if (options.length === 0) return null;
  return (
    <View style={styles.editor}>
      <Text style={styles.meta}>Pick from your stock</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {options.map((line) => {
          const isOn = line.addon.id === value;
          return (
            <Pressable
              key={line.addon.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: isOn }}
              accessibilityLabel={`${line.addon.name}, ${stockLeftLabel(line)}`}
              onPress={() => onPick(isOn ? null : line)}
              style={[styles.chip, isOn && styles.chipOn]}
            >
              <Text style={[styles.chipText, isOn && styles.chipTextOn]}>
                {`${line.addon.name} · ${stockLeftLabel(line)}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.meta}>
        {value === null
          ? 'Or type a new one below if it is not on your shelf.'
          : 'Linked: each wash that uses it takes one off this stock. Add how much one pack holds.'}
      </Text>
    </View>
  );
}

function AddonLinkPicker({
  stock,
  value,
  onChange,
}: {
  stock: readonly StockLine[];
  value: string | null;
  onChange: (addonId: string | null) => void;
}) {
  const options = [
    { id: null, label: 'Every load' },
    ...linkableStock(stock).map((line) => ({
      id: line.addon.id,
      label: `When picked: ${line.addon.name} · ${stockLeftLabel(line)}`,
    })),
  ];
  return (
    <View style={styles.editor}>
      <Text style={styles.meta}>Goes out</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {options.map((option) => {
          const isOn = option.id === value;
          return (
            <Pressable
              key={option.id ?? 'every'}
              accessibilityRole="radio"
              accessibilityState={{ checked: isOn }}
              onPress={() => onChange(option.id)}
              style={[styles.chip, isOn && styles.chipOn]}
            >
              <Text style={[styles.chipText, isOn && styles.chipTextOn]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.meta}>
        {value === null
          ? 'Every wash uses it, unless the customer bought their own detergent or fabcon.'
          : 'Only washes where the customer tapped this add-on use it. Each tap takes one off its stock.'}
      </Text>
    </View>
  );
}

function SupplyForm({
  shopId,
  supply,
  stock,
  onDone,
}: {
  shopId: string;
  supply?: Supply;
  stock: readonly StockLine[];
  onDone: () => void;
}) {
  const [name, setName] = useState(supply?.name ?? '');
  const [unit, setUnit] = useState<SupplyUnit>(supply?.unit ?? 'ml');
  const [packSize, setPackSize] = useState(supply ? String(supply.pack_size) : '');
  const [packCost, setPackCost] = useState(supply ? String(supply.pack_cost) : '');
  const [addonId, setAddonId] = useState<string | null>(supply?.addon_id ?? null);
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      const parsed = parseSupplyDraft({ name, unit, packSize, packCost, addonId });
      if (!parsed.ok) throw new Error(parsed.error);
      await (supply ? updateSupply(supply.id, parsed.value) : addSupply(shopId, parsed.value));
    },
    onSuccess: onDone,
    onError: (err: Error) => setError(err.message),
  });

  const pickFromStock = (line: StockLine | null) => {
    if (line === null) {
      setAddonId(null);
      return;
    }
    const prefill = supplyFromStock(line);
    setName(prefill.name);
    setAddonId(prefill.addonId);
    if (prefill.packCost !== null) setPackCost(prefill.packCost);
  };

  return (
    <View style={styles.editor}>
      {supply ? null : <StockPicker stock={stock} value={addonId} onPick={pickFromStock} />}
      <Field label="Name" value={name} onChangeText={setName} placeholder="Zonrox bleach" />
      <Text style={styles.meta}>Measured in</Text>
      <Segmented options={UNIT_OPTIONS} value={unit} onChange={setUnit} />
      <Field
        label={`How much is in one bottle? (${SUPPLY_UNIT_LABEL[unit]})`}
        value={packSize}
        onChangeText={setPackSize}
        keyboardType="decimal-pad"
        placeholder="1000"
      />
      <Field
        label="What did one bottle cost you?"
        value={packCost}
        onChangeText={setPackCost}
        keyboardType="decimal-pad"
        placeholder="₱0.00"
      />
      <AddonLinkPicker stock={stock} value={addonId} onChange={setAddonId} />
      <ErrorText>{error}</ErrorText>
      <Button
        title={save.isPending ? 'Saving…' : supply ? 'Save supply' : 'Add supply'}
        onPress={() => {
          setError('');
          save.mutate();
        }}
        disabled={save.isPending}
      />
    </View>
  );
}

/** Under a supply: what it is linked to on the shelf, and how much is left. */
function SupplyStockLine({ line }: { line: StockLine | undefined }) {
  if (!line) return <Text style={styles.meta}>Every load · not linked to stock</Text>;
  const isShort = line.status === 'out' || line.status === 'low';
  return (
    <Text style={[styles.meta, isShort && styles.short]}>
      {`Linked to ${line.addon.name} · ${stockLeftLabel(line)}${line.left === null ? '' : ' in stock'}`}
    </Text>
  );
}

function SuppliesPane({
  shopId,
  supplies,
  stock,
  onChanged,
}: {
  shopId: string;
  supplies: Supply[];
  stock: readonly StockLine[];
  onChanged: () => void;
}) {
  const stockById = new Map(stock.map((line) => [line.addon.id, line]));
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [error, setError] = useState('');
  const remove = useMutation({
    mutationFn: (id: string) => deleteSupply(id),
    onSuccess: onChanged,
    onError: (err: Error) => setError(err.message),
  });

  const done = () => {
    setEditingId(null);
    onChanged();
  };
  const confirmRemove = (supply: Supply) =>
    confirmAction(
      {
        title: `Remove ${supply.name}?`,
        message: 'Every service that uses it stops counting its cost.',
        confirmLabel: 'Remove',
        dismissLabel: 'Keep it',
      },
      () => remove.mutate(supply.id)
    );

  return (
    <View style={styles.pane}>
      <Text style={styles.paneTitle}>Free supplies</Text>
      <Subtle>What your loads go out with at no charge. Enter each bottle and what you paid for it.</Subtle>
      {supplies.length === 0 ? (
        <Text style={styles.meta}>No supplies yet. Add your detergent, fabcon, bleach and the rest.</Text>
      ) : null}
      {supplies.map((supply) => (
        <View key={supply.id} style={styles.supplyRow}>
          <View style={styles.rowHead}>
            <View style={styles.grow}>
              <Text style={styles.name}>{supply.name}</Text>
              <Text style={styles.meta}>
                {`${supply.pack_size} ${SUPPLY_UNIT_LABEL[supply.unit]} for ${formatMoney(supply.pack_cost)} · ${formatUnitCost(supply)}`}
              </Text>
              <SupplyStockLine line={supply.addon_id ? stockById.get(supply.addon_id) : undefined} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Change ${supply.name}`}
              onPress={() => setEditingId((current) => (current === supply.id ? null : supply.id))}
              style={styles.chip}
            >
              <Text style={styles.chipText}>Edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${supply.name}`}
              onPress={() => confirmRemove(supply)}
              style={styles.chip}
            >
              <Text style={[styles.chipText, { color: colors.danger }]}>Remove</Text>
            </Pressable>
          </View>
          {editingId === supply.id ? <SupplyForm shopId={shopId} supply={supply} stock={stock} onDone={done} /> : null}
        </View>
      ))}
      <ErrorText>{error}</ErrorText>
      {editingId === 'new' ? (
        <SupplyForm shopId={shopId} stock={stock} onDone={done} />
      ) : (
        <Button title="+ Add supply" variant="outline" onPress={() => setEditingId('new')} />
      )}
    </View>
  );
}

function RecipeEditor({
  line,
  supplies,
  recipe,
  onDone,
}: {
  line: ServiceProfitLine;
  supplies: Supply[];
  recipe: ServiceSupply[];
  onDone: () => void;
}) {
  const serviceId = line.service.id;
  const basis = USAGE_BASIS_LABEL[line.basis];
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      supplies.map((supply) => {
        const used = recipe.find((row) => row.service_id === serviceId && row.supply_id === supply.id);
        return [supply.id, used ? String(used.amount) : ''];
      })
    )
  );
  const [error, setError] = useState('');

  const parsed = supplies.map((supply) => ({ supply, result: parseAmount(amounts[supply.id] ?? '') }));
  const draft: ServiceSupply[] = parsed.flatMap(({ supply, result }) =>
    result.ok && result.value > 0 ? [{ service_id: serviceId, supply_id: supply.id, amount: result.value }] : []
  );
  const preview = recipeCost(serviceId, draft, supplies);

  const save = useMutation({
    mutationFn: () => {
      const bad = parsed.find(({ result }) => !result.ok);
      if (bad && !bad.result.ok) throw new Error(`${bad.supply.name}: ${bad.result.error}`);
      return setServiceSupplies(
        serviceId,
        parsed.map(({ supply, result }) => ({ supply_id: supply.id, amount: result.ok ? result.value : 0 }))
      );
    },
    onSuccess: onDone,
    onError: (err: Error) => setError(err.message),
  });

  if (supplies.length === 0) {
    return <Text style={styles.meta}>Add your free supplies above first.</Text>;
  }

  return (
    <View style={styles.editor}>
      {supplies.map((supply) => (
        <Field
          key={supply.id}
          label={`${supply.name} (${SUPPLY_UNIT_LABEL[supply.unit]} per ${basis})`}
          value={amounts[supply.id] ?? ''}
          onChangeText={(text) => setAmounts((current) => ({ ...current, [supply.id]: text }))}
          keyboardType="decimal-pad"
          placeholder="0"
        />
      ))}
      <Text style={styles.meta}>
        {preview === null ? 'Uses no supplies.' : `Supplies cost ${formatMoney(preview)} per ${basis}.`}
      </Text>
      <ErrorText>{error}</ErrorText>
      <Button
        title={save.isPending ? 'Saving…' : 'Save supplies'}
        onPress={() => {
          setError('');
          save.mutate();
        }}
        disabled={save.isPending}
      />
    </View>
  );
}

function serviceSummary(line: ServiceProfitLine): string {
  const basis = USAGE_BASIS_LABEL[line.basis];
  if (line.unitCost === null) return 'No supplies set yet';
  const cost = `Supplies ${formatMoney(line.unitCost)} per ${basis}`;
  if (line.profitPerUnit === null) return cost;
  return `Sells ${formatMoney(line.service.price)} · ${cost} · ${formatMoney(line.profitPerUnit)} profit each`;
}

function ServiceCostRowView({
  line,
  supplies,
  recipe,
  onSaved,
}: {
  line: ServiceProfitLine;
  supplies: Supply[];
  recipe: ServiceSupply[];
  onSaved: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <View style={styles.grow}>
          <Text style={styles.name}>{line.service.name}</Text>
          <Text style={styles.meta}>{serviceSummary(line)}</Text>
          {line.revenueRecent > 0 ? (
            <Text style={styles.meta}>
              {`${RECENT_DAYS} days: ${formatMoney(line.revenueRecent)} sales`}
              {line.profitRecent === null ? '' : ` · ${formatMoney(line.profitRecent)} profit`}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          accessibilityLabel={`Set the supplies ${line.service.name} uses`}
          onPress={() => setIsOpen((open) => !open)}
          style={[styles.chip, isOpen && styles.chipOn]}
        >
          <Text style={[styles.chipText, isOpen && styles.chipTextOn]}>Supplies</Text>
        </Pressable>
      </View>
      {isOpen ? (
        <RecipeEditor
          line={line}
          supplies={supplies}
          recipe={recipe}
          onDone={() => {
            setIsOpen(false);
            onSaved();
          }}
        />
      ) : null}
    </View>
  );
}

export function ServiceCosts({ shopId }: { shopId: string }) {
  const queryClient = useQueryClient();
  const services = useQuery({ queryKey: ['services', shopId], queryFn: () => getServices(shopId) });
  const supplies = useQuery({ queryKey: ['supplies', shopId], queryFn: () => getSupplies(shopId) });
  const addons = useQuery({ queryKey: ['shop-addons', shopId], queryFn: () => getShopAddons(shopId) });
  const recipe = useQuery({ queryKey: ['service-supplies', shopId], queryFn: () => getServiceSupplies(shopId) });
  const costs = useQuery({
    queryKey: ['service-costs', shopId, RECENT_DAYS],
    queryFn: () => getServiceCosts(shopId, RECENT_DAYS),
  });
  // The shelf's counts, so a supply can be picked from stock and show what is
  // left. Same keys as the add-on inventory: one cache, kept fresh by the
  // shell's sync whenever an order takes a pack off.
  const addonSales = useQuery({
    queryKey: ['addon-sales', shopId, RECENT_DAYS],
    queryFn: () => getAddonSales(shopId, RECENT_DAYS),
  });
  const addonCosts = useQuery({
    queryKey: ['addon-costs', shopId, RECENT_DAYS],
    queryFn: () => getAddonCosts(shopId, RECENT_DAYS),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['supplies', shopId] });
    void queryClient.invalidateQueries({ queryKey: ['service-supplies', shopId] });
    void queryClient.invalidateQueries({ queryKey: ['service-costs', shopId] });
  };

  const error = services.error ?? supplies.error ?? addons.error ?? recipe.error ?? costs.error;
  if (error) {
    return (
      <View style={styles.pane}>
        <ErrorText>{error.message}</ErrorText>
        <Button title="Try again" variant="outline" onPress={refresh} />
      </View>
    );
  }
  if (!services.data || !supplies.data || !addons.data || !recipe.data || !costs.data) return <Loading />;

  const lines = serviceProfitLines(services.data, costs.data);
  const summary = serviceProfitSummary(lines);
  const stock = stockLines(addons.data, addonSales.data ?? [], addonCosts.data ?? []);

  return (
    <View style={styles.sheet}>
      <View style={styles.pane}>
        <Text style={styles.paneTitle}>Service profit</Text>
        <Subtle>{`Last ${RECENT_DAYS} days, for services with their supplies set. Only you see this.`}</Subtle>
        <View style={styles.tiles}>
          <Tile label="Sales" value={formatMoneyCompact(summary.revenue)} />
          <Tile label="Supplies used" value={formatMoneyCompact(summary.cost)} />
          <Tile label="Profit" value={formatMoneyCompact(summary.profit)} />
        </View>
        {summary.uncosted > 0 ? (
          <Text style={styles.meta}>
            {summary.uncosted === 1
              ? '1 service that sold has no supplies set, so it is left out.'
              : `${summary.uncosted} services that sold have no supplies set, so they are left out.`}
          </Text>
        ) : null}
      </View>

      <SuppliesPane shopId={shopId} supplies={supplies.data} stock={stock} onChanged={refresh} />

      <View style={styles.list}>
        {lines.map((line) => (
          <ServiceCostRowView
            key={`${line.service.id}:${supplies.data.length}`}
            line={line}
            supplies={supplies.data}
            recipe={recipe.data}
            onSaved={refresh}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: space.cosy },
  pane: { ...glassPane, borderRadius: RADII.card, padding: space.room, gap: space.snug },
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
  list: { gap: space.snug },
  row: { ...glassPane, borderRadius: RADII.card, padding: space.cosy, gap: space.snug },
  supplyRow: { gap: space.snug, paddingVertical: 4 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.body, ...fontFor(700), color: colors.text },
  meta: { ...type.caption, color: colors.subtle },
  short: { color: TAG_TONES.owed.ink, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.tight },
  chip: {
    ...glassChip,
    minHeight: 36,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.snug,
  },
  chipOn: { backgroundColor: colors.action, borderColor: colors.action },
  chipText: { ...type.label, color: colors.actionInk },
  chipTextOn: { color: colors.onAccent },
  editor: { gap: space.snug },
});
