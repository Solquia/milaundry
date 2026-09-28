/**
 * The market storefront's basket page: the first half of its checkout.
 *
 * Two cards and a fold, in the order a delivery app's cart reads:
 *
 *   1. Items — what is in the basket. The load is sized on one segmented bar
 *      (baskets and kilos, one tap), with − and + beside the pick for anyone
 *      who weighed it; the price answers on the line above.
 *   2. Add more — big pieces, soap, fabcon and extras as swipeable tiles that
 *      all work the same way: "+" to add, a count once it is in.
 *   3. Notes — folded away, because most people take the shop's usual.
 *
 * It only draws. The state, the checks and placing the order stay in
 * `booking-flow`, which hands this page what it needs, so the market and the
 * classic ticket cannot book differently.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AddonPicture } from './addon-shelf';
import { HeavyItemArt, extraCloths } from './heavy-items';
import { ServiceScene } from './service-scene';
import { RADII, colors, elevation, formatMoney, space, type } from './ui-kit';
import { clampWeight } from '@/lib/domain/booking-estimate';
import { formatMoneyCompact } from '@/lib/domain/money';
import { loadFloor, loadSizeFor, loadSizes } from '@/lib/domain/load-size';
import { unitSuffix } from '@/lib/domain/price-label';
import { MAX_PIECES } from '@/lib/domain/quantity-input';
import { serviceLook, serviceLooks } from '@/lib/domain/service-look';
import { showcaseTone } from '@/lib/domain/service-showcase';
import {
  allowsMultiple,
  groupAddons,
  type AddonGroupRules,
  type AddonKind,
  type ShopAddon,
} from '@/lib/domain/shop-addons';
import type { ServiceRow } from '@/lib/types';

const INK = colors.actionInk;

/** One word per shelf. */
const RAIL_TITLES: Record<AddonKind, string> = { detergent: 'Soap', fabcon: 'Fabcon', extra: 'Extras' };

export interface MarketBasketPageProps {
  service: ServiceRow;
  isByWeight: boolean;
  /** Kilos for a load, a count for pieces. */
  quantity: number;
  onQuantity: (next: number) => void;
  /** The price of the main line at a weight. */
  priceFor: (kg: number) => string | null;
  mainAmount: number | undefined;
  /** Notes under the load: a minimum charge, a load past its limit. */
  notices: readonly string[];
  problem: string | null;
  /** Other lines the basket brought with it. */
  basketLines: readonly ServiceRow[];
  /** Heavy pieces this load can take alongside. */
  heavyExtras: readonly ServiceRow[];
  counts: Readonly<Record<string, number>>;
  onCount: (id: string, next: number) => void;
  lineAmount: (id: string) => number | undefined;
  addons: readonly ShopAddon[];
  picks: Readonly<Record<string, number>>;
  rules: AddonGroupRules;
  onToggleAddon: (addon: ShopAddon) => void;
  /** "Shop's usual", or what was picked. */
  washSummary: string;
  /** The wash questions, drawn by the flow; null when this service has none. */
  washNotes: React.ReactNode | null;
  washProblem: string | null;
}

