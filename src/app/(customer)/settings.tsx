import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { AddressBook, type AddressDraftOut } from '@/components/address-book';
import { BlueField } from '@/components/blue-field';
import { glassPane } from '@/components/glass';
import { LaundryPreferencesCard } from '@/components/laundry-preferences';
import { PaymentPreferenceCard } from '@/components/payment-preference-card';
import { RADII, Screen, colors, elevation, fontFor, space, type } from '@/components/ui-kit';
import {
  deleteAddress,
  getMyAddresses,
  getMyLaundryPreferences,
  getMyOrders,
  getRegisteredShops,
  saveAddress,
  saveLaundryPreferences,
  savePaymentPreference,
  setDefaultAddress,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { NO_PREFERENCES } from '@/lib/domain/laundry-preferences';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { formatPhoneInput } from '@/lib/domain/phone-input';
import { profileFacts, profileInitials } from '@/lib/domain/ticket-stamp';
import {
  SETTING_SECTIONS,
  toggleStateLabel,
  type SettingRow,
} from '@/lib/domain/app-settings';
import { signOutPrompt } from '@/lib/domain/confirm-prompts';
import { useAppSettings, useHaptic } from '@/lib/use-app-settings';
import { confirmAction } from '@/lib/confirm';

/**
 * Where the customer's own choices live.
 *
 * Sign-out used to be a grey text link under the last past order, so where it
 * sat on screen depended on how much laundry that person had done — for a new
 * customer it landed right in the thumb arc. It is here now, at the end,
 * behind a confirmation, with the switches that change how the app behaves
 * above it.
 *
 * The two subjects are kept apart on purpose: nothing above the last card
 * ends a session, and the one thing that does is red, alone, and last.
 */
export default function CustomerSettings() {
  const { profile, refreshProfile, signOut } = useAuth();
  const { settings, toggle } = useAppSettings();
  const haptic = useHaptic();

  // The same two cache keys the home already fills, so opening settings costs
  // no request and the counts cannot disagree with the screen behind them.
  const orders = useQuery({ queryKey: ['my-orders'], queryFn: getMyOrders });
  const shops = useQuery({ queryKey: ['registered-shops'], queryFn: getRegisteredShops });

  // The book: where the laundry goes, and how it gets paid for. Both are read
  // again by the booking flows off these same cache keys, so an address saved
  // here is in the next booking without a refetch.
  const queryClient = useQueryClient();
  const addresses = useQuery({ queryKey: ['my-addresses'], queryFn: getMyAddresses });
  const [bookError, setBookError] = React.useState('');

  const refreshAddresses = async () => {
    setBookError('');
    await queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
  };
  const reportBookError = (err: Error) => setBookError(friendlyMerchantError('save-order', err.message));

  const addressSave = useMutation({
    mutationFn: (draft: AddressDraftOut) => saveAddress(draft),
    onSuccess: refreshAddresses,
    onError: reportBookError,
  });
  const addressDelete = useMutation({
    mutationFn: (id: string) => deleteAddress(id),
    onSuccess: refreshAddresses,
    onError: reportBookError,
  });
  const addressDefault = useMutation({
    mutationFn: (id: string) => setDefaultAddress(id),
    onSuccess: refreshAddresses,
    onError: reportBookError,
  });

  const [payError, setPayError] = React.useState('');
  const payment = useMutation({
    mutationFn: savePaymentPreference,
    // Cleared per attempt, so a second failure with the same message still
    // reads as a new error to the card and rolls its tick back again.
    onMutate: () => setPayError(''),
    onSuccess: async () => {
      setPayError('');
      // The preference lives on the profile row, which the session holds.
      await refreshProfile();
    },
    onError: (err: Error) => setPayError(friendlyMerchantError('save-order', err.message)),
  });

  // The usual wash, from the customer's own table; the booking reads the
  // same cache key, so a change here is in the next booking without a refetch.
  const preferencesQuery = useQuery({
    queryKey: ['my-laundry-preferences'],
    queryFn: getMyLaundryPreferences,
  });
  const laundryPreferences = preferencesQuery.data ?? NO_PREFERENCES;
  const [prefsError, setPrefsError] = React.useState('');
  const preferencesSave = useMutation({
    mutationFn: saveLaundryPreferences,
    onSuccess: async () => {
      setPrefsError('');
      await queryClient.invalidateQueries({ queryKey: ['my-laundry-preferences'] });
    },
    onError: (err: Error) => setPrefsError(friendlyMerchantError('save-order', err.message)),
  });

  const isAddressBusy =
    addressSave.isPending || addressDelete.isPending || addressDefault.isPending;

  const onToggle = (row: SettingRow) => {
    // The tick fires from the state being left, so turning haptics *off* still
    // answers the finger that turned it off, and turning it on is felt at once.
    haptic('select');
    toggle(row.key);
  };

  const confirmSignOut = () => {
    haptic('warning');
    const prompt = signOutPrompt();
    confirmAction(prompt, () => signOut());
  };

  return (
    <Screen>
      {/* Who this account is, on the home's own light. The screen used to open
          on a grey "SIGNED IN AS" caption above a name — the least that could
          be said about a person, said as quietly as possible. */}
      <View style={styles.profile}>
        <BlueField />
        <View style={styles.profileRow}>
          <View style={styles.disc}>
            <Text style={styles.discText}>{profileInitials(profile?.full_name)}</Text>
          </View>
          <View style={styles.profileWords}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile?.full_name || profile?.username || 'Your account'}
            </Text>
            {profile?.phone ? (
              <Text style={styles.profileLine}>0{formatPhoneInput(profile.phone)}</Text>
            ) : null}
          </View>
        </View>
        {/* Real figures only: what they have with us and how long they have had
            it. No completeness bar over a profile nobody was asked to fill. */}
        <Text style={styles.profileFacts}>
          {profileFacts({
            shopCount: (shops.data ?? []).length,
            orderCount: (orders.data ?? []).length,
            createdAt: profile?.created_at,
          })}
        </Text>
      </View>

      {/* Typed once. The booking flows read the same list and drop the default
          straight into the address field. */}
      <AddressBook
        addresses={addresses.data ?? []}
        isBusy={isAddressBusy}
        error={bookError}
        onSave={(draft) => addressSave.mutate(draft)}
        onDelete={(id) => {
          haptic('warning');
          addressDelete.mutate(id);
        }}
        onMakeDefault={(id) => addressDefault.mutate(id)}
      />

      <PaymentPreferenceCard
        // Keyed on the saved value like the card below: the profile can arrive
        // after this screen mounts, and a draft seeded from `null` would show
        // no method at all for a customer who has one.
        key={`${profile?.preferred_payment_method ?? ''}:${profile?.payment_handle ?? ''}`}
        method={profile?.preferred_payment_method ?? null}
        handle={profile?.payment_handle ?? ''}
        isBusy={payment.isPending}
        error={payError}
        onSave={(preference) => payment.mutate(preference)}
      />

      <LaundryPreferencesCard
        // Keyed on the saved value, so the draft restarts from the profile
        // once it loads or once a save comes back.
        key={JSON.stringify(laundryPreferences)}
        value={laundryPreferences}
        isBusy={preferencesSave.isPending}
        error={prefsError}
        onSave={(next) => preferencesSave.mutate(next)}
      />

      {SETTING_SECTIONS.map((section) => (
        <View key={section.title}>
          <Text style={styles.sectionLabel}>{section.title}</Text>
          <View style={styles.group}>
            {section.rows.map((row, index) => (
              <ToggleRow
                key={row.key}
                row={row}
                isOn={settings[row.key]}
                isFirst={index === 0}
                onToggle={() => onToggle(row)}
              />
            ))}
          </View>
        </View>
      ))}

      {/* iOS sets the way out as a lone red row in its own group: plainly an
          action, plainly destructive, and nothing like the switches above. */}
      <View style={[styles.group, styles.signOut]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={confirmSignOut}
          style={({ pressed }) => [styles.signOutRow, pressed && styles.rowPressed]}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

/**
 * The whole row is the control, not just the switch: a switch at the far right
 * of a phone is the smallest target on the screen and the furthest from a left
 * thumb. The switch stays, because it is what says "on" at a glance.
 */
function ToggleRow({
  row,
  isOn,
  isFirst,
  onToggle,
}: {
  row: SettingRow;
  isOn: boolean;
  isFirst: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={toggleStateLabel(row.label, isOn)}
      accessibilityHint={row.caption}
      accessibilityState={{ checked: isOn }}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {isFirst ? null : <View style={styles.separator} />}
      {/* The Settings icon tile: a small rounded square, white glyph on colour. */}
      <View style={[styles.rowIcon, isOn && styles.rowIconOn]}>
        <Ionicons name={row.icon as never} size={18} color={colors.onAccent} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{row.label}</Text>
        <Text style={styles.rowCaption}>{row.caption}</Text>
      </View>
      {/* The row already announces itself; a second focusable switch would
          make a screen reader read every setting twice. */}
      <Switch
        value={isOn}
        onValueChange={onToggle}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        trackColor={{ false: '#E9E9EA', true: IOS_GREEN }}
        thumbColor={colors.card}
        ios_backgroundColor="#E9E9EA"
      />
    </Pressable>
  );
}

/** The iOS switch's on colour. */
const IOS_GREEN = '#34C759';
/** The Settings icon tile, and where a row's words start after it. */
const TILE = 30;
const TEXT_INSET = space.room + TILE + space.cosy;

const styles = StyleSheet.create({
  /**
   * The identity card, on the home's own blue. The field is absolutely
   * positioned inside it, so the card clips it to its corner.
   */
  profile: {
    borderRadius: RADII.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
    padding: space.section,
    gap: space.cosy,
    marginBottom: space.snug,
    ...elevation.lift,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: space.room },
  /** Where a photograph would be, if the product ever asks for one. */
  disc: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  discText: { ...type.section, fontSize: 22, color: colors.onAccent },
  profileWords: { flex: 1, gap: 2 },
  profileName: { ...type.section, fontSize: 22, lineHeight: 28, color: colors.onAccent },
  profileLine: { ...type.body, fontSize: 15, color: 'rgba(255, 255, 255, 0.85)' },
  profileFacts: { ...type.caption, color: 'rgba(255, 255, 255, 0.75)' },

  /** A group's header: small, grey, sentence case, set in from the group's edge. */
  sectionLabel: {
    ...type.caption,
    color: colors.subtle,
    marginBottom: space.snug - 2,
    marginTop: space.section,
    marginLeft: space.room,
  },
  group: {
    ...glassPane,
    borderRadius: RADII.card - 4,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    minHeight: 56,
    paddingVertical: space.snug + 2,
    paddingLeft: space.room,
    paddingRight: space.cosy,
  },
  rowPressed: { backgroundColor: 'rgba(255, 255, 255, 0.6)' },
  /** A hairline between rows only, starting where the words start. */
  separator: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: TEXT_INSET,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60, 60, 67, 0.12)',
  },
  rowIcon: {
    width: TILE,
    height: TILE,
    borderRadius: 7,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8E8E93',
  },
  rowIconOn: { backgroundColor: colors.action },
  rowText: { flex: 1, gap: 1 },
  rowLabel: { ...type.body, fontSize: 17, color: colors.text },
  rowCaption: { ...type.caption, color: colors.subtle },

  // Kept well clear of the switches: nothing that ends a session should be
  // reachable by a thumb that was flicking toggles.
  signOut: { marginTop: space.gulf },
  signOutRow: { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  signOutText: { ...type.body, fontSize: 17, ...fontFor(400), color: colors.dangerInk },
});
