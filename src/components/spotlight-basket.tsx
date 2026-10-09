/**
 * The spotlight's basket: what the customer picked, one service at a time,
 * the way a food app shows the burger before it goes in the cart.
 *
 * A band of the shop's colour carries each picked service as a product shot,
 * swiped through like a carousel; the white card under it rises over the
 * photo's foot and says what that service is, what it costs, and how many.
 * Under that, the whole basket as a list, so nothing is hidden behind a
 * swipe; at the foot, the count for the service on show and the one button
 * that goes to checkout with the basket's total on it.
 *
 * Presentational: the basket rules are `domain/market-cart`, the screen
 * holds the basket (`use-market-cart`), and checkout is the market's.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ServicePhoto } from './service-photo';
import { ACCENTS, RADII, colors, elevation, formatMoney, space, type } from './ui-kit';
import { isLoad, lineEstimate, type CartLine } from '@/lib/domain/market-cart';
import { showcaseBlurb, showcaseTitle } from '@/lib/domain/service-showcase';
import { spotlightPrice, type ServiceFrame, type SpotlightService } from '@/lib/domain/spotlight';
import type { Reputation } from '@/lib/domain/storefront';

type Accent = (typeof ACCENTS)[number];

/** The bar over the photo: close and the basket's name. */
const BAR_HEIGHT = 56;
const PHOTO_HEIGHT = 240;
/** How far the white card rises over the photo's foot. */
const OVERLAP = 76;
const BAND_HEIGHT = BAR_HEIGHT + PHOTO_HEIGHT - OVERLAP;
const STAR_GOLD = '#E0A100';

interface SpotlightBasketProps<T extends SpotlightService> {
  isOpen: boolean;
  lines: readonly CartLine<T>[];
  frames: ReadonlyMap<string, ServiceFrame>;
  accent: Accent;
  shopName: string;
  reputation: Reputation | null;
  /** The basket's price as the booking opens on it; null while it cannot be priced. */
  total: number | null;
  /** A load is priced at its smallest size, so the total is a "from". */
  isFromPrice: boolean;
  /** Why checkout is closed — a paused shop, say; absent when it is open. */
  blockedNote?: string | null;
  onAdd: (service: T) => void;
  onRemove: (serviceId: string) => void;
  onCheckout: () => void;
  onClose: () => void;
}

export function SpotlightBasket<T extends SpotlightService>(props: SpotlightBasketProps<T>) {
  const { isOpen, onClose } = props;
  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close basket" onPress={onClose} />
        {isOpen ? <BasketBody {...props} /> : null}
      </View>
    </Modal>
  );
}

function BasketBody<T extends SpotlightService>({
  lines,
  frames,
  accent,
  shopName,
  reputation,
  total,
  isFromPrice,
  blockedNote,
  onAdd,
  onRemove,
  onCheckout,
  onClose,
}: SpotlightBasketProps<T>) {
  const insets = useSafeAreaInsets();
  const pager = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  // A line counted down to nothing leaves the list; stay on the last one.
  const index = Math.min(page, Math.max(0, lines.length - 1));
  const current = lines[index];
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  // The page a dot or a row asked for while the pager glides there; the
  // pages it passes on the way must not flash through the card.
  const jumpingTo = useRef<number | null>(null);

  // Taking the last piece of the last line leaves the pager past its new
  // end; step it back first so the photo and the card stay on one line.
  const removeOne = (line: CartLine<T>) => {
    const isLeavingLast = line.quantity === 1 && index === lines.length - 1 && index > 0;
    if (isLeavingLast) {
      jumpingTo.current = null;
      setPage(index - 1);
      pager.current?.scrollTo({ x: (index - 1) * width, animated: false });
    }
    onRemove(line.service.id);
  };

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const at = Math.round(event.nativeEvent.contentOffset.x / width);
    if (jumpingTo.current !== null) {
      if (at === jumpingTo.current) jumpingTo.current = null;
      return;
    }
    setPage(at);
  };
  const show = (next: number) => {
    jumpingTo.current = next;
    setPage(next);
    pager.current?.scrollTo({ x: next * width, animated: true });
  };

  return (
    <View style={[styles.sheet, { backgroundColor: accent.ink }]} onLayout={onLayout} accessibilityViewIsModal>
      <View style={styles.band}>
        <View style={styles.glow} />
        <View style={styles.bar}>
          <Text style={styles.barTitle} accessibilityRole="header">
            Your basket · {count} {count === 1 ? 'item' : 'items'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close basket"
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          jumpingTo.current = null;
        }}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {width > 0
          ? lines.map((line) => (
              <View key={line.service.id} style={[styles.page, { width }]}>
                <BasketPhoto frame={frames.get(line.service.id)} />
              </View>
            ))
          : null}
      </ScrollView>

      <View style={styles.card}>
        {current ? (
          <ScrollView contentContainerStyle={styles.cardScroll} showsVerticalScrollIndicator={false}>
            <Dots total={lines.length} index={index} accent={accent} onShow={show} />
            <LineDetail line={current} accent={accent} shopName={shopName} reputation={reputation} />
            {lines.length > 1 ? (
              <BasketList lines={lines} frames={frames} index={index} accent={accent} onShow={show} />
            ) : null}
          </ScrollView>
        ) : (
          <Text style={styles.empty}>Your basket is empty.</Text>
        )}

        {current ? (
          <View style={[styles.foot, { paddingBottom: insets.bottom + space.room }]}>
            {blockedNote ? <Text style={styles.blocked}>{blockedNote}</Text> : null}
            <View style={styles.footRow}>
              <Stepper
                line={current}
                accent={accent}
                onAdd={() => onAdd(current.service)}
                onRemove={() => removeOne(current)}
              />
              <CheckoutButton
                total={total}
                isFromPrice={isFromPrice}
                accent={accent}
                isBlocked={Boolean(blockedNote)}
                onPress={onCheckout}
              />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The product shot, whole: a cut-out stands free, a shop's own photo sits in a frame. */
function BasketPhoto({ frame }: { frame: ServiceFrame | undefined }) {
  if (!frame) return null;
  return (
    <ServicePhoto
      photo={frame.photo}
      uri={frame.imageUrl}
      style={[styles.photo, frame.imageUrl ? [styles.photoFramed, elevation.lift] : null]}
    />
  );
}

function Dots({
  total,
  index,
  accent,
  onShow,
}: {
  total: number;
  index: number;
  accent: Accent;
  onShow: (next: number) => void;
}) {
  if (total < 2) return null;
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, dot) => (
        <Pressable
          key={dot}
          accessibilityRole="button"
          accessibilityLabel={`Show item ${dot + 1} of ${total}`}
          onPress={() => onShow(dot)}
          hitSlop={6}
          style={[
            styles.dot,
            dot === index ? { width: 22, backgroundColor: accent.ink } : { backgroundColor: colors.border },
          ]}
        />
      ))}
    </View>
  );
}