export function MarketBasketPage(props: MarketBasketPageProps) {
  const { service, basketLines, counts, onCount, lineAmount } = props;
  const hasMore = props.heavyExtras.length > 0 || props.addons.length > 0;
  return (
    <>
      <Card title="Items">
        <MainLine {...props} />
        {basketLines.map((row) => (
          <LineRow
            key={row.id}
            service={row}
            title={row.id === service.id ? `${row.name} (more)` : row.name}
            count={counts[row.id] ?? 0}
            amount={row.id === service.id ? undefined : lineAmount(row.id)}
            onCount={(next) => onCount(row.id, next)}
          />
        ))}
      </Card>

      {hasMore ? <AddMore {...props} /> : null}

      {props.washNotes ? <Notes {...props} /> : null}
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={[styles.card, elevation.rest]}>
      <Text style={styles.cardTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

// ── the load ──────────────────────────────────────────────────────────────

function MainLine({
  service,
  isByWeight,
  quantity,
  onQuantity,
  priceFor,
  mainAmount,
  notices,
  problem,
}: MarketBasketPageProps) {
  const [isExactOpen, setIsExactOpen] = useState(false);
  if (!isByWeight) {
    return (
      <>
        <LineRow service={service} title={service.name} count={quantity} min={1} amount={mainAmount} onCount={onQuantity} />
        {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      </>
    );
  }

  const sizes = loadSizes(service);
  const chosen = loadSizeFor(sizes, quantity);
  const floor = loadFloor(service);
  // A weight between the sizes can only have come from the stepper, so it stays in view.
  const showExact = isExactOpen || !chosen;
  return (
    <View style={styles.main}>
      <View style={styles.row}>
        <Thumb service={service} />
        <View style={styles.words}>
          <Text style={styles.name} numberOfLines={2}>
            {service.name}
          </Text>
          <Text style={styles.meta}>
            {formatMoneyCompact(service.price)}
            {unitSuffix(service.unit)}
          </Text>
        </View>
        {mainAmount !== undefined ? <Text style={styles.amount}>{formatMoney(mainAmount)}</Text> : null}
      </View>

      {/* One question, answered from a short list — the way a ride app offers
          its car sizes: what it is in everyday words, how big, what it costs. */}
      <Text style={styles.ask}>How much laundry?</Text>
      <View style={styles.sizeList} accessibilityRole="radiogroup" accessibilityLabel="How much laundry">
        {sizes.map((size, rank) => {
          const isOn = chosen?.kg === size.kg;
          const price = priceFor(size.kg);
          return (
            <Pressable
              key={size.kg}
              accessibilityRole="radio"
              accessibilityState={{ checked: isOn }}
              accessibilityLabel={`${size.label}, ${size.hint}, up to ${size.kg} kilograms${price ? `, ${price}` : ''}`}
              onPress={() => {
                setIsExactOpen(false);
                onQuantity(size.kg);
              }}
              style={({ pressed }) => [styles.sizeRow, isOn && styles.sizeRowOn, pressed && styles.pressed]}
            >
              {/* One more basket per step, so the list reads small → big at a glance. */}
              <View style={[styles.sizeIcon, isOn && styles.sizeIconOn]}>
                {Array.from({ length: rank + 1 }, (_, index) => (
                  <Ionicons key={index} name="basket" size={12} color={isOn ? colors.onAccent : INK} />
                ))}
              </View>
              <View style={styles.words}>
                <Text style={styles.name}>
                  {size.label}
                  <Text style={styles.meta}>{`  up to ${size.kg} kg`}</Text>
                </Text>
                <Text style={styles.meta}>{size.hint}</Text>
              </View>
              {price ? <Text style={[styles.sizePrice, isOn && styles.inkOn]}>{price}</Text> : null}
              <Ionicons
                name={isOn ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={isOn ? INK : colors.borderStrong}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.reassure}>
        <Ionicons name="scale-outline" size={16} color={colors.subtle} />
        <Text style={styles.reassureText}>Best guess is fine — final price after weighing.</Text>
      </View>

      {/* For the few who did weigh it; out of the way for everyone else. */}
      {showExact ? (
        <View style={styles.pick}>
          <Text style={[styles.pickLabel, styles.words]}>Exact weight</Text>
          <Stepper
            label="kilograms"
            display={`${quantity} kg`}
            canLower={quantity - 1 >= floor}
            canRaise={clampWeight(quantity + 1) > quantity}
            onLower={() => onQuantity(clampWeight(Math.max(floor, quantity - 1)))}
            onRaise={() => onQuantity(clampWeight(quantity + 1))}
          />
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setIsExactOpen(true)} hitSlop={8}>
          <Text style={styles.link}>Know the exact weight?</Text>
        </Pressable>
      )}
      {notices.map((note) => (
        <Text key={note} style={styles.notice}>
          {note}
        </Text>
      ))}
      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
    </View>
  );
}

// ── a counted line in the basket ──────────────────────────────────────────

function LineRow({
  service,
  title,
  count,
  amount,
  onCount,
  min = 0,
}: {
  service: ServiceRow;
  title: string;
  count: number;
  amount: number | undefined;
  onCount: (next: number) => void;
  min?: number;
}) {
  return (
    <View style={[styles.row, styles.divided]}>
      <Thumb service={service} />
      <View style={styles.words}>
        <Text style={styles.name} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.meta}>
          {amount !== undefined && count > 0 ? formatMoney(amount) : formatMoneyCompact(service.price)}
        </Text>
      </View>
      <Stepper
        label={title}
        display={String(count)}
        canLower={count > min}
        canRaise={count < MAX_PIECES}
        onLower={() => onCount(count - 1)}
        onRaise={() => onCount(count + 1)}
      />
    </View>
  );
}

function Thumb({ service }: { service: ServiceRow }) {
  const tone = showcaseTone(service.category);
  const look = serviceLook(service.name, service.category);
  return (
    <View style={[styles.thumb, { backgroundColor: tone.field }]}>
      <ServiceScene scene={look.scene} colorway={look.colorway} brand={tone.bg} surface="white" />
    </View>
  );
}

function Stepper({
  label,
  display,
  canLower,
  canRaise,
  onLower,
  onRaise,
}: {
  label: string;
  display: string;
  canLower: boolean;
  canRaise: boolean;
  onLower: () => void;
  onRaise: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Round icon="remove" label={`Less ${label}`} isEnabled={canLower} onPress={onLower} />
      <Text style={styles.stepValue}>{display}</Text>
      <Round icon="add" label={`More ${label}`} isEnabled={canRaise} onPress={onRaise} isFilled />
    </View>
  );
}

function Round({
  icon,
  label,
  isEnabled = true,
  isFilled = false,
  onPress,
}: {
  icon: 'add' | 'remove' | 'checkmark';
  label: string;
  isEnabled?: boolean;
  isFilled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !isEnabled }}
      disabled={!isEnabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.round,
        isFilled ? styles.roundFilled : styles.roundOutline,
        !isEnabled && styles.off,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={16} color={isFilled ? colors.onAccent : INK} />
    </Pressable>
  );
}

// ── add more: one kind of tile for everything optional ────────────────────

function AddMore({ heavyExtras, counts, onCount, addons, picks, rules, onToggleAddon }: MarketBasketPageProps) {
  // The classic checkout's own drawings and dyes, so a piece looks the same in both.
  const looks = serviceLooks(heavyExtras);
  const cloths = extraCloths(heavyExtras, looks);
  return (
    <Card title="Add more">
      {heavyExtras.length > 0 ? (
        <Rail title="Big items">
          {heavyExtras.map((row) => {
            const count = counts[row.id] ?? 0;
            const look = looks.get(row.id) ?? serviceLook(row.name, row.category);
            const tone = showcaseTone(row.category);
            return (
              <Tile
                key={row.id}
                name={row.name}
                price={`${formatMoneyCompact(row.price)}${row.unit === 'per_kg' ? '/kg' : ''}`}
                count={count}
                picture={
                  <View style={[styles.tileArt, { backgroundColor: tone.field }]}>
                    <HeavyItemArt extra={row} look={look} cloth={cloths.get(row.id) ?? null} />
                  </View>
                }
                onAdd={() => onCount(row.id, Math.min(MAX_PIECES, count + 1))}
                onRemove={() => onCount(row.id, count - 1)}
              />
            );
          })}
        </Rail>
      ) : null}
      {groupAddons(addons).map((group) => (
        <Rail key={group.kind} title={RAIL_TITLES[group.kind]} note={allowsMultiple(group.kind, rules) ? null : 'pick one'}>
          {group.addons.map((addon) => {
            const isOn = (picks[addon.id] ?? 0) > 0;
            return (
              <Tile
                key={addon.id}
                name={addon.name}
                price={addon.price > 0 ? `+${formatMoneyCompact(addon.price)}` : 'Free'}
                count={isOn ? 1 : 0}
                isToggle
                picture={
                  <View style={styles.tileArt}>
                    <AddonPicture addon={addon} />
                  </View>
                }
                onAdd={() => onToggleAddon(addon)}
                onRemove={() => onToggleAddon(addon)}
              />
            );
          })}
        </Rail>
      ))}
    </Card>
  );
}

function Rail({ title, note, children }: { title: string; note?: string | null; children: React.ReactNode }) {
  return (
    <View style={styles.rail}>
      <Text style={styles.railTitle}>
        {title}
        {note ? <Text style={styles.railNote}>{`  ${note}`}</Text> : null}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railRow}>
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * One optional thing. Tapping the tile adds it (or, for soap and fabcon,
 * flips it); once it is in, the tile takes the brand outline, and a count
 * with a − appears for taking it back out.
 */
function Tile({
  name,
  price,
  count,
  picture,
  onAdd,
  onRemove,
  isToggle = false,
}: {
  name: string;
  price: string;
  count: number;
  picture: React.ReactNode;
  onAdd: () => void;
  onRemove: () => void;
  /** Soap and fabcon: in or out, one each. */
  isToggle?: boolean;
}) {
  const isIn = count > 0;
  return (
    <View style={[styles.tile, isIn && styles.tileIn]}>
      <Pressable
        accessibilityRole={isToggle ? 'checkbox' : 'button'}
        accessibilityState={isToggle ? { checked: isIn } : undefined}
        accessibilityLabel={`${name}, ${price}${isIn && !isToggle ? `, ${count} added` : ''}`}
        onPress={onAdd}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {picture}
        <Text style={styles.tileName} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.tilePrice}>{price}</Text>
      </Pressable>
      <View style={styles.tileCorner}>
        {isIn && !isToggle ? (
          <View style={styles.tileStepper}>
            <Round icon="remove" label={`Remove one ${name}`} onPress={onRemove} />
            <Text style={styles.tileCount}>{count}</Text>
          </View>
        ) : null}
        <Round
          icon={isIn && isToggle ? 'checkmark' : 'add'}
          label={isIn && isToggle ? `Remove ${name}` : `Add ${name}`}
          onPress={isIn && isToggle ? onRemove : onAdd}
          isFilled
        />
      </View>
    </View>
  );
}

// ── notes, folded ─────────────────────────────────────────────────────────

function Notes({ washSummary, washNotes, washProblem }: MarketBasketPageProps) {
  const [isOpen, setIsOpen] = useState(Boolean(washProblem));
  const open = isOpen || Boolean(washProblem);
  return (
    <View style={[styles.card, elevation.rest, washProblem ? styles.cardProblem : null]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Notes, optional. ${washSummary}`}
        onPress={() => setIsOpen((was) => !was)}
        style={styles.row}
      >
        <View style={styles.words}>
          <Text style={styles.cardTitle}>Notes</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {washSummary}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.subtle} />
      </Pressable>
      {open ? washNotes : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: RADII.card,
    padding: space.room,
    gap: space.cosy,
  },
  cardProblem: { borderWidth: 1, borderColor: colors.dangerInk },
  cardTitle: { ...type.section, color: colors.text },
  problem: { ...type.caption, color: colors.dangerInk },
  notice: { ...type.caption, color: colors.moneyOut },
  pressed: { opacity: 0.75 },
  off: { opacity: 0.35 },

  main: { gap: space.cosy },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  divided: { paddingTop: space.cosy, borderTopWidth: 1, borderTopColor: colors.border },
  thumb: { width: 52, height: 52, borderRadius: RADII.control, padding: 4, overflow: 'hidden' },
  words: { flex: 1, gap: 2 },
  name: { ...type.label, color: colors.text },
  meta: { ...type.caption, color: colors.subtle },
  amount: { ...type.label, fontSize: 16, color: colors.text },

  ask: { ...type.label, color: colors.text, marginTop: space.tight },
  sizeList: { gap: space.snug },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.cosy,
    borderRadius: RADII.control,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  sizeRowOn: { borderColor: INK, backgroundColor: colors.actionSurface },
  sizeIcon: {
    width: 40,
    height: 40,
    borderRadius: RADII.chip,
    backgroundColor: colors.actionSurface,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  sizeIconOn: { backgroundColor: INK },
  sizePrice: { ...type.label, color: colors.text },
  inkOn: { color: INK },
  reassure: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  reassureText: { ...type.caption, color: colors.subtle, flex: 1 },
  link: { ...type.label, color: INK },

  pick: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  pickLabel: { ...type.label, color: colors.text },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  stepValue: { ...type.label, color: colors.text, minWidth: 40, textAlign: 'center' },
  round: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  roundFilled: { backgroundColor: INK },
  roundOutline: { borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.card },

  rail: { gap: space.snug },
  railTitle: { ...type.label, color: colors.text },
  railNote: { ...type.caption, color: colors.subtle },
  railRow: { gap: space.snug, paddingRight: space.room },
  tile: {
    width: 118,
    borderRadius: RADII.control,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 6,
    paddingBottom: 44,
    backgroundColor: colors.card,
  },
  tileIn: { borderColor: INK, backgroundColor: colors.actionSurface },
  tileArt: { width: '100%', height: 84, borderRadius: RADII.chip, overflow: 'hidden', padding: 2 },
  tileName: { ...type.caption, color: colors.text, fontWeight: '600', marginTop: space.snug, minHeight: 32 },
  tilePrice: { ...type.caption, color: INK, fontWeight: '700' },
  tileCorner: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tileStepper: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 'auto' },
  tileCount: { ...type.label, color: colors.text, minWidth: 18, textAlign: 'center' },
});
