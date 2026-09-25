import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { AddressChips } from '@/components/address-book';
import { HeavyItems } from '@/components/heavy-items';
import { AddonShelf } from '@/components/addon-shelf';
import { PreferencePicker } from '@/components/laundry-preferences';
import { PieceCounter, WeightScale } from '@/components/quantity-picker';
import { Reveal } from '@/components/reveal';
import { BookingHero } from '@/components/booking-hero';
import { SlotCalendar } from '@/components/slot-calendar';
import { Odometer } from '@/components/odometer';
import { StepRail } from '@/components/step-rail';
import {
  Button,
  Card,
  ErrorText,
  Field,
  Loading,
  Screen,
  Subtle,
  colors,
  formatMoney,
  space,
  type,
} from '@/components/ui-kit';
import {
  getMyAddresses,
  getMyLaundryPreferences,
  getOrder,
  getServices,
  getShop,
  getShopAddonGroups,
  getShopAddons,
  placeOrder,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  defaultAddress,
  formatAddressLine,
  matchSavedAddress,
  type SavedAddress,
} from '@/lib/domain/customer-book';
import {
  MIN_BOOKING_WEIGHT_KG,
  deliveryHours,
  openHours,
  slotProblems,
  suggestSchedule,
  validateBookingLoad,
  validateDeliveryAddress,
} from '@/lib/domain/booking-validation';
import {
  formatBookingNotes,
  hasPreferences,
  NO_PREFERENCES,
  limitToSupported,
  preferenceLines,
  supportedPreferenceKeys,
  validatePreferences,
  type LaundryPreferences,
  type PreferenceKey,
} from '@/lib/domain/laundry-preferences';
import { rebookDraft, reconcileRebook, type RebookDraft } from '@/lib/domain/rebook';
import { questionsFor } from '@/lib/domain/service-questions';
import {
  addonPriceLabel,
  addonsTotal,
  groupAddons,
  selectedAddons,
  addonPayload,
  pickAddon,
  setAddonQuantity,
  type AddonGroupRules,
  type PickedAddon,
  type ShopAddon,
} from '@/lib/domain/shop-addons';
import {
  MAX_WEIGHT_KG,
  buildBookingItems,
  clampWeight,
  estimateBooking,
  type AddOnQuantities,
} from '@/lib/domain/booking-estimate';
import {
  describeCatalogProblem,
  friendlyBookingError,
  isConnectionError,
  type CatalogProblem,
} from '@/lib/domain/booking-error';
import {
  validateBookingSchedule,
  type BookingScheduleErrors,
} from '@/lib/domain/booking-schedule';
import { previousStep } from '@/lib/domain/step-rail';
import type { ServiceRow } from '@/lib/types';
import {
  formatPriceLine,
  formatQuantity,
  minimumChargeNotice,
} from '@/lib/domain/price-label';
import type { OrderEstimate } from '@/lib/domain/pricing';
import {
  BOOKING_WINDOW_DAYS,
  keepDeliveryAfterPickup,
  slotSummary,
  turnaroundLabel,
  turnaroundNote,
  type Slot,
} from '@/lib/domain/booking-slot';
import type { Fulfillment } from '@/lib/domain/walk-in-order';

const QUICK_WEIGHTS_KG = [3, 5, 8, 12];
const DAY_MS = 24 * 60 * 60 * 1000;

/** A concrete Date from "N days from today at H o'clock". */
function slotDate(dayOffset: number, hour: number): Date {
  const date = new Date(Date.now() + dayOffset * DAY_MS);
  date.setHours(hour, 0, 0, 0);
  return date;
}

type SlotValue = Slot;
type LegName = 'pickup' | 'deliver';
type Step = 'items' | 'schedule' | 'review';

/**
 * The three questions, in the order a counter asks them. Declared once so the
 * rail, the Back button and the footer all count the same steps.
 */
const BOOKING_STEPS = [
  { key: 'items', label: 'Items' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'review', label: 'Review' },
] as const satisfies readonly { key: Step; label: string }[];

/**
 * One leg of the schedule: a settled answer you can open if it is wrong.
 *
 * Both legs used to stand open at once — four day chips and six hour chips,
 * twice, twenty chips on a step whose defaults were already right for most
 * bookings. The customer read a wall to confirm something they agreed with.
 *
 * Now each leg is a single line that states its own answer, and the chips sit
 * behind it. Only one leg opens at a time, so the most that can ever be on
 * screen is ten chips belonging to one question.
 */
function ScheduleLeg({
  label,
  icon,
  value,
  minOffset,
  openHours: hoursOnOffer,
  isOpen,
  onToggle,
  onChange,
}: {
  label: string;
  icon: string;
  value: SlotValue;
  /** Earliest day this leg offers. Delivery counts from pickup, not today. */
  minOffset: number;
  /** The hours still bookable on the chosen day; the rest are drawn but shut. */
  openHours: readonly number[];
  isOpen: boolean;
  onToggle: () => void;
  onChange: (next: SlotValue) => void;
}) {
  const now = new Date();
  const summary = slotSummary(value, now);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        // Two texts on screen, one fact when spoken.
        accessibilityLabel={`${label}: ${summary}`}
        accessibilityHint={
          isOpen ? 'Closes the day and time choices' : 'Opens the day and time choices'
        }
        onPress={onToggle}
        style={[styles.legRow, isOpen && styles.legRowOpen]}
      >
        <Ionicons name={icon as never} size={18} color={colors.actionInk} />
        <Text style={styles.legLabel}>{label}</Text>
        <Text style={styles.legValue}>{summary}</Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.subtle}
        />
      </Pressable>

      {isOpen && (
        <Reveal style={styles.legPanel}>
          {/* The row above already names this leg and states its answer, so
              the picker does not say either a second time. */}
          <SlotCalendar
            label={label}
            value={value}
            onChange={onChange}
            minOffset={minOffset}
            maxOffset={minOffset + BOOKING_WINDOW_DAYS}
            now={now}
            showHeading={false}
            framed={false}
            openHours={hoursOnOffer}
          />
        </Reveal>
      )}
    </View>
  );
}

