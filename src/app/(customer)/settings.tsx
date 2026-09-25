import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { AddressBook, type AddressDraftOut } from '@/components/address-book';
import { BlueField } from '@/components/blue-field';
import { LaundryPreferencesCard } from '@/components/laundry-preferences';
import { PaymentPreferenceCard } from '@/components/payment-preference-card';
import { Button, Screen, colors, elevation, space, type } from '@/components/ui-kit';
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

      <View style={styles.signOut}>
        <Button title="Sign out" variant="danger" onPress={confirmSignOut} />
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
      style={({ pressed }) => [
        styles.row,
        !isFirst && styles.rowDivided,
        pressed && { backgroundColor: colors.sunken },
      ]}
    >
      <View style={[styles.rowIcon, isOn && styles.rowIconOn]}>
        <Ionicons
          name={row.icon as never}
          size={18}
          color={isOn ? colors.actionInk : colors.subtle}
        />
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
        trackColor={{ false: colors.borderStrong, true: colors.action }}
        thumbColor={colors.card}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * The identity card. The field is absolutely positioned inside it, so the
   * card clips it — the same living blue the home stands on, cut to a corner.
   */
  profile: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: space.section,
    gap: space.room,
    marginBottom: space.snug,
    ...elevation.hero,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: space.room },
  /** Where a photograph would be, if the product ever asks for one. */
  disc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.34)',
  },
  discText: { ...type.title, fontSize: 24, color: colors.onAccent },
  profileWords: { flex: 1, gap: 2 },
  profileName: { ...type.title, fontSize: 24, color: colors.onAccent },
  profileLine: { ...type.body, color: 'rgba(255, 255, 255, 0.88)' },
  profileFacts: { ...type.caption, color: 'rgba(255, 255, 255, 0.78)' },

  sectionLabel: {
    ...type.label,
    fontSize: 11,
    color: colors.subtle,
    letterSpacing: 0.8,
    marginBottom: space.snug,
    marginTop: space.section,
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    ...elevation.rest,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.room,
  },
  // A hairline between rows only — a border around each would turn one group
  // of related switches into three separate objects.
  rowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  rowIconOn: { backgroundColor: colors.actionSurface },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...type.body, fontWeight: '600', color: colors.text },
  rowCaption: { ...type.caption, color: colors.subtle },

  // Kept well clear of the switches: nothing that ends a session should be
  // reachable by a thumb that was flicking toggles.
  signOut: { marginTop: space.gulf },
});
