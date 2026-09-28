/**
 * The booking itself, as one ticket: what to wash, how it gets to the shop and
 * when — each line filled with a sensible default and opened in place to
 * change. The closed lines are the read-back, so there is no separate review.
 * One flow for every place a customer books from.
 *
 * The app's booking screen and the shop's own web page both render this, so a
 * question added here — an add-on shelf, heavy items, a wash preference — is
 * asked on both. What differs between them is passed in, not forked:
 *
 *   - `Frame` is the page around the ticket: the app's screen, or the web shell.
 *   - `prepare` runs before placing: the web page connects the visitor first.
 *   - `renderSignIn` stands in for "Place order" when nobody is signed in.
 *   - `onPlaced` says where to go once the order is in.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { AddressChips } from "@/components/address-book";
import { AddonShelf } from "@/components/addon-shelf";
import { PriceSummary } from "@/components/booking-parts";
import { bookingStyles as styles } from "@/components/booking-styles";
import {
  BasketRecap,
  BookingSteps,
  ChoiceTiles,
  RebookBanner,
  SECTION_TINTS,
  Section,
  StepperRow,
  TicketHeader,
  type TicketShop,
  useTicketMotion,
  type ChoiceTile,
} from "@/components/booking-ticket";
import { HeavyItems } from "@/components/heavy-items";
import { PreferencePicker } from "@/components/laundry-preferences";
import { LoadSizePicker } from "@/components/load-size-picker";
import { MarketBasketPage } from "@/components/market-checkout";
import { SchedulePlanner, type StopName } from "@/components/schedule-planner";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Subtle,
  formatMoney,
} from "@/components/ui-kit";
import { getMyAddresses, placeOrder } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MAX_PIECES, clampPieces } from "@/lib/domain/quantity-input";
import {
  friendlyBookingError,
  isConnectionError,
} from "@/lib/domain/booking-error";
import {
  buildBookingItems,
  clampWeight,
  estimateBooking,
  type AddOnQuantities,
} from "@/lib/domain/booking-estimate";
import {
  validateBookingSchedule,
  type BookingScheduleErrors,
} from "@/lib/domain/booking-schedule";
import { type BookingSeed, type SlotValue } from "@/lib/domain/booking-seed";
import {
  addonSummary,
  firstPage,
  type BookingPage,
} from "@/lib/domain/booking-ticket";
import { validateBookingLoad } from "@/lib/domain/booking-validation";
import {
  defaultAddress,
  formatAddressLine,
  matchSavedAddress,
  type SavedAddress,
} from "@/lib/domain/customer-book";
import {
  formatBookingNotes,
  hasPreferences,
  limitToSupported,
  preferenceLines,
  validatePreferences,
  type LaundryPreferences,
  type PreferenceKey,
} from "@/lib/domain/laundry-preferences";
import {
  loadSizes,
  loadSummary,
  overLoadNotice,
} from "@/lib/domain/load-size";
import { portholeLevel } from "@/lib/domain/porthole";
import { formatQuantity, minimumChargeNotice } from "@/lib/domain/price-label";
import { isWeighed } from "@/lib/domain/pricing";
import {
  DEFAULT_SHOP_HOURS,
  slotInstant,
  slotProblems,
  windowEnd,
  type ShopHours,
} from "@/lib/domain/rider-calendar";
import { questionsFor } from "@/lib/domain/service-questions";
import {
  addonPayload,
  addonPriceLabel,
  addonsTotal,
  groupAddons,
  pickAddon,
  selectedAddons,
  setAddonQuantity,
  type AddonGroupRules,
  type ShopAddon,
} from "@/lib/domain/shop-addons";
import { bookingToCart, type Cart } from "@/lib/domain/market-cart";
import type { Fulfillment } from "@/lib/domain/walk-in-order";
import type { OrderRow, ServiceRow } from "@/lib/types";
import { useNow } from "@/lib/use-now";

/** What the page around the ticket is given to draw. */
export interface BookingFrameProps {
  footer: React.ReactNode;
  children: React.ReactNode;
}