function Chip({
  label,
  isSelected,
  onPress,
  style,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={[styles.chip, isSelected && styles.chipSelected, style]}
    >
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The one screen a customer sees when booking cannot start. Each cause carries
 * its own sentence, and only a recoverable one offers a retry.
 */
function BookingProblem({
  problem,
  onRetry,
  onBack,
  onOpenShop,
}: {
  problem: CatalogProblem;
  onRetry: () => void;
  onBack: () => void;
  /** Offered when the shop is open but this service is not: pick another. */
  onOpenShop?: () => void;
}) {
  return (
    <Screen>
      <Card>
        <Text style={styles.sectionTitle}>{problem.title}</Text>
        <Subtle>{problem.body}</Subtle>
      </Card>
      {problem.canRetry && <Button title="Try again" onPress={onRetry} />}
      {onOpenShop && <Button title="See the shop's services" onPress={onOpenShop} />}
      <Button title="Go back" variant="outline" onPress={onBack} />
    </Screen>
  );
}

/** One settled fact on the review: what it is called, and what it says. */
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

/**
 * The figure, or a dash. Nothing chosen is not "₱0.00": a zero set as the
 * loudest thing on the screen reads as a fault, not as a prompt.
 */
function priceAmount(estimate: OrderEstimate | null, hasSelection: boolean): string {
  if (estimate && hasSelection) return formatMoney(estimate.total);
  return '—';
}

/**
 * The one line under the figure. It advances with the step rather than
 * repeating: the schedule step used to restate the estimate step's sentence
 * word for word, directly below a card that said it a third time.
 */
function priceNote(
  estimate: OrderEstimate | null,
  hasSelection: boolean,
  step: Step,
  /** What settles the price for this service: the scale, a count, or nothing. */
  finalPriceNote: string
): string {
  if (estimate) {
    // The payment methods are a fact you need once, at the last tap. Naming
    // them on the schedule step spent two lines on something the customer
    // cannot act on yet, directly under the loudest figure on the screen.
    if (step === 'review') return 'Pay once the shop confirms the price — cash, GCash, Maya, or bank.';
    return finalPriceNote;
  }
  if (hasSelection) {
    return "This shop's price list may have just changed — pick your items again.";
  }
  return 'Set how much you have and the price appears here.';
}

/**
 * The running total, the left half of the buy bar pinned under the page. One
 * shape across all three steps: the figure keeps a fixed home so the layout
 * never jumps, and an unpriceable selection reads as unknown rather than as
 * free.
 *
 * It sits beside the button rather than over it, the way a shop's checkout
 * bar does. The old footer stacked a 34pt figure, its note and two buttons,
 * and took a third of the screen from the products it was pricing.
 */
function PriceSummary({
  estimate,
  hasSelection,
  step,
  finalPriceNote,
}: {
  estimate: OrderEstimate | null;
  hasSelection: boolean;
  step: Step;
  finalPriceNote: string;
}) {
  return (
    <View style={styles.priceBlock}>
      <Text style={styles.priceLabel}>Estimated total</Text>
      {/* An em dash is not a number and has no wheels to turn, so the
          unpriceable case stays plain text. */}
      {estimate && hasSelection ? (
        <Odometer
          value={priceAmount(estimate, hasSelection)}
          style={styles.priceValue}
          label={`Estimated total ${priceAmount(estimate, hasSelection)}`}
        />
      ) : (
        <Text style={[styles.priceValue, styles.priceValueMuted]}>
          {priceAmount(estimate, hasSelection)}
        </Text>
      )}
      <Text style={styles.priceNote} numberOfLines={2}>
        {priceNote(estimate, hasSelection, step, finalPriceNote)}
      </Text>
    </View>
  );
}

/** What went in the cart from the shop's shelf, already in the total. */
function CartLine({ addons, extra }: { addons: readonly PickedAddon[]; extra: number }) {
  if (addons.length === 0) return null;
  const count = addons.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <View style={styles.cartLine}>
      <Ionicons name="bag-add-outline" size={16} color={colors.actionInk} />
      <Text style={styles.cartText} numberOfLines={1}>
        {count} add-on{count === 1 ? '' : 's'} ·{' '}
        {addons
          .map(({ addon, quantity }) => (quantity > 1 ? `${addon.name} ×${quantity}` : addon.name))
          .join(', ')}
      </Text>
      <Text style={styles.cartAmount}>{addonPriceLabel(extra)}</Text>
    </View>
  );
}

/** A small "Change" link in the corner of a review card: back to the step that asked. */
function EditLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [styles.editLink, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.editLinkText}>Change</Text>
    </Pressable>
  );
}

/** A day's hour kept when it is still on offer, else the next one that is. */
function snapToOpen(slot: SlotValue, hours: readonly number[]): SlotValue {
  if (hours.length === 0 || hours.includes(slot.hour)) return slot;
  return { ...slot, hour: hours.find((hour) => hour > slot.hour) ?? hours[0] };
}

