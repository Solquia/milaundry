import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  ErrorText,
  Field,
  PasswordField,
  Screen,
  Subtle,
  Title,
  colors,
} from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { friendlyAuthError } from '@/lib/domain/auth-error';
import { MIN_PASSWORD_LENGTH } from '@/lib/domain/credentials';
import { parseLoginId } from '@/lib/domain/login-id';
import type { SavedAccount } from '@/lib/domain/saved-accounts';
import {
  forgetSavedAccount,
  loadSavedAccounts,
  rememberSignIn,
} from '@/lib/saved-accounts-store';

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  // Device storage is the external system this screen syncs with on open.
  useEffect(() => {
    let isActive = true;
    loadSavedAccounts().then((accounts) => {
      if (isActive) setSavedAccounts(accounts);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const handleSubmit = async () => {
    const loginId = parseLoginId(loginInput);
    if (!loginId) {
      setError('Enter your mobile number (e.g. 0917 123 4567) or shop username.');
      return;
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await signIn(loginInput, password);
      // Only a login that actually worked is worth offering next time.
      await rememberSignIn(loginInput);
      router.replace('/');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? friendlyAuthError(err.message, loginInput.trim())
          : 'Sign in failed'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <Title>MiLaundry</Title>
      <Subtle>Sign in with your mobile number or shop username</Subtle>
      <Card>
        <Field
          label="Mobile number or username"
          value={loginInput}
          onChangeText={setLoginInput}
          placeholder="0917 123 4567 or sparklewash"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <PasswordField
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
        />
        <ErrorText>{error}</ErrorText>
        <Button
          title={isSubmitting ? 'Signing in…' : 'Sign in'}
          onPress={handleSubmit}
          disabled={isSubmitting}
        />
      </Card>
      {/* Logins used on this device: one tap fills the field above. The
          password is never stored, so it is still typed every time. */}
      {savedAccounts.length > 0 && (
        <Card compact>
          <Text style={styles.savedTitle}>Saved on this device</Text>
          {savedAccounts.map((account) => (
            <View key={account.id} style={styles.savedRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Use ${account.label}`}
                onPress={() => {
                  setLoginInput(account.label);
                  setError('');
                }}
                style={({ pressed }) => [styles.savedTap, pressed && { opacity: 0.6 }]}
              >
                <View style={styles.savedIcon}>
                  <Ionicons
                    name={account.kind === 'phone' ? 'call' : 'storefront'}
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.savedLabel} numberOfLines={1}>
                  {account.label}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${account.label}`}
                hitSlop={10}
                onPress={() => forgetSavedAccount(account.id).then(setSavedAccounts)}
              >
                <Ionicons name="close" size={18} color={colors.subtle} />
              </Pressable>
            </View>
          ))}
          <Subtle>Your password is never saved.</Subtle>
        </Card>
      )}

      <Link href="/sign-up">
        <Subtle>No account yet? Create one</Subtle>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  savedTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  savedTap: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  savedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedLabel: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
});