export interface BookingFlowProps {
  shopId: string;
  service: ServiceRow;
  services: readonly ServiceRow[];
  supported: readonly PreferenceKey[];
  seed: BookingSeed;
  /** The shop's own priced soaps, fabcons and extras. Empty until it sets some up. */
  shopAddons: readonly ShopAddon[];
  /** The shop's pick-one or pick-several setting per kind. */
  addonRules: AddonGroupRules;
  /** The page around the ticket: the app's screen, or the web page's shell. */
  Frame: React.ComponentType<BookingFrameProps>;
  /** Runs before placing and answers the shop id to book with. */
  prepare?: () => Promise<string>;
  onPlaced: (order: OrderRow) => void;
  /** Set on the shop's public page: always an online booking, even for its owner. */
  orderType?: "online";
  /**
   * Drawn under the ticket in place of "Book now" while nobody is signed in.
   * It is handed the function that places the order once a session exists.
   */
  renderSignIn?: (place: () => Promise<void>) => React.ReactNode;
  /** Opens the customer's orders, offered when a reply was lost mid-booking. */
  onCheckOrders?: () => void;
  /** How the shop runs its riders; the default until shops can set their own. */
  hours?: ShopHours;
  /** The shop's name and logo, for the slim header over a weighed load. */
  shop?: TicketShop;
  /**
   * `market`: the booking came from the market storefront's basket, so the
   * first page reads as a basket (`market-checkout`) instead of the ticket.
   * The second page, the checks and the order are the same either way.
   */
  look?: "classic" | "market";
  /**
   * The market's way back to the shop with the basket as it stands now, so
   * the customer can add or take things out. Not given, no button is drawn.
   */
  onEditBasket?: (cart: Cart) => void;
}