/** What the booking opens with: last time's order, or the customer's usual. */
interface BookingSeed {
  step: Step;
  weightKg: number;
  addOns: AddOnQuantities;
  fulfillment: Fulfillment;
  /** Null: take the default saved address. */
  address: string | null;
  /** Null: take the rider instructions saved with the address. */
  riderNotes: string | null;
  preferences: LaundryPreferences;
  pickup: SlotValue;
  deliver: SlotValue;
  /** Set on "Book again": what last time had that the shop no longer offers. */
  rebook: { droppedNames: string[] } | null;
}

/** Only reached when no rider slot is open in the whole window. */
const FALLBACK_SCHEDULE = {
  pickup: { dayOffset: 1, hour: 10 },
  deliver: { dayOffset: 2, hour: 10 },
};

function seedBooking(input: {
  draft: RebookDraft | null;
  droppedNames: string[];
  previousPickupAt: string | null;
  usual: LaundryPreferences;
  supported: readonly PreferenceKey[];
  service: ServiceRow;
  services: readonly ServiceRow[];
  now: Date;
}): BookingSeed {
  const { draft, service, services, now } = input;
  const previousHour = input.previousPickupAt
    ? new Date(input.previousPickupAt).getHours()
    : undefined;
  const schedule = suggestSchedule(now, previousHour) ?? FALLBACK_SCHEDULE;
  const base = {
    preferences: limitToSupported(draft?.preferences ?? input.usual, input.supported),
    pickup: schedule.pickup,
    deliver: schedule.deliver,
  };

  if (!draft) {
    return {
      ...base,
      step: 'items',
      // The smallest load the shop takes, not zero: a scale that opens on a
      // weight nobody can book starts the customer on an error.
      weightKg:
        service.unit === 'per_kg'
          ? Math.max(MIN_BOOKING_WEIGHT_KG, service.min_quantity || 0)
          : 1,
      addOns: {},
      fulfillment: 'delivery',
      address: null,
      riderNotes: null,
      rebook: null,
    };
  }

  const loadProblem = validateBookingLoad({
    service,
    quantity: draft.weightKg,
    addOns: draft.addOns,
    catalog: services,
  });
  const addressProblem =
    draft.fulfillment === 'delivery' ? validateDeliveryAddress(draft.deliveryAddress) : null;

  return {
    ...base,
    // Straight to the review when last time still holds — that is the whole
    // point of booking again — and otherwise to the first step that needs an
    // answer, so nothing is placed on a guess.
    step: loadProblem ? 'items' : addressProblem ? 'schedule' : 'review',
    weightKg: draft.weightKg,
    addOns: draft.addOns,
    fulfillment: draft.fulfillment,
    address: draft.deliveryAddress || null,
    riderNotes: draft.riderNotes,
    rebook: { droppedNames: input.droppedNames },
  };
}

/**
 * Everything a booking needs before its first frame: the price list, whether
 * the shop is still open for bookings, and — on "Book again" — the order being
 * repeated. The flow below is keyed and seeded from these once, so nothing
 * has to be written into its fields by an effect racing the customer's thumb.
 */
