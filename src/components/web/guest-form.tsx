/**
 * Who is booking: a name and a mobile number, nothing more.
 *
 * Submitting starts a session through the guest-session function. When the
 * number already has an account the form grows a password field and asks
 * for it, because a number alone must never sign in as someone else. Once a
 * session exists `onSignedIn` runs, so the page can carry straight on with
 * whatever the customer was doing: placing the order, opening their order.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorText, Field, PasswordField, PhoneField, colors, space, type } from '@/components/ui-kit';
import { signInGuest, startGuestSession } from '@/lib/api';
import {
  friendlyGuestError,
  validateGuestDetails,
  welcomeBackNotice,
} from '@/lib/domain/guest-identity';
import type { StorefrontTheme } from '@/lib/domain/web-theme';

interface GuestFormProps {
  /** What the button says: "Book now", "Show my order". */
  submitLabel: string;
  busyLabel: string;
  onSignedIn: () => Promise<void> | void;
  theme: StorefrontTheme;
}

export function GuestForm({ submitLabel, busyLabel, onSignedIn, theme }: GuestFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [knownPhone, setKnownPhone] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const handleSubmit = async () => {
    const details = validateGuestDetails(name, phone);
    if (!details.ok) {
      setError(details.message);
      return;
    }
    setError('');
    setIsBusy(true);
    try {
      if (knownPhone === details.phone) {
        await signInGuest(details.phone, password);
      } else {
        const outcome = await startGuestSession(details.phone, details.name);
        if (outcome === 'needs-password') {
          setKnownPhone(details.phone);
          setIsBusy(false);
          return;
        }
      }
      await onSignedIn();
    } catch (err: unknown) {
      setError(friendlyGuestError(err instanceof Error ? err.message : ''));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <Field label="Your name" value={name} onChangeText={setName} placeholder="Juan Dela Cruz" autoComplete="name" />
      {/* A different number is a different question: drop the password
          prompt, the typed password, and any stale error with it. */}
      <PhoneField
        value={phone}
        onChangeText={(next) => {
          setPhone(next);
          setKnownPhone(null);
          setPassword('');
          setError('');
        }}
      />
      {knownPhone ? (
        <>
          <Text style={[styles.notice, { backgroundColor: theme.brandSoft, color: theme.brandInk }]}>
            {welcomeBackNotice(knownPhone)}
          </Text>
          <PasswordField
            value={password}
            onChangeText={setPassword}
            placeholder="Your MiLaundry password"
            autoComplete="current-password"
          />
        </>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isBusy }}
        disabled={isBusy}
        onPress={handleSubmit}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: theme.brand, opacity: isBusy ? 0.6 : pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.submitText, { color: theme.onBrand }]}>{isBusy ? busyLabel : submitLabel}</Text>
      </Pressable>
      {knownPhone ? null : (
        <Text style={styles.fine}>
          No password needed. The shop gets your name and number so they can reach you about
          this laundry.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.cosy },
  notice: { ...type.caption, padding: space.cosy, borderRadius: 10, overflow: 'hidden' },
  submit: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitText: { ...type.label, fontSize: 16 },
  fine: { ...type.caption, color: colors.subtle },
});