export function BookingFlow({
  shopId,
  service,
  services,
  supported,
  seed,
  shopAddons,
  addonRules,
  Frame,
  prepare,
  onPlaced,
  orderType,
  renderSignIn,
  onCheckOrders,
  hours = DEFAULT_SHOP_HOURS,
  shop,
  look = "classic",
  onEditBasket,
}: BookingFlowProps) {
  const isMarket = look === "market";
  const queryClient = useQueryClient();
  const { profile, session } = useAuth();
  const serviceId = service.id;
  // Per kilo, or a flat price per load: either way the customer drags the
  // ruler. Only pieces get the counter.
  const isByWeight = isWeighed(service);
  /** Ticks, so the schedule shuts windows as they pass and turns over at midnight. */
  const now = useNow();

  /** Laundry first, then delivery: one kind of question per page. */
  const [page, setPage] = useState<BookingPage>(() => firstPage(seed.step));
  const animate = useTicketMotion();
  const [weightKg, setWeightKg] = useState(seed.weightKg);
  const [addOns, setAddOns] = useState<AddOnQuantities>(seed.addOns);
  const [preferences, setPreferences] = useState<LaundryPreferences>(
    seed.preferences,
  );
  // Only the questions this kind of service needs: nobody pressing a shirt
  // should be asked which detergent to use. See `domain/service-questions`.
  const questions = questionsFor(service.category, service.unit);
  const relevantAddons = shopAddons.filter((addon) =>
    questions.addonKinds.includes(addon.kind),
  );
  const [addonPicks, setAddonPicks] = useState<Record<string, number>>({});
  const pickedAddons = selectedAddons(relevantAddons, addonPicks);
  const addonExtra = addonsTotal(relevantAddons, addonPicks);
  const addonCount = pickedAddons.reduce((sum, line) => sum + line.quantity, 0);
  // Soap and fabcon come off the shop's own priced shelf and nowhere else.
  // The free brand tiles used to stand in for a shop with no shelf, which let
  // a customer ask for a brand at no price the counter had never agreed to.
  // Every shop is stocked with a priced shelf now (migration 0030).
  const shelfKinds = new Set(
    groupAddons(relevantAddons).map((group) => group.kind),
  );
  const preferenceKeys = supported.filter(
    (key) =>
      questions.preferences.includes(key) &&
      key !== "detergent" &&
      key !== "softener",
  );
  const [error, setError] = useState("");
  /** Set the moment an order may have reached the shop; never cleared by a lost reply. */
  const [mayHaveBooked, setMayHaveBooked] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [prefsError, setPrefsError] = useState("");

  const [fulfillment, setFulfillment] = useState<Fulfillment>(seed.fulfillment);
  /**
   * What the customer typed or picked, or null while they have done neither.
   *
   * Null rather than an empty string, so the saved default can be *derived*
   * below instead of written in by an effect: an effect that seeds a field
   * races the field, and the race is lost by whoever typed first.
   */
  const [typedAddress, setTypedAddress] = useState<string | null>(seed.address);
  const [typedRiderNotes, setTypedRiderNotes] = useState<string | null>(
    seed.riderNotes,
  );

  // A guest on the web page has no address book until they sign in on the
  // last step, which is exactly when the field stops mattering.
  const addresses = useQuery({
    queryKey: ["my-addresses"],
    queryFn: getMyAddresses,
    enabled: Boolean(session),
  });
  const saved = useMemo(() => addresses.data ?? [], [addresses.data]);
  const usualAddress = defaultAddress(saved);
  const deliveryAddress =
    typedAddress ?? (usualAddress ? formatAddressLine(usualAddress) : "");
  const riderNotes =
    typedRiderNotes ?? matchSavedAddress(saved, deliveryAddress)?.notes ?? "";

  const [pickupSlot, setPickupSlot] = useState<SlotValue>(seed.pickup);
  const [deliverSlot, setDeliverSlot] = useState<SlotValue>(seed.deliver);
  /**
   * Which stop of the schedule is open for editing. None to start: the
   * journey already states a schedule that works, and reads as one line per
   * stop until the customer asks to change it. A problem opens its own stop.
   */
  const [openLeg, setOpenLeg] = useState<StopName | null>(null);
  const [fieldErrors, setFieldErrors] = useState<BookingScheduleErrors>({});

  /** Heavy/thick extras: the shop's bedding & heavy items, minus the main service. */
  const heavyExtras = questions.offersHeavyItems
    ? services.filter(
        (row) => row.category === "special_items" && row.id !== serviceId,
      )
    : [];

  /**
   * Lines the booking opened with that no other part of this page shows: a
   * basket from the market storefront, or a book-again, can carry a pressed
   * barong beside a wash. Fixed at mount, so a line counted down to zero stays
   * on the page to be counted back up instead of vanishing under the thumb.
   */
  const [basketIds] = useState(() => {
    const heavyIds = new Set(heavyExtras.map((row) => row.id));
    // Counted pieces only: a second weighed load has no stepper that fits it.
    return Object.keys(seed.addOns).filter(
      (id) =>
        !heavyIds.has(id) &&
        services.some((row) => row.id === id && !isWeighed(row)),
    );
  });
  const basketLines = basketIds.flatMap((id) => {
    const row = services.find((entry) => entry.id === id);
    return row ? [row] : [];
  });

  const estimate = useMemo(
    () => estimateBooking(services, serviceId, weightKg, addOns),
    [services, serviceId, weightKg, addOns],
  );

  const mutation = useMutation({
    mutationFn: (schedule: {
      fulfillment: Fulfillment;
      deliveryAddress: string;
      pickupAt: Date | null;
      deliverBy: Date | null;
    }) =>
      // The web page connects a visitor to the shop first; the app's customer
      // is already connected, so it books with the shop it came from.
      (prepare ? prepare() : Promise.resolve(shopId)).then((bookWith) =>
        placeOrder(
          bookWith,
          buildBookingItems(serviceId, weightKg, addOns, services).map((item) => ({
            service_id: item.serviceId,
            quantity: item.quantity,
          })),
          {
            ...schedule,
            // Preferences and rider instructions ride on the order's notes: the
            // field every shop screen and printed ticket already shows.
            notes: formatBookingNotes({
              preferences: limitToSupported(preferences, preferenceKeys),
              riderNotes: schedule.fulfillment === "delivery" ? riderNotes : "",
            }),
            ...(orderType ? { orderType } : {}),
            // Ids only: the server prices them from the shop's own rows.
            addons: addonPayload(pickedAddons),
            // Booked with the method this customer always uses, so the pay screen
            // opens on their own answer instead of on the shop's default.
            ...(profile?.preferred_payment_method
              ? { paymentMethod: profile.preferred_payment_method }
              : {}),
          },
        ),
      ),
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      onPlaced(order);
    },
    onError: (err: Error) => {
      // A lost reply is not a failed order: the order may have gone in. Say
      // so and point at the orders list rather than inviting a second one.
      if (isConnectionError(err.message)) setMayHaveBooked(true);
      setError(friendlyBookingError(err.message));
    },
  });

  /**
   * The load and the wash notes, checked against what the shop takes. True
   * when something on the laundry page has to change; the part is marked red.
   */
  const hasItemsProblem = (): boolean => {
    const problem = validateBookingLoad({
      service,
      quantity: weightKg,
      addOns,
      catalog: services,
    });
    // Only what this shop asks about: a book-again from a shop that took
    // written instructions must not block a booking on a field hidden here.
    const prefs = validatePreferences(
      limitToSupported(preferences, preferenceKeys),
    );
    setLoadError(problem ?? "");
    setPrefsError(prefs.ok ? "" : (prefs.errors.instructions ?? ""));
    return Boolean(problem) || !prefs.ok;
  };

  /**
   * The schedule, checked. Returns null and shows the delivery page with the
   * wrong part open — an error nobody can see is an error nobody can act on.
   */
  const settledSchedule = () => {
    // A fresh reading, not the ticking one: this is the moment it is sent.
    const at = new Date();
    const result = validateBookingSchedule(
      {
        fulfillment,
        deliveryAddress,
        // Exact instants on the shop's clock: the rider is due from the
        // moment the pickup window opens, and the laundry is back by the time
        // the return window closes.
        pickupAt: slotInstant(pickupSlot, hours),
        deliverBy: slotInstant(
          { day: deliverSlot.day, hour: windowEnd(deliverSlot.hour, hours) },
          hours,
        ),
      },
      at,
    );
    const slots =
      fulfillment === "delivery"
        ? slotProblems(pickupSlot, deliverSlot, at, hours)
        : {};
    const errors = { ...(result.ok ? {} : result.errors), ...slots };
    if (!result.ok || Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      animate();
      setPage("delivery");
      if (!errors.deliveryAddress)
        setOpenLeg(errors.pickupAt ? "pickup" : "deliver");
      return null;
    }
    setFieldErrors({});
    return result.value;
  };

  const goTo = (next: BookingPage) => {
    animate();
    setPage(next);
  };

  /** Page one's button: checked here, so a problem is fixed where it is. */
  const goToDelivery = () => {
    setError("");
    if (hasItemsProblem()) {
      setError("Check the part marked in red.");
      return;
    }
    goTo("delivery");
  };

  const placeBooking = async () => {
    // Two taps, or a guest's sign-in and a tap landing together, must not
    // place two orders.
    if (mutation.isPending) return;
    setError("");
    // Checked at the tap: the lines arrive filled with defaults, and a
    // schedule can go stale while the ticket sits open.
    if (hasItemsProblem()) {
      goTo("laundry");
      setError("Check the part marked in red.");
      return;
    }
    const schedule = settledSchedule();
    if (!schedule) {
      setError("Check the part marked in red.");
      return;
    }
    // The failure is already on screen through onError; nothing to rethrow.
    await mutation.mutateAsync(schedule).catch(() => undefined);
  };

  /** A guest on the web page gives a name and number before anything is placed. */
  const needsSignIn = !session && Boolean(renderSignIn);

  const pickAddress = (pick: SavedAddress) => {
    setTypedAddress(formatAddressLine(pick));
    setTypedRiderNotes(pick.notes);
    setFieldErrors((prev) => ({ ...prev, deliveryAddress: undefined }));
  };

  const hasSelection =
    weightKg > 0 || Object.values(addOns).some((qty) => qty > 0);
  const mainMinimumNotice = minimumChargeNotice(service, weightKg);
  const overLoad = overLoadNotice(service, weightKg);
  const chosenPreferences = limitToSupported(preferences, preferenceKeys);

  // What each closed line reads as, and what it adds to the bill.
  // Summed: a flat extra goes to the shop as one line per piece.
  const lineAmount = (id: string) => {
    const lines = estimate?.lines.filter((line) => line.serviceId === id) ?? [];
    return lines.length > 0 ? lines.reduce((sum, line) => sum + line.subtotal, 0) : undefined;
  };
  const mainAmount = lineAmount(serviceId);
  const priceFor = (kg: number) => {
    const line = estimateBooking(services, serviceId, kg, {})?.lines.find(
      (entry) => entry.serviceId === serviceId,
    );
    return line ? formatMoney(line.subtotal) : null;
  };
  const loadText = isByWeight
    ? loadSummary(loadSizes(service), weightKg)
    : formatQuantity(service.unit, weightKg);
  const bulkyPicked = heavyExtras.filter((row) => (addOns[row.id] ?? 0) > 0);
  const bulkyText =
    bulkyPicked.length === 0
      ? "None"
      : bulkyPicked.map((row) => `${row.name} ×${addOns[row.id]}`).join(", ");
  const bulkyAmount = bulkyPicked.reduce(
    (sum, row) => sum + (lineAmount(row.id) ?? 0),
    0,
  );
  const washText = hasPreferences(chosenPreferences)
    ? preferenceLines(chosenPreferences).join(" · ")
    : "Shop's usual";
  const whenProblem = fieldErrors.pickupAt ?? fieldErrors.deliverBy ?? null;

  const total = estimate
    ? { ...estimate, total: estimate.total + addonExtra }
    : null;
  const isLaundryPage = page === "laundry";
  const basketPicked = basketLines.filter((row) => (addOns[row.id] ?? 0) > 0);
  const recapDetail = [
    isMarket && basketPicked.length > 0
      ? basketPicked.map((row) => `${row.name} ×${addOns[row.id]}`).join(", ")
      : null,
    bulkyPicked.length > 0 ? bulkyText : null,
    addonCount > 0 ? addonSummary(pickedAddons) : null,
    washText,
  ]
    .filter(Boolean)
    .join(" · ");

  const footer = (
    <>
      <ErrorText>{error}</ErrorText>
      {mayHaveBooked && onCheckOrders ? (
        <Pressable accessibilityRole="link" onPress={onCheckOrders}>
          <Text style={styles.editLinkText}>
            Your booking may have gone through. Check your orders before trying
            again ›
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.buyBar}>
        <PriceSummary
          estimate={total}
          hasSelection={hasSelection}
          finalPriceNote={
            isMarket
              ? needsSignIn && !isLaundryPage
                ? "Your details below ↓"
                : "Estimate"
              : needsSignIn && !isLaundryPage
                ? "Add your name and number below to book."
                : questions.finalPriceNote
          }
        />
        {isLaundryPage && isMarket && onEditBasket ? (
          <View style={styles.backAction}>
            <Button
              title="‹ Back"
              variant="outline"
              onPress={() =>
                onEditBasket(bookingToCart(serviceId, weightKg, addOns, services))
              }
            />
          </View>
        ) : null}
        {isLaundryPage ? (
          <View style={styles.mainAction}>
            <Button
              title={isMarket ? "Next" : "Next: Delivery"}
              disabled={!hasSelection}
              onPress={goToDelivery}
            />
          </View>
        ) : (
          <>
            {/* Always a way back: to add a comforter, or to change their mind. */}
            <View style={styles.backAction}>
              <Button
                title="‹ Back"
                variant="outline"
                onPress={() => goTo("laundry")}
              />
            </View>
            {needsSignIn ? null : (
              <View style={styles.mainAction}>
                <Button
                  title={
                    mutation.isPending
                      ? isMarket
                        ? "Placing…"
                        : "Booking…"
                      : isMarket
                        ? "Place order"
                        : "Book now"
                  }
                  disabled={!hasSelection || mutation.isPending}
                  onPress={() => void placeBooking()}
                />
              </View>
            )}
          </>
        )}
      </View>
    </>
  );

  // Render functions, not components: a component declared in here would be
  // a new type every render and remount the address field on each keystroke.
  const renderLaundryPage = () => (
    <>
      <TicketHeader
        service={service}
        level={portholeLevel(service.unit, weightKg)}
        tumbleKey={`${weightKg}-${addonCount}-${bulkyPicked.length}`}
        readout={weightKg > 0 ? `${weightKg}${isByWeight ? "kg" : ""}` : null}
        isLoaded={hasSelection}
        shop={shop}
        // The load picker below draws the drum; the top keeps to words.
        isCompact={isByWeight}
      />
      {seed.rebook ? <RebookBanner dropped={seed.rebook.droppedNames} /> : null}

      {isByWeight ? (
        <Section
          icon="scale"
          tint={SECTION_TINTS.load}
          title="Load size"
          subtitle={loadText}
          amount={mainAmount === undefined ? null : formatMoney(mainAmount)}
          problem={loadError || null}
        >
          <LoadSizePicker
            service={service}
            valueKg={weightKg}
            onChange={(kg) => {
              setWeightKg(clampWeight(kg));
              setLoadError("");
            }}
            priceFor={priceFor}
          />
          {mainMinimumNotice && (
            <Text style={styles.noticeText}>{mainMinimumNotice}</Text>
          )}
          {overLoad && <Text style={styles.noticeText}>{overLoad}</Text>}
        </Section>
      ) : (
        // A count is one tap either way, so it answers on its own line.
        <StepperRow
          title="Quantity"
          value={weightKg}
          max={MAX_PIECES}
          unit={weightKg === 1 ? "piece" : "pieces"}
          amount={mainAmount === undefined ? null : formatMoney(mainAmount)}
          onChange={(count) => {
            setWeightKg(clampPieces(count));
            setLoadError("");
          }}
          problem={loadError || mainMinimumNotice || null}
        />
      )}

      {heavyExtras.length > 0 && (
        <Section
          icon="bed"
          tint={SECTION_TINTS.heavy}
          title="Heavy items"
          amount={bulkyAmount > 0 ? `+${formatMoney(bulkyAmount)}` : null}
          isOptional
        >
          <HeavyItems
            isBare
            tint={SECTION_TINTS.heavy}
            extras={heavyExtras}
            quantities={addOns}
            onChange={(id, next) => {
              setAddOns((prev) => ({ ...prev, [id]: next }));
              setLoadError("");
            }}
          />
        </Section>
      )}

      {/* The shop's own shelf: soap, fabcon and extras at its prices. */}
      {shelfKinds.size > 0 && (
        <Section
          icon="flask"
          tint={SECTION_TINTS.addons}
          title="Add-ons"
          subtitle="Soap, fabcon and extras"
          amount={addonCount > 0 ? addonPriceLabel(addonExtra) : null}
          isOptional
        >
          <AddonShelf
            addons={relevantAddons}
            picks={addonPicks}
            rules={addonRules}
            onToggle={(addon) =>
              setAddonPicks((prev) =>
                pickAddon(prev, addon, relevantAddons, addonRules),
              )
            }
            onQuantity={(addon, quantity) =>
              setAddonPicks((prev) => setAddonQuantity(prev, addon, quantity))
            }
          />
        </Section>
      )}

      {/* Only what this shop honours. The customer's usual arrives filled
          in; changing it here changes this load, not the usual. */}
      {preferenceKeys.length > 0 && (
        <Section
          icon="water"
          tint={SECTION_TINTS.wash}
          title="Wash"
          subtitle={washText}
          isOptional
          problem={prefsError || null}
        >
          <PreferencePicker
            value={preferences}
            onChange={setPreferences}
            supported={preferenceKeys}
            error={prefsError}
            delicatesNote={questions.delicatesNote}
            instructionsExample={questions.instructionsExample}
          />
        </Section>
      )}
    </>
  );

  const renderMarketPage = () => (
    <>
      {seed.rebook ? <RebookBanner dropped={seed.rebook.droppedNames} /> : null}
      <MarketBasketPage
        service={service}
        isByWeight={isByWeight}
        quantity={weightKg}
        onQuantity={(next) => {
          setWeightKg(isByWeight ? clampWeight(next) : clampPieces(next));
          setLoadError("");
        }}
        priceFor={priceFor}
        mainAmount={mainAmount}
        notices={[mainMinimumNotice, overLoad].filter(
          (note): note is string => Boolean(note),
        )}
        problem={loadError || null}
        basketLines={basketLines}
        heavyExtras={heavyExtras}
        counts={addOns}
        onCount={(id, next) => {
          setAddOns((prev) => ({ ...prev, [id]: clampPieces(next) }));
          setLoadError("");
        }}
        lineAmount={lineAmount}
        addons={shelfKinds.size > 0 ? relevantAddons : []}
        picks={addonPicks}
        rules={addonRules}
        onToggleAddon={(addon) =>
          setAddonPicks((prev) =>
            pickAddon(prev, addon, relevantAddons, addonRules),
          )
        }
        washSummary={washText}
        washProblem={prefsError || null}
        washNotes={
          preferenceKeys.length > 0 ? (
            <PreferencePicker
              value={preferences}
              onChange={setPreferences}
              supported={preferenceKeys}
              error={prefsError}
              delicatesNote={questions.delicatesNote}
              instructionsExample={questions.instructionsExample}
            />
          ) : null
        }
      />
    </>
  );

  const renderDeliveryPage = () => (
    <>
      <BasketRecap
        title={
          isMarket
            ? `${service.name} · ${isByWeight ? `${weightKg} kg` : formatQuantity(service.unit, weightKg)}`
            : `${service.name} · ${loadText}`
        }
        detail={recapDetail}
        onEdit={() => goTo("laundry")}
      />

      <ChoiceTiles
        options={isMarket ? MARKET_FULFILLMENT_TILES : FULFILLMENT_TILES}
        value={fulfillment}
        onChange={(next) => {
          animate();
          setFulfillment(next);
        }}
      />

      {fulfillment === "delivery" ? (
        <>
          <Section
            icon="location"
            tint={SECTION_TINTS.place}
            title="Address"
            problem={fieldErrors.deliveryAddress ?? null}
          >
            {/* The places this customer has saved, over the field rather
                than instead of it: somewhere new still has to be typeable. */}
            <AddressChips
              addresses={saved}
              value={deliveryAddress}
              onPick={pickAddress}
            />
            <Field
              label={isMarket ? "" : "Pickup & delivery address"}
              value={deliveryAddress}
              onChangeText={setTypedAddress}
              placeholder="House no., street, barangay, city"
            />
            <Field
              label={isMarket ? "Note for rider" : "Rider instructions (optional)"}
              value={riderNotes}
              onChangeText={setTypedRiderNotes}
              placeholder="Landmark, gate colour, who to ask for"
            />
          </Section>

          {/* The schedule as the journey the laundry takes. It opens on a
              schedule that already works: the next free rider window. */}
          <Section
            icon="time"
            tint={SECTION_TINTS.schedule}
            title="Schedule"
            problem={whenProblem}
          >
            <SchedulePlanner
              value={{ pickup: pickupSlot, deliver: deliverSlot }}
              onChange={(next) => {
                setPickupSlot(next.pickup);
                setDeliverSlot(next.deliver);
                setFieldErrors((prev) => ({
                  ...prev,
                  pickupAt: undefined,
                  deliverBy: undefined,
                }));
              }}
              openStop={openLeg}
              onOpenStop={setOpenLeg}
              hours={hours}
              now={now}
            />
          </Section>
        </>
      ) : (
        isMarket ? null : (
          <Subtle>Bring it to the shop, pick it up when it&apos;s ready.</Subtle>
        )
      )}

      {/* Who it is for. A guest on the web page gives a name and number
          here, and the order is placed in the same tap that signs them in. */}
      {needsSignIn && renderSignIn ? (
        <Card>
          <Text style={styles.sectionTitle}>
            {isMarket ? "Your details" : "Your name and number"}
          </Text>
          {renderSignIn(placeBooking)}
        </Card>
      ) : null}
    </>
  );

  return (
    // Keyed by page so each page opens at its top rather than mid-scroll.
    <Frame key={page} footer={footer}>
      <BookingSteps
        page={page}
        onGoTo={goTo}
        labels={isMarket ? { laundry: "Basket" } : undefined}
      />
      {isLaundryPage
        ? isMarket
          ? renderMarketPage()
          : renderLaundryPage()
        : renderDeliveryPage()}
    </Frame>
  );
}

/** The market's tiles: the picture and one word each. */
const MARKET_FULFILLMENT_TILES: readonly ChoiceTile<Fulfillment>[] = [
  { key: "delivery", icon: "bicycle", title: "Delivery", detail: "" },
  { key: "pickup", icon: "storefront", title: "Drop-off", detail: "" },
];

/** How the laundry gets to the shop and back, as two pictures to choose between. */
const FULFILLMENT_TILES: readonly ChoiceTile<Fulfillment>[] = [
  {
    key: "delivery",
    icon: "bicycle",
    title: "Pick up & deliver",
    detail: "A rider collects and returns it",
  },
  {
    key: "pickup",
    icon: "storefront",
    title: "Drop off",
    detail: "Bring it to the shop yourself",
  },
];
