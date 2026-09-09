import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { HandoffNote } from '@/components/handoff-note';
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
import { parseSignInMode, savedAccountsFor, signInCopy } from '@/lib/domain/welcome-flow';
import { peekPendingScan } from '@/lib/pending-scan-store';
import {
  forgetSavedAccount,
  loadSavedAccounts,
  rememberSignIn,
} from '@/lib/saved-accounts-store';
import { useFinishScan } from '@/lib/use-finish-scan';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/**
 * One card, and every line on it earns its place.
 *
 * The form speaks in one of two voices. Reached from the welcome's front door
 * it asks a customer for the mobile number they signed up with; reached from
 * "Run a laundry?" it asks an owner for their shop's username. The box accepts
 * either — the parser does not care — but nobody should be asked for a thing
 * they do not have.
 *
 * When a scan brought them here, it rides on top of the card and is finished
 * the moment the session exists. The customer never sees a second step.
 */

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ as?: string | string[] }>();
  const mode = parseSignInMode(params.as);
  const copy = signInCopy(mode);
  const pendingScan = peekPendingScan();
  const finishScan = useFinishScan();

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
      setError(
        mode === 'owner'
          ? 'Enter your shop username (e.g. sparkle-wash).'
          : 'Enter your mobile number (e.g. 0917 123 4567) or shop username.'
      );
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
      const destination = await finishScan();
      router.replace(destination as never);
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

  const switchMode = () => {
    setError('');
    router.setParams({ as: mode === 'owner' ? 'customer' : 'owner' });
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/welcome' as never);
  };

  const shownAccounts = savedAccountsFor(mode, savedAccounts);

  return (
    <Screen center>
      <Reveal style={styles.headingBlock}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={goBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.actionInk} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        {copy.eyebrow && <Text style={styles.eyebrow}>{copy.eyebrow}</Text>}
        <Title>{copy.title}</Title>
      </Reveal>

      {pendingScan && (
        <Reveal delay={REVEAL_STAGGER_MS}>
          <HandoffNote scan={pendingScan} />
        </Reveal>
      )}

      <Reveal delay={REVEAL_STAGGER_MS * (pendingScan ? 2 : 1)}>
        <Card>
          <Field
            label={copy.fieldLabel}
            value={loginInput}
            onChangeText={setLoginInput}
            placeholder={copy.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={mode === 'owner' ? 'default' : 'phone-pad'}
          />

          {/* Under the field they fill, not in a box below the button. */}
          {shownAccounts.length > 0 && (
            <View style={styles.saved}>
              <Text style={styles.savedNote}>
                Saved on this device. Passwords are never saved.
              </Text>
              <View style={styles.chipRow}>
                {shownAccounts.map((account, index) => (
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

      <Reveal delay={REVEAL_STAGGER_MS * 3} style={styles.links}>
        {mode === 'customer' && (
          <Link href="/sign-up">
            <Subtle>New here? Create an account</Subtle>
          </Link>
        )}
        <Subtle onPress={switchMode}>{copy.otherPath}</Subtle>
      </Reveal>

      {mode === 'owner' && (
        <Reveal delay={REVEAL_STAGGER_MS * 4}>
          <View style={styles.ownerHelp}>
            <Ionicons name="storefront-outline" size={18} color={colors.actionInk} />
            <View style={styles.ownerHelpCopy}>
              <Text style={styles.ownerHelpTitle}>No shop account yet?</Text>
              <Text style={styles.ownerHelpText}>
                MiLaundry sets each laundry up with its own branded username and a
                temporary password, and hands them to the owner. If you&apos;re
                staff, ask your owner for yours.
              </Text>
            </View>
          </View>
        </Reveal>
      )}
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
  headingBlock: { gap: space.tight },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    marginLeft: -4,
    marginBottom: space.snug,
  },
  backText: { ...type.label, color: colors.actionInk },
  pressed: { opacity: 0.6 },
  eyebrow: {
    ...type.caption,
    fontWeight: '600',
    letterSpacing: 2,
    color: colors.subtle,
  },
  links: { gap: space.cosy, alignItems: 'center' },
  ownerHelp: {
    flexDirection: 'row',
    gap: space.cosy,
    padding: space.room,
    borderRadius: 14,
    backgroundColor: colors.actionSurface,
  },
  ownerHelpCopy: { flex: 1, gap: space.tight },
  ownerHelpTitle: { ...type.label, color: colors.text },
  ownerHelpText: { ...type.caption, fontSize: 13, lineHeight: 18, color: colors.subtle },
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
