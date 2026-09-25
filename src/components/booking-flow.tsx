/**
 * The booking itself: what to wash, when and where, and a read-back before the
 * last tap. One flow for every place a customer books from.
 *
 * The app's booking screen and the shop's own web page both render this, so a
 * question added here — an add-on shelf, heavy items, a wash preference — is
 * asked on both. What differs between them is passed in, not forked:
 *
 *   - `Frame` is the page around the steps: the app's screen, or the web shell.
 *   - `prepare` runs before placing: the web page connects the visitor first.
 *   - `renderSignIn` stands in for "Place order" when nobody is signed in.
 *   - `onPlaced` says where to go once the order is in.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AddressChips } from '@/components/address-book';
import { AddonShelf } from '@/components/addon-shelf';
import { BookingHero } from '@/components/booking-hero';
import {
  CartLine,
  Chip,
  EditLink,
  PriceSummary,
  ReviewRow,
  ScheduleLeg,
} from '@/components/booking-parts';
import { bookingStyles as styles } from '@/components/booking-styles';
import { HeavyItems } from '@/components/heavy-items';
import { PreferencePicker } from '@/components/laundry-preferences';
import { PieceCounter, WeightScale } from '@/components/quantity-picker';
import { StepRail } from '@/components/step-rail';
import { Button, Card, ErrorText, Field, Subtle, formatMoney } from '@/components/ui-kit';
import { getMyAddresses, placeOrder } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { friendlyBookingError, isConnectionError } from '@/lib/domain/booking-error';
import {
  MAX_WEIGHT_KG,
  buildBookingItems,
  clampWeight,
  estimateBooking,
  type AddOnQuantities,
} from '@/lib/domain/booking-estimate';
import { validateBookingSchedule, type BookingScheduleErrors } from '@/lib/domain/booking-schedule';
import {
  BOOKING_STEPS,
  slotDate,
  snapToOpen,
  type BookingSeed,
  type BookingStep,
  type SlotValue,
} from '@/lib/domain/booking-seed';
import {
  keepDeliveryAfterPickup,
  slotSummary,
  turnaroundLabel,
  turnaroundNote,
} from '@/lib/domain/booking-slot';
import {
  MIN_BOOKING_WEIGHT_KG,
  deliveryHours,
  openHours,
  slotProblems,
  validateBookingLoad,
} from '@/lib/domain/booking-validation';
import {
  defaultAddress,
  formatAddressLine,
  matchSavedAddress,
  type SavedAddress,
} from '@/lib/domain/customer-book';
import {
  formatBookingNotes,
  hasPreferences,
  limitToSupported,
  preferenceLines,
  validatePreferences,
  type LaundryPreferences,
  type PreferenceKey,
} from '@/lib/domain/laundry-preferences';
import { formatPriceLine, formatQuantity, minimumChargeNotice } from '@/lib/domain/price-label';
import { questionsFor } from '@/lib/domain/service-questions';
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
} from '@/lib/domain/shop-addons';
import { previousStep } from '@/lib/domain/step-rail';
import type { Fulfillment } from '@/lib/domain/walk-in-order';
import type { OrderRow, ServiceRow } from '@/lib/types';

const QUICK_WEIGHTS_KG = [3, 5, 8, 12];

type LegName = 'pickup' | 'deliver';

/** What the page around the steps is given to draw. */
export interface BookingFrameProps {
  step: BookingStep;
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
  /** The page around the steps: the app's screen, or the web page's shell. */
  Frame: React.ComponentType<BookingFrameProps>;
  /** Runs before placing and answers the shop id to book with. */
  prepare?: () => Promise<string>;
  onPlaced: (order: OrderRow) => void;
  /** Set on the shop's public page: always an online booking, even for its owner. */
  orderType?: 'online';
  /**
   * Drawn on the review in place of "Place order" while nobody is signed in.
   * It is handed the function that places the order once a session exists.
   */
  renderSignIn?: (place: () => Promise<void>) => React.ReactNode;
  /** Opens the customer's orders, offered when a reply was lost mid-booking. */
  onCheckOrders?: () => void;
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
}: BookingFlowProps) {
  const queryClient = useQueryClient();
  const { profile, session } = useAuth();
  const serviceId = service.id;
  const isPerKg = service.unit === 'per_kg';

  const [step, setStep] = useState<BookingStep>(seed.step);
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
  /** Set the moment an order may have reached the shop; never cleared by a lost reply. */
  const [mayHaveBooked, setMayHaveBooked] = useState(false);
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

  // A guest on the web page has no address book until they sign in on the
  // last step, which is exactly when the field stops mattering.
  const addresses = useQuery({
    queryKey: ['my-addresses'],
    queryFn: getMyAddresses,
    enabled: Boolean(session),
  });
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
      // The web page connects a visitor to the shop first; the app's customer
      // is already connected, so it books with the shop it came from.
      (prepare ? prepare() : Promise.resolve(shopId)).then((bookWith) =>
      placeOrder(
        bookWith,
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
          ...(orderType ? { orderType } : {}),
          // Ids only: the server prices them from the shop's own rows.
          addons: addonPayload(pickedAddons),
          // Booked with the method this customer always uses, so the pay screen
          // opens on their own answer instead of on the shop's default.
          ...(profile?.preferred_payment_method
            ? { paymentMethod: profile.preferred_payment_method }
            : {}),
        }
      )),
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      onPlaced(order);
    },
    onError: (err: Error) => {
      // A lost reply is not a failed order: the order may have gone in. Say
      // so and point at the orders list rather than inviting a second one.
      if (isConnectionError(err.message)) setMayHaveBooked(true);
      setError(friendlyBookingError(err.message));
    },
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

  const placeBooking = async () => {
    // Two taps, or a guest's sign-in and a tap landing together, must not
    // place two orders.
    if (mutation.isPending) return;
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
    // The failure is already on screen through onError; nothing to rethrow.
    await mutation.mutateAsync(schedule).catch(() => undefined);
  };

  /** A guest on the web page signs in on the review before anything is placed. */
  const needsSignIn = !session && Boolean(renderSignIn);

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
      {mayHaveBooked && onCheckOrders ? (
        <Pressable accessibilityRole="link" onPress={onCheckOrders}>
          <Text style={styles.editLinkText}>
            Your booking may have gone through. Check your orders before trying again ›
          </Text>
        </Pressable>
      ) : null}
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
            needsSignIn ? null : (
              <Button
                title={mutation.isPending ? 'Placing…' : 'Place order'}
                disabled={mutation.isPending}
                onPress={() => void placeBooking()}
              />
            )
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
    <Frame step={step} footer={footer}>
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

          {/* Who it is for. A guest on the web page gives a name and number
              here, and the order is placed in the same tap that signs them in. */}
          {needsSignIn && renderSignIn ? (
            <Card>
              <Text style={styles.sectionTitle}>Your name and number</Text>
              {renderSignIn(placeBooking)}
            </Card>
          ) : null}
        </View>
      )}
    </Frame>
  );
}