export default function BookService() {
  const { serviceId, shopId, rebook } = useLocalSearchParams<{
    serviceId: string;
    shopId: string;
    rebook?: string;
  }>();
  const router = useRouter();

  const catalog = useQuery({
    queryKey: ['services', shopId],
    queryFn: () => getServices(shopId!),
    enabled: Boolean(shopId),
  });
  // Customers can only read active shops, so a shop switched off answers with
  // no row at all — which is exactly the "not taking bookings" case.
  const shop = useQuery({
    queryKey: ['shop', shopId],
    queryFn: () => getShop(shopId!),
    enabled: Boolean(shopId),
    retry: false,
  });
  const previous = useQuery({
    queryKey: ['order', rebook],
    queryFn: () => getOrder(rebook!),
    enabled: Boolean(rebook),
  });

  // The customer's usual wash. A failure here only costs the prefill, so it
  // is not a reason to block the booking.
  const usual = useQuery({
    queryKey: ['my-laundry-preferences'],
    queryFn: getMyLaundryPreferences,
    retry: false,
  });

  // The shop's priced add-ons. Failing to load them costs the shelf, not the
  // booking: the free preference tiles stand in.
  const shelf = useQuery({
    queryKey: ['shop-addons', shopId],
    queryFn: () => getShopAddons(shopId!),
    enabled: Boolean(shopId),
    retry: false,
  });
  // Whether each kind is pick-one or pick-several at this shop. Failing to
  // load it falls back to the house rule; the server checks either way.
  const shelfRules = useQuery({
    queryKey: ['shop-addon-groups', shopId],
    queryFn: () => getShopAddonGroups(shopId!),
    enabled: Boolean(shopId),
    retry: false,
  });

  /**
   * Out of the booking, to the shop's menu. Nothing is saved until "Place
   * order", so a customer who changed their mind loses nothing by leaving —
   * and lands where they can pick another service instead of on Home. A
   * replace, not a back: under tabs, back goes to the first tab, not the shop.
   */
  const leave = React.useCallback(() => {
    if (shopId) router.replace(`/(customer)/shop/${shopId}` as never);
    else router.back();
  }, [router, shopId]);

  // The bar names who you are booking with, not what the screen is for, and
  // carries the way out on every step.
  const navigation = useNavigation();
  const shopName = shop.data?.name;
  useEffect(() => {
    navigation.setOptions({
      ...(shopName ? { title: shopName } : {}),
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave booking and go back to the shop"
          onPress={leave}
          hitSlop={10}
          style={({ pressed }) => [styles.headerBack, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, shopName, leave]);

  if (
    catalog.isLoading ||
    shop.isLoading ||
    previous.isLoading ||
    usual.isLoading ||
    shelf.isLoading ||
    shelfRules.isLoading
  ) {
    return <Loading />;
  }

  const draft = previous.data ? rebookDraft(previous.data) : null;
  const service = catalog.data?.find((row) => row.id === serviceId);
  const shopError = shop.error instanceof Error ? shop.error : null;
  const isShopUnreachable = Boolean(shopError && isConnectionError(shopError.message));

  const problem = describeCatalogProblem({
    hasShopId: Boolean(shopId),
    loadError: catalog.error ?? (isShopUnreachable ? shopError : null),
    isServiceFound: Boolean(service),
    isShopAvailable: shop.data
      ? shop.data.is_active
      : shopError && !isShopUnreachable
        ? false
        : undefined,
    rebookServiceName: draft?.itemNames[draft.serviceId],
    rebookLoadError: previous.error,
  });

  if (problem) {
    const canOpenShop = Boolean(shop.data?.is_active) && !problem.canRetry;
    return (
      <BookingProblem
        problem={problem}
        onRetry={() => {
          void catalog.refetch();
          void shop.refetch();
          if (rebook) void previous.refetch();
        }}
        onBack={() => router.back()}
        onOpenShop={
          canOpenShop ? () => router.replace(`/(customer)/shop/${shopId}` as never) : undefined
        }
      />
    );
  }

  // Unreachable: describeCatalogProblem always reports a missing service above.
  if (!service || !catalog.data || !shopId) return null;

  const reconciled = draft
    ? reconcileRebook(draft, catalog.data.map((row) => row.id))
    : null;
  const supported = supportedPreferenceKeys(shop.data?.supported_preferences);
  const seed = seedBooking({
    draft: reconciled?.draft ?? null,
    droppedNames: reconciled?.droppedNames ?? [],
    previousPickupAt: previous.data?.pickup_at ?? null,
    usual: usual.data ?? NO_PREFERENCES,
    supported,
    service,
    services: catalog.data,
    now: new Date(),
  });

  return (
    <BookingFlow
      key={`${serviceId}:${rebook ?? ''}`}
      shopId={shopId}
      service={service}
      services={catalog.data}
      supported={supported}
      seed={seed}
      shopAddons={shelf.data ?? []}
      addonRules={shelfRules.data ?? {}}
    />
  );
}

function BookingFlow({
  shopId,
  service,
  services,
  supported,
  seed,
  shopAddons,
  addonRules,
}: {
  shopId: string;
  service: ServiceRow;
  services: readonly ServiceRow[];
  supported: readonly PreferenceKey[];
  seed: BookingSeed;
  /** The shop's own priced soaps, fabcons and extras. Empty until it sets some up. */
  shopAddons: readonly ShopAddon[];
  /** The shop's pick-one or pick-several setting per kind. */
  addonRules: AddonGroupRules;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const serviceId = service.id;
  const isPerKg = service.unit === 'per_kg';

  const [step, setStep] = useState<Step>(seed.step);
  const [weightKg, setWeightKg] = useState(seed.weightKg);
  const [addOns, setAddOns] = useState<AddOnQuantities>(seed.addOns);
  const [preferences, setPreferences] = useState<LaundryPreferences>(seed.preferences);
  // Only the questions this kind of service needs: nobody pressing a shirt
  // should be asked which detergent to use. See `domain/service-questions`.
  const questions = questionsFor(service.category, service.unit);
  const relevantAddons = shopAddons.filter((addon) => questions.addonKinds.includes(addon.kind));
  const [addonPicks, setAddonPicks] = useState<Record<string, number>>({});
  const pickedAddons = selectedAddons(relevantAddons, addonPicks);
  const addonExtra = addonsTotal(relevantAddons, addonPicks);
  const addonCount = pickedAddons.reduce((sum, line) => sum + line.quantity, 0);
  // Soap and fabcon come off the shop's own priced shelf and nowhere else.
  // The free brand tiles used to stand in for a shop with no shelf, which let
  // a customer ask for a brand at no price the counter had never agreed to.
  // Every shop is stocked with a priced shelf now (migration 0030).
  const shelfKinds = new Set(groupAddons(relevantAddons).map((group) => group.kind));
  const preferenceKeys = supported.filter(
    (key) => questions.preferences.includes(key) && key !== 'detergent' && key !== 'softener'
  );
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [prefsError, setPrefsError] = useState('');

  const [fulfillment, setFulfillment] = useState<Fulfillment>(seed.fulfillment);
  /**
   * What the customer typed or picked, or null while they have done neither.
   *
   * Null rather than an empty string, so the saved default can be *derived*
   * below instead of written in by an effect: an effect that seeds a field
   * races the field, and the race is lost by whoever typed first.
   */
  const [typedAddress, setTypedAddress] = useState<string | null>(seed.address);
  const [typedRiderNotes, setTypedRiderNotes] = useState<string | null>(seed.riderNotes);

  const addresses = useQuery({ queryKey: ['my-addresses'], queryFn: getMyAddresses });
  const saved = useMemo(() => addresses.data ?? [], [addresses.data]);
  const usualAddress = defaultAddress(saved);
  const deliveryAddress =
    typedAddress ?? (usualAddress ? formatAddressLine(usualAddress) : '');
  const riderNotes =
    typedRiderNotes ?? matchSavedAddress(saved, deliveryAddress)?.notes ?? '';

  const [pickupSlot, setPickupSlot] = useState<SlotValue>(seed.pickup);
  const [deliverSlot, setDeliverSlot] = useState<SlotValue>(seed.deliver);
  /**
   * Which leg is open for editing. Delivery on a fresh booking, because "when
   * do I get it back" is the question the customer came to this step with.
   * None on "Book again": both legs already carry an answer that works.
   */
  const [openLeg, setOpenLeg] = useState<LegName | null>(seed.rebook ? null : 'deliver');
  const [fieldErrors, setFieldErrors] = useState<BookingScheduleErrors>({});

  /** Heavy/thick extras: the shop's bedding & heavy items, minus the main service. */
  const heavyExtras = questions.offersHeavyItems
    ? services.filter((row) => row.category === 'special_items' && row.id !== serviceId)
    : [];

  const estimate = useMemo(
    () => estimateBooking(services, serviceId, weightKg, addOns),
    [services, serviceId, weightKg, addOns]
  );

  /**
   * The booking said back as lines: what, how much of it, and what that costs.
   * Built from the same `buildBookingItems` the order is placed with, so the
   * review cannot quietly disagree with what is sent.
   */
  const reviewLines = useMemo(
    () =>
      buildBookingItems(serviceId, weightKg, addOns).map((item) => {
        const row = services.find((entry) => entry.id === item.serviceId);
        return {
          id: item.serviceId,
          name: row?.name ?? 'Item',
          meta: row ? `${formatQuantity(row.unit, item.quantity)} · ${formatPriceLine(row)}` : '',
          subtotal:
            estimate?.lines.find((line) => line.serviceId === item.serviceId)?.subtotal ?? null,
        };
      }),
    [services, serviceId, weightKg, addOns, estimate]
  );

  const mutation = useMutation({
    mutationFn: (schedule: {
      fulfillment: Fulfillment;
      deliveryAddress: string;
      pickupAt: Date | null;
      deliverBy: Date | null;
    }) =>
      placeOrder(
        shopId,
        buildBookingItems(serviceId, weightKg, addOns).map((item) => ({
          service_id: item.serviceId,
          quantity: item.quantity,
        })),
        {
          ...schedule,
          // Preferences and rider instructions ride on the order's notes: the
          // field every shop screen and printed ticket already shows.
          notes: formatBookingNotes({
            preferences: limitToSupported(preferences, preferenceKeys),
            riderNotes: schedule.fulfillment === 'delivery' ? riderNotes : '',
          }),
          // Ids only: the server prices them from the shop's own rows.
          addons: addonPayload(pickedAddons),
          // Booked with the method this customer always uses, so the pay screen
          // opens on their own answer instead of on the shop's default.
          ...(profile?.preferred_payment_method
            ? { paymentMethod: profile.preferred_payment_method }
            : {}),
        }
      ),
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      router.replace(`/(customer)/order/${order.id}`);
    },
    onError: (err: Error) => setError(friendlyBookingError(err.message)),
  });

  /** The load, checked against the smallest and largest booking a shop takes. */
  const checkItems = () => {
    const problem = validateBookingLoad({ service, quantity: weightKg, addOns, catalog: services });
    const prefs = validatePreferences(preferences);
    setLoadError(problem ?? '');
    setPrefsError(prefs.ok ? '' : prefs.errors.instructions ?? '');
    return !problem && prefs.ok;
  };

  /**
   * The schedule, checked. Returns null and opens the leg that is wrong — an
   * error under a closed row is an error nobody can act on.
   */
  const settledSchedule = () => {
    const now = new Date();
    const result = validateBookingSchedule(
      {
        fulfillment,
        deliveryAddress,
        pickupAt: slotDate(pickupSlot.dayOffset, pickupSlot.hour),
        deliverBy: slotDate(deliverSlot.dayOffset, deliverSlot.hour),
      },
      now
    );
    const slots = fulfillment === 'delivery' ? slotProblems(pickupSlot, deliverSlot, now) : {};
    const errors = { ...(result.ok ? {} : result.errors), ...slots };
    if (!result.ok || Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.pickupAt) setOpenLeg('pickup');
      else if (errors.deliverBy) setOpenLeg('deliver');
      return null;
    }
    setFieldErrors({});
    return result.value;
  };

  const goToSchedule = () => {
    setError('');
    if (checkItems()) setStep('schedule');
  };

  const goToReview = () => {
    setError('');
    if (settledSchedule()) setStep('review');
  };

  const handleBook = () => {
    setError('');
    // Checked again at the last tap: the rail lets a customer jump straight
    // here, and a schedule can go stale while the review sits open. Each
    // failure goes back to the step that can fix it.
    if (!checkItems()) {
      setStep('items');
      return;
    }
    const schedule = settledSchedule();
    if (!schedule) {
      setStep('schedule');
      return;
    }
    mutation.mutate(schedule);
  };

  const pickAddress = (pick: SavedAddress) => {
    setTypedAddress(formatAddressLine(pick));
    setTypedRiderNotes(pick.notes);
  };

  const now = new Date();
  const pickupHours = openHours(pickupSlot.dayOffset, now);
  const deliverHours = deliveryHours(deliverSlot.dayOffset, pickupSlot, now);

  const hasSelection = weightKg > 0 || Object.values(addOns).some((qty) => qty > 0);
  const mainMinimumNotice = minimumChargeNotice(service, weightKg);
  const chosenPreferences = limitToSupported(preferences, preferenceKeys);

  /** Where Back goes. Null on the first step, which is why it is not drawn. */
  const back = previousStep(BOOKING_STEPS, step);

  const footer = (
    <>
      <CartLine addons={pickedAddons} extra={addonExtra} />
      <ErrorText>{error}</ErrorText>
      <View style={styles.buyBar}>
        <PriceSummary
          estimate={estimate ? { ...estimate, total: estimate.total + addonExtra } : null}
          hasSelection={hasSelection}
          step={step}
          finalPriceNote={questions.finalPriceNote}
        />
        {/* The first step's way out is the header's back arrow, so the bar
            spends its room on the one action that moves the booking on. */}
        {back && (
          <View style={styles.backAction}>
            <Button title="Back" variant="outline" onPress={() => setStep(back)} />
          </View>
        )}
        <View style={styles.mainAction}>
          {step === 'review' ? (
            <Button
              title={mutation.isPending ? 'Placing…' : 'Place order'}
              disabled={mutation.isPending}
              onPress={handleBook}
            />
          ) : (
            <Button
              title="Continue"
              disabled={!hasSelection}
              onPress={step === 'items' ? goToSchedule : goToReview}
            />
          )}
        </View>
      </View>
    </>
  );

  return (
    <Screen footer={footer} isBottomBare>
      {/* Identity, not a decision — so it reads as a header, not as the first card. */}
      <View style={styles.header}>
        {/* Numbered and named, not two anonymous bars: a first-time customer
            needs to know how many questions are left and what they will ask,
            and that a question already answered is still theirs to change. */}
        <StepRail steps={BOOKING_STEPS} current={step} onGo={setStep} />
        <BookingHero service={service} quantity={weightKg} />
      </View>

      {step === 'items' && (
        <View style={styles.sections}>
          {/* The "scale": estimate how heavy the laundry is. */}
          <Card>
            <Text style={styles.sectionTitle}>
              {isPerKg ? 'How heavy is your laundry?' : 'How many pieces?'}
            </Text>
            {isPerKg ? (
              <>
                <WeightScale
                  valueKg={weightKg}
                  onChange={(kg) => {
                    setWeightKg(kg);
                    setLoadError('');
                  }}
                />
                <View style={styles.chipGrid}>
                  {QUICK_WEIGHTS_KG.map((kg) => (
                    <Chip
                      key={kg}
                      label={`${kg} kg`}
                      isSelected={weightKg === kg}
                      onPress={() => {
                        setWeightKg(clampWeight(kg));
                        setLoadError('');
                      }}
                      style={styles.quickChip}
                    />
                  ))}
                </View>
                <Subtle>
                  Drag the scale, or tap a size. A full laundry basket is around 5 kg —
                  {` ${MIN_BOOKING_WEIGHT_KG}–${MAX_WEIGHT_KG}`} kg per booking.
                </Subtle>
              </>
            ) : (
              <PieceCounter
                value={weightKg}
                onChange={(count) => {
                  setWeightKg(count);
                  setLoadError('');
                }}
                label={service.name}
              />
            )}
            {mainMinimumNotice && (
              <Text style={styles.noticeText}>{mainMinimumNotice}</Text>
            )}
            <ErrorText>{loadError}</ErrorText>
          </Card>

          <HeavyItems
            extras={heavyExtras}
            quantities={addOns}
            onChange={(id, next) => {
              setAddOns((prev) => ({ ...prev, [id]: next }));
              setLoadError('');
            }}
          />

          {/* The shop's own shelf, every product on the page at once. */}
          {shelfKinds.size > 0 && (
            <Card>
              <View style={styles.reviewHead}>
                <Text style={styles.sectionTitle}>Add-ons</Text>
                {addonCount > 0 && (
                  <Text style={styles.sectionMeta}>
                    {addonCount} added · {addonPriceLabel(addonExtra)}
                  </Text>
                )}
              </View>
              <AddonShelf
                addons={relevantAddons}
                picks={addonPicks}
                rules={addonRules}
                onToggle={(addon) =>
                  setAddonPicks((prev) => pickAddon(prev, addon, relevantAddons, addonRules))
                }
                onQuantity={(addon, quantity) =>
                  setAddonPicks((prev) => setAddonQuantity(prev, addon, quantity))
                }
              />
            </Card>
          )}

          {/* Only what this shop honours. The customer's usual arrives filled
              in; changing it here changes this load, not the usual. */}
          {preferenceKeys.length > 0 && (
            <Card>
              <Text style={styles.sectionTitle}>{questions.title}</Text>
              <PreferencePicker
                value={preferences}
                onChange={setPreferences}
                supported={preferenceKeys}
                error={prefsError}
                delicatesNote={questions.delicatesNote}
                instructionsExample={questions.instructionsExample}
              />
            </Card>
          )}
        </View>
      )}

      {step === 'schedule' && (
        <View style={styles.sections}>
          <Card>
            <Text style={styles.sectionTitle}>How will we get your laundry?</Text>
            <View style={styles.commitRow}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Pick up & deliver"
                  variant={fulfillment === 'delivery' ? 'primary' : 'outline'}
                  onPress={() => setFulfillment('delivery')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="I'll drop it off"
                  variant={fulfillment === 'pickup' ? 'primary' : 'outline'}
                  onPress={() => setFulfillment('pickup')}
                />
              </View>
            </View>

            {fulfillment === 'delivery' ? (
              <>
                {/* The places this customer has saved, over the field rather
                    than instead of it: somewhere new still has to be typeable. */}
                <AddressChips addresses={saved} value={deliveryAddress} onPick={pickAddress} />
                <Field
                  label="Pickup & delivery address"
                  value={deliveryAddress}
                  onChangeText={setTypedAddress}
                  placeholder="Unit 4B, 12 Mabini St, Quezon City"
                />
                <ErrorText>{fieldErrors.deliveryAddress}</ErrorText>
                <Field
                  label="Rider instructions (optional)"
                  value={riderNotes}
                  onChangeText={setTypedRiderNotes}
                  placeholder="Green gate, ring twice"
                />

                {/* Two settled rows, not two open pickers. The schedule already
                    has a good answer; this states it and gets out of the way. */}
                <View style={styles.legGroup}>
                  <ScheduleLeg
                    label="Pickup"
                    icon="arrow-up-circle-outline"
                    value={pickupSlot}
                    minOffset={0}
                    openHours={pickupHours}
                    isOpen={openLeg === 'pickup'}
                    onToggle={() =>
                      setOpenLeg((open) => (open === 'pickup' ? null : 'pickup'))
                    }
                    onChange={(next) => {
                      const pickup = snapToOpen(next, openHours(next.dayOffset, new Date()));
                      setPickupSlot(pickup);
                      setDeliverSlot((current) => keepDeliveryAfterPickup(current, pickup));
                    }}
                  />
                  <View style={styles.legSeam} />
                  <ScheduleLeg
                    label="Delivered back"
                    icon="arrow-down-circle-outline"
                    value={deliverSlot}
                    minOffset={pickupSlot.dayOffset}
                    openHours={deliverHours}
                    isOpen={openLeg === 'deliver'}
                    onToggle={() =>
                      setOpenLeg((open) => (open === 'deliver' ? null : 'deliver'))
                    }
                    onChange={(next) =>
                      setDeliverSlot(
                        snapToOpen(next, deliveryHours(next.dayOffset, pickupSlot, new Date()))
                      )
                    }
                  />
                </View>

                {/* The wait belongs to the pair, so it is said beneath the pair —
                    once, instead of as a note hanging off the second leg. */}
                <View style={styles.turnaroundRow}>
                  <Text style={styles.turnaroundLabel}>
                    {turnaroundLabel(pickupSlot, deliverSlot)}
                  </Text>
                  <Text style={styles.turnaroundNote}>
                    {turnaroundNote(pickupSlot, deliverSlot)}
                  </Text>
                </View>

                <ErrorText>{fieldErrors.pickupAt}</ErrorText>
                <ErrorText>{fieldErrors.deliverBy}</ErrorText>
              </>
            ) : (
              <Subtle>
                Bring your laundry to the shop and pick it up yourself once it&apos;s
                ready — no schedule needed.
              </Subtle>
            )}
          </Card>
        </View>
      )}

      {step === 'review' && (
        <View style={styles.sections}>
          {seed.rebook && (
            <View style={styles.rebookNote}>
              <Text style={styles.rebookTitle}>Same as last time</Text>
              <Text style={styles.rebookBody}>
                Change anything below before you place it.
              </Text>
              {seed.rebook.droppedNames.length > 0 && (
                <Text style={styles.noticeText}>
                  No longer offered, so left out: {seed.rebook.droppedNames.join(', ')}.
                </Text>
              )}
            </View>
          )}

          <Card>
            <View style={styles.reviewHead}>
              <Text style={styles.sectionTitle}>Your laundry</Text>
              <EditLink label="Change your laundry" onPress={() => setStep('items')} />
            </View>
            {reviewLines.map((line) => (
              <View key={line.id} style={styles.reviewLine}>
                <View style={styles.reviewLineText}>
                  <Text style={styles.reviewName}>{line.name}</Text>
                  <Text style={styles.reviewMeta}>{line.meta}</Text>
                </View>
                {/* An unpriceable line reads as unknown, never as free. */}
                <Text style={styles.reviewAmount}>
                  {line.subtotal === null ? '—' : formatMoney(line.subtotal)}
                </Text>
              </View>
            ))}
            {pickedAddons.map(({ addon, quantity }) => (
              <View key={addon.id} style={styles.reviewLine}>
                <View style={styles.reviewLineText}>
                  <Text style={styles.reviewName}>{addon.name}</Text>
                  <Text style={styles.reviewMeta}>
                    {quantity > 1
                      ? `Add-on · ${quantity} × ${formatMoney(addon.price)}`
                      : 'Add-on · once per booking'}
                  </Text>
                </View>
                <Text style={styles.reviewAmount}>{addonPriceLabel(addon.price * quantity)}</Text>
              </View>
            ))}
          </Card>

          {hasPreferences(chosenPreferences) && (
            <Card>
              <View style={styles.reviewHead}>
                <Text style={styles.sectionTitle}>How we&apos;ll wash it</Text>
                <EditLink label="Change how we wash it" onPress={() => setStep('items')} />
              </View>
              {preferenceLines(chosenPreferences).map((line) => (
                <Subtle key={line}>{line}</Subtle>
              ))}
              {chosenPreferences.instructions ? (
                <Subtle>“{chosenPreferences.instructions}”</Subtle>
              ) : null}
            </Card>
          )}

          <Card>
            <View style={styles.reviewHead}>
              <Text style={styles.sectionTitle}>
                {fulfillment === 'delivery' ? 'Pickup & delivery' : 'Drop-off'}
              </Text>
              <EditLink label="Change pickup and delivery" onPress={() => setStep('schedule')} />
            </View>
            {fulfillment === 'delivery' ? (
              <>
                <ReviewRow label="Pickup" value={slotSummary(pickupSlot, now)} />
                <ReviewRow label="Delivered back" value={slotSummary(deliverSlot, now)} />
                <ReviewRow label="Address" value={deliveryAddress} />
                {riderNotes ? <ReviewRow label="Rider" value={riderNotes} /> : null}
              </>
            ) : (
              <Subtle>
                Bring your laundry to the shop and pick it up yourself once it&apos;s
                ready — no schedule needed.
              </Subtle>
            )}
          </Card>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Identity block. Sits above the first card, so the first bordered surface
  // the eye lands on is a decision rather than a restatement of the title.
  header: { gap: space.cosy, paddingTop: space.tight },

  /** Sections breathe wider than the rows inside them: 20 against 12 and 8. */
  sections: { gap: space.section },
  sectionTitle: { ...type.section, color: colors.text },
  sectionMeta: { ...type.label, color: colors.actionInk },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  /** Four quick sizes on one row, so none strands alone on a second line. */
  quickChip: { flexBasis: '22%', flexGrow: 1 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.room,
    // 14pt text on 12+12 still clears the 44pt touch minimum without a hitSlop.
    paddingVertical: space.cosy,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  chipSelected: { backgroundColor: colors.action, borderColor: colors.action },
  chipText: { ...type.label, color: colors.text },
  chipTextSelected: { color: colors.onAccent },

  /** The schedule as one object with two rows, rather than two loose stacks. */
  legGroup: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.sunken,
    overflow: 'hidden',
  },
  legSeam: { height: 1, backgroundColor: colors.border },
  /** 14pt label on 14+14 clears the 44pt touch minimum without a hitSlop. */
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    paddingHorizontal: space.cosy,
    paddingVertical: space.room - 2,
  },
  /** Open reads as the row the chips below belong to, not as a selection. */
  legRowOpen: { backgroundColor: colors.actionSurface },
  legLabel: { ...type.label, color: colors.subtle },
  /** The answer. Right-aligned into whatever the label leaves, and the reason
      the chips can stay closed. */
  legValue: { ...type.label, flex: 1, textAlign: 'right', color: colors.text },
  /** No side padding: the chips are rails, and a rail that stops short of the
      edge looks like it has ended rather than scrolled. Their own 12 holds
      them off the border. */
  legPanel: {
    gap: space.snug,
    paddingTop: space.cosy,
    paddingBottom: space.cosy,
    backgroundColor: colors.actionSurface,
  },
  /** The wait, stated once for the pair: the label carries it, the sentence
      spends the rest of the line explaining what it means. */
  turnaroundRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.snug,
    marginTop: -space.tight,
  },
  turnaroundLabel: { ...type.label, color: colors.actionInk },
  turnaroundNote: { ...type.caption, color: colors.subtle, flexShrink: 1 },

  /** A condition on the price, not an announcement: it sits at caption weight
      and takes its blue from the ink that carries text, not the identity. */
  noticeText: { ...type.caption, fontFamily: type.label.fontFamily, color: colors.actionInk },

  // The review: the booking read back to you before the last tap.
  reviewLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.cosy,
    paddingTop: space.cosy,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reviewLineText: { flex: 1, gap: space.tight },
  reviewName: { ...type.body, fontFamily: type.label.fontFamily, color: colors.text },
  reviewMeta: { ...type.caption, color: colors.subtle },
  reviewAmount: { ...type.body, fontFamily: type.label.fontFamily, color: colors.text },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.cosy,
  },
  reviewLabel: { ...type.label, color: colors.subtle },
  /** Right-aligned into whatever the label leaves, like the schedule legs. */
  reviewValue: { ...type.body, color: colors.text, flex: 1, textAlign: 'right' },

  // The buy bar, pinned in the footer: the total, then the action.
  buyBar: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  priceBlock: { flex: 1, minWidth: 0 },
  backAction: { width: 92 },
  mainAction: { minWidth: 148 },
  priceLabel: { ...type.caption, color: colors.subtle },
  priceValue: { ...type.value, color: colors.text },
  priceValueMuted: { color: colors.subtle },
  priceNote: { ...type.caption, fontSize: 11, lineHeight: 14, color: colors.subtle },
  /** The cart: what came off the shop's shelf, and what it adds. */
  cartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
    paddingHorizontal: space.snug,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.actionSurface,
  },
  cartText: { ...type.caption, fontFamily: type.label.fontFamily, color: colors.actionInk, flex: 1 },
  cartAmount: { ...type.caption, fontFamily: type.label.fontFamily, color: colors.actionInk },
  commitRow: { flexDirection: 'row', gap: space.snug },
  headerBack: { marginLeft: space.snug, padding: space.tight },

  /** A review card's heading, with its way back to the step that asked. */
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.snug,
  },
  editLink: { minHeight: 32, justifyContent: 'center' },
  editLinkText: { ...type.label, color: colors.actionInk },
  /** "Book again" says so once, above the review it filled in. */
  rebookNote: {
    gap: space.tight,
    padding: space.room,
    borderRadius: 14,
    backgroundColor: colors.actionSurface,
  },
  rebookTitle: { ...type.section, color: colors.actionInk },
  rebookBody: { ...type.body, color: colors.text },
});
