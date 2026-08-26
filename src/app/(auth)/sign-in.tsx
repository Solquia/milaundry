import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { REVEAL_STAGGER_MS, Reveal } from '@/components/reveal';
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
  space,
  type,
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
import { useReducedMotion } from '@/lib/use-reduced-motion';

/**
 * One card, and every line on it earns its place.
 *
 * The brand used to head this screen and the sentence under it repeated the
 * field label directly below — the splash already says who we are, so the
 * screen says only what it is. Saved accounts sit under the field they fill
 * rather than in a second card below the button: a control and its effect
 * belong next to each other, and one card reads as one task.
 */

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

  const handleForget = useCallback(
    (id: string) => forgetSavedAccount(id).then(setSavedAccounts),
    []
  );

  return (
    <Screen center>
      <Reveal>
        <Title>Sign in</Title>
      </Reveal>

      <Reveal delay={REVEAL_STAGGER_MS}>
        <Card>
          <Field
            label="Mobile number or username"
            value={loginInput}
            onChangeText={setLoginInput}
            placeholder="0917 123 4567"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Under the field they fill, not in a box below the button. */}
          {savedAccounts.length > 0 && (
            <View style={styles.saved}>
              <Text style={styles.savedNote}>
                Saved on this device. Passwords are never saved.
              </Text>
              <View style={styles.chipRow}>
                {savedAccounts.map((account, index) => (
                  <Reveal key={account.id} delay={REVEAL_STAGGER_MS * (index + 2)}>
                    <AccountChip
                      account={account}
                      onUse={() => {
                        setLoginInput(account.label);
                        setError('');
                      }}
                      onForget={() => handleForget(account.id)}
                    />
                  </Reveal>
                ))}
              </View>
            </View>
          )}

          <PasswordField value={password} onChangeText={setPassword} />
          <ErrorText>{error}</ErrorText>
          <Button
            title={isSubmitting ? 'Signing in…' : 'Sign in'}
            onPress={handleSubmit}
            disabled={isSubmitting}
          />
        </Card>
      </Reveal>

      <Reveal delay={REVEAL_STAGGER_MS * 2}>
        <Link href="/sign-up">
          <Subtle>Create an account</Subtle>
        </Link>
      </Reveal>
    </Screen>
  );
}

function AccountChip({
  account,
  onUse,
  onForget,
}: {
  account: SavedAccount;
  onUse: () => void;
  onForget: () => void;
}) {
  const isReduced = useReducedMotion();
  const [exit] = useState(() => new Animated.Value(1));
  const isLeavingRef = useRef(false);

  // Removing an account is a state change worth explaining: the chip shrinks
  // away under the control that dismissed it, and the row closes after it has
  // gone rather than pulling the gap shut underneath it.
  const leave = () => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;

    if (isReduced) {
      onForget();
      return;
    }
    Animated.timing(exit, {
      toValue: 0,
      // Exits are quicker than entrances — the decision is already made.
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(onForget);
  };

  return (
    <Animated.View
      style={[
        styles.chip,
        {
          opacity: exit,
          transform: [
            { scale: exit.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Use ${account.label}`}
        onPress={onUse}
        style={({ pressed }) => [styles.chipTap, pressed && styles.chipPressed]}
      >
        <Ionicons
          name={account.kind === 'phone' ? 'call' : 'storefront'}
          size={13}
          color={colors.actionInk}
        />
        <Text style={styles.chipLabel} numberOfLines={1}>
          {account.label}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${account.label}`}
        hitSlop={12}
        onPress={leave}
        style={({ pressed }) => pressed && styles.chipPressed}
      >
        <Ionicons name="close" size={14} color={colors.subtle} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  saved: { gap: space.snug },
  savedNote: { ...type.caption, color: colors.subtle },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    height: 40,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 20,
    backgroundColor: colors.actionSurface,
    borderWidth: 1,
    borderColor: colors.actionMuted,
  },
  chipTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    // The chip is the target; it is only as wide as the number it holds.
    maxWidth: 220,
  },
  chipPressed: { opacity: 0.6 },
  chipLabel: { ...type.label, color: colors.actionInk, flexShrink: 1 },
});