function LineDetail({
  line,
  accent,
  shopName,
  reputation,
}: {
  line: CartLine<SpotlightService>;
  accent: Accent;
  shopName: string;
  reputation: Reputation | null;
}) {
  const { service, quantity } = line;
  const amount = lineEstimate(line);
  const { figure, unit } = spotlightPrice(service);
  const isALoad = isLoad(service);

  return (
    <View style={styles.detail}>
      <View style={styles.headRow}>
        <View style={styles.headWords}>
          <View style={styles.shopRow}>
            <Text style={styles.shopName} numberOfLines={1}>
              {shopName}
            </Text>
            <Stars reputation={reputation} />
          </View>
          <Text style={styles.title}>{showcaseTitle(service.name)}</Text>
        </View>
        {amount !== null ? (
          <View style={styles.amount}>
            {isALoad ? <Text style={styles.from}>from</Text> : null}
            <Text style={[styles.amountText, { color: accent.ink }]}>{formatMoney(amount)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.blurb}>{showcaseBlurb(service)}</Text>

      <Fact label="Rate" value={`${figure}${unit}`} />
      <Fact
        label={isALoad ? 'Load size' : 'Quantity'}
        value={isALoad ? 'Picked at checkout' : `${quantity} ${quantity === 1 ? 'piece' : 'pieces'}`}
      />
    </View>
  );
}

function Stars({ reputation }: { reputation: Reputation | null }) {
  if (!reputation) return <Text style={styles.newShop}>New shop</Text>;
  const filled = Math.round(reputation.average);
  return (
    <View style={styles.stars} accessible accessibilityLabel={`Rated ${reputation.average.toFixed(1)} of 5`}>
      {Array.from({ length: 5 }, (_, star) => (
        <Ionicons key={star} name={star < filled ? 'star' : 'star-outline'} size={12} color={STAR_GOLD} />
      ))}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.fact}>
      <Text style={styles.factLabel}>{label}: </Text>
      {value}
    </Text>
  );
}

function BasketList({
  lines,
  frames,
  index,
  accent,
  onShow,
}: {
  lines: readonly CartLine<SpotlightService>[];
  frames: ReadonlyMap<string, ServiceFrame>;
  index: number;
  accent: Accent;
  onShow: (next: number) => void;
}) {
  return (
    <View style={styles.list}>
      <Text style={styles.listTitle}>Everything in your basket</Text>
      {lines.map((line, row) => {
        const frame = frames.get(line.service.id);
        const amount = lineEstimate(line);
        const isShown = row === index;
        const rowPrice = amount === null ? '' : `${isLoad(line.service) ? 'from ' : ''}${formatMoney(amount)}`;
        return (
          <Pressable
            key={line.service.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isShown }}
            accessibilityLabel={`${line.service.name}, ${isLoad(line.service) ? '1 load' : `${line.quantity} ×`}`}
            onPress={() => onShow(row)}
            style={({ pressed }) => [
              styles.row,
              isShown && { backgroundColor: accent.surface },
              pressed && styles.pressed,
            ]}
          >
            {frame ? (
              <ServicePhoto
                photo={frame.photo}
                uri={frame.imageUrl}
                inset={4}
                style={[styles.thumb, { backgroundColor: isShown ? colors.card : accent.surface }]}
              />
            ) : null}
            <Text style={styles.rowName} numberOfLines={1}>
              {showcaseTitle(line.service.name)}
            </Text>
            <Text style={styles.rowQty}>{isLoad(line.service) ? '1 load' : `×${line.quantity}`}</Text>
            <Text style={styles.rowAmount}>{rowPrice}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** − count +, as in the picture: an outlined minus, a filled plus; a load stops at one. */
function Stepper({
  line,
  accent,
  onAdd,
  onRemove,
}: {
  line: CartLine<SpotlightService>;
  accent: Accent;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { service, quantity } = line;
  const isALoad = isLoad(service);
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={quantity === 1 ? `Remove ${service.name}` : `Remove one ${service.name}`}
        onPress={onRemove}
        hitSlop={6}
        style={({ pressed }) => [styles.step, { borderColor: accent.ink }, pressed && styles.pressed]}
      >
        <Ionicons name={quantity === 1 ? 'trash-outline' : 'remove'} size={16} color={accent.ink} />
      </Pressable>
      <Text style={styles.stepCount}>{isALoad ? '1' : quantity}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add one more ${service.name}`}
        accessibilityState={{ disabled: isALoad }}
        disabled={isALoad}
        onPress={onAdd}
        hitSlop={6}
        style={({ pressed }) => [
          styles.step,
          { borderColor: accent.ink, backgroundColor: accent.ink },
          isALoad && styles.stepOff,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="add" size={18} color={colors.onAccent} />
      </Pressable>
    </View>
  );
}

function CheckoutButton({
  total,
  isFromPrice,
  accent,
  isBlocked,
  onPress,
}: {
  total: number | null;
  isFromPrice: boolean;
  accent: Accent;
  isBlocked: boolean;
  onPress: () => void;
}) {
  const price = total === null ? '' : ` (${isFromPrice ? 'from ' : ''}${formatMoney(total)})`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Checkout${price}`}
      accessibilityState={{ disabled: isBlocked }}
      disabled={isBlocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.checkout,
        { backgroundColor: isBlocked ? colors.borderStrong : accent.ink },
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.checkoutText} numberOfLines={1}>
        Checkout{price}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,16,26,0.55)' },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    height: '92%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  band: { height: BAND_HEIGHT },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: BAR_HEIGHT - 30,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.room,
  },
  barTitle: { ...type.label, color: colors.onAccent },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  pager: { position: 'absolute', top: BAR_HEIGHT, left: 0, right: 0, height: PHOTO_HEIGHT, zIndex: 2 },
  page: { height: PHOTO_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  photo: { width: 300, height: PHOTO_HEIGHT - space.snug },
  photoFramed: { borderRadius: RADII.card, backgroundColor: colors.card },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  cardScroll: { paddingTop: OVERLAP + space.snug, paddingHorizontal: space.room, paddingBottom: space.room, gap: space.room },
  empty: { ...type.body, color: colors.subtle, textAlign: 'center', marginTop: OVERLAP + space.gulf },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  detail: { gap: space.snug },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.cosy },
  headWords: { flex: 1, gap: space.tight },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  shopName: { ...type.caption, color: colors.subtle, flexShrink: 1 },
  stars: { flexDirection: 'row', gap: 1 },
  newShop: { ...type.caption, color: colors.subtle },
  title: { ...type.title, color: colors.text },
  amount: { alignItems: 'flex-end' },
  from: { ...type.caption, color: colors.subtle },
  amountText: { ...type.value },
  blurb: { ...type.body, color: colors.subtle },
  fact: { ...type.caption, color: colors.subtle },
  factLabel: { ...type.label, fontSize: 13, color: colors.text },
  list: { gap: space.tight },
  listTitle: { ...type.label, color: colors.text, marginBottom: space.tight },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.snug,
    borderRadius: RADII.control,
  },
  thumb: { width: 44, height: 44, borderRadius: RADII.chip },
  rowName: { ...type.label, color: colors.text, flex: 1 },
  rowQty: { ...type.caption, color: colors.subtle },
  rowAmount: { ...type.label, color: colors.text, minWidth: 72, textAlign: 'right' },
  foot: {
    paddingHorizontal: space.room,
    paddingTop: space.cosy,
    gap: space.snug,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  blocked: { ...type.caption, color: colors.subtle, textAlign: 'center' },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: space.room },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  step: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOff: { opacity: 0.35 },
  stepCount: { ...type.section, color: colors.text, minWidth: 18, textAlign: 'center' },
  checkout: {
    flex: 1,
    minHeight: 50,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.room,
  },
  checkoutText: { ...type.label, fontSize: 16, color: colors.onAccent },
});
