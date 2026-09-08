/**
 * The one door from the web into the app.
 *
 * A guest's account has a password nobody knows. That is fine on the web,
 * where the tracking link is the key, and useless in the app, which asks for
 * one. So the tracking page offers to set one, once, and then says exactly
 * what to type into the app.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorText, PasswordField, colors, space, type } from '@/components/ui-kit';
import { setOwnPassword } from '@/lib/api';
import { MIN_PASSWORD_LENGTH } from '@/lib/domain/credentials';
import type { StorefrontTheme } from '@/lib/domain/web-theme';

interface PasswordCardProps {
  /** The number the account signs in with, shown back so they know what to type. */
  phone: string;
  onDone: () => void;
  theme: StorefrontTheme;
}

export function PasswordCard({ phone, onDone, theme }: PasswordCardProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setError('');
    setIsBusy(true);
    try {
      await setOwnPassword(password);
      setIsSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the password.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <View style={[styles.card, { borderColor: theme.brand, backgroundColor: theme.brandSoft }]}>
      {isSaved ? (
        <>
          <Text style={[styles.title, { color: theme.brandInk }]}>You&apos;re set for the app</Text>
          <Text style={styles.body}>
            Install MiLaundry and sign in with {phone || 'your number'} and the password you just chose.
          </Text>
          <Pressable accessibilityRole="button" onPress={onDone}>
            <Text style={[styles.link, { color: theme.brandInk }]}>Done</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.title, { color: theme.brandInk }]}>Want the app?</Text>
          <Text style={styles.body}>
            Keep this link to follow your order here. Or set a password and use the MiLaundry
            app with {phone || 'your number'}.
          </Text>
          <PasswordField
            value={password}
            onChangeText={setPassword}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            autoComplete="new-password"
          />
          <ErrorText>{error}</ErrorText>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => void handleSave()}
              style={({ pressed }) => [styles.save, { backgroundColor: theme.brand, opacity: isBusy ? 0.6 : pressed ? 0.8 : 1 }]}
            >
              <Text style={[styles.saveText, { color: theme.onBrand }]}>{isBusy ? 'Saving…' : 'Set password'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onDone} style={styles.skip}>
              <Text style={[styles.link, { color: theme.brandInk }]}>Not now</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: space.room, gap: space.snug },
  title: { ...type.section },
  body: { ...type.caption, color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  save: { minHeight: 44, borderRadius: 12, paddingHorizontal: space.room, justifyContent: 'center' },
  saveText: { ...type.label },
  skip: { minHeight: 44, justifyContent: 'center' },
  link: { ...type.label },
});
