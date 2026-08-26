import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Button,
  Card,
  ErrorText,
  Field,
  PasswordField,
  Screen,
  Subtle,
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

/**
 * One card, and every line in it earns its place.
 *
 * The brand used to head this screen and the sentence under it repeated the
 * field label directly below — the splash already says who we are, so the
 * screen says only what it is. Saved accounts moved from a second card beneath
 * the button to directly under the field they fill: a control and its effect
 * belong next to each other, and one card reads as one task.
 *
 * Motion answers three questions and nothing else — where to look, where the
 * saved accounts came from (they arrive from storage after the screen is up),
 * and whether a removal worked. Reduce Motion composes the same screen with
 * every entrance already finished.
 */

/** Confident deceleration: fast out of the gate, soft on arrival. */
const ENTER_MS = 420;
const ENTER_EASING = Easing.out(Easing.cubic);
const ENTER_RISE = 14;
const STAGGER_MS = 60;
const CHIP_STAGGER_MS = 45;

function useEntrance(delay: number, isStill: boolean) {
  const [value] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isStill) {
      value.setValue(1);
      return;
    }
    const animation = Animated.timing(value, {
      toValue: 1,
      duration: ENTER_MS,
      delay,
      easing: ENTER_EASING,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [value, delay, isStill]);

  return {
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [ENTER_RISE, 0],
        }),
      },
    ],
  };
}

function Entering({
  delay,
  isStill,
  children,
}: {
  delay: number;
  isStill: boolean;
  children: React.ReactNode;
}) {
  const style = useEntrance(delay, isStill);
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [isReduceMotion, setIsReduceMotion] = useState(false);

  useEffect(() => {
    let isActive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isActive) setIsReduceMotion(enabled);
    });
    return () => {
      isActive = false;
    };
  }, []);

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
      <Entering delay={0} isStill={isReduceMotion}>
        <Text style={styles.heading}>Sign in</Text>
      </Entering>

      <Entering delay={STAGGER_MS} isStill={isReduceMotion}>
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
                  <AccountChip
                    key={account.id}
                    account={account}
                    delay={STAGGER_MS + index * CHIP_STAGGER_MS}
                    isStill={isReduceMotion}
                    onUse={() => {
                      setLoginInput(account.label);
                      setError('');
                    }}
                    onForget={() => handleForget(account.id)}
                  />
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
      </Entering>

      <Entering delay={STAGGER_MS * 2} isStill={isReduceMotion}>
        <Link href="/sign-up">
          <Subtle>Create an account</Subtle>
        </Link>
      </Entering>
    </Screen>
  );
}

function AccountChip({
  account,
  delay,
  isStill,
  onUse,
  onForget,
}: {
  account: SavedAccount;
  delay: number;
  isStill: boolean;
  onUse: () => void;
  onForget: () => void;
}) {
  const entrance = useEntrance(delay, isStill);
  const [exit] = useState(() => new Animated.Value(1));
  const isLeavingRef = useRef(false);

  // Removing an account is a state change worth explaining: the chip shrinks
  // away under the control that dismissed it, then the row closes.
  const leave = () => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;

    if (isStill) {
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
          opacity: Animated.multiply(entrance.opacity, exit),
          transform: [
            ...entrance.transform,
            {
              scale: exit.interpolate({
                inputRange: [0, 1],
                outputRange: [0.86, 1],
              }),
            },
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
  heading: { ...type.title, color: colors.text },
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
    // The chip is the target; the row is only as wide as the number it holds.
    maxWidth: 220,
  },
  chipPressed: { opacity: 0.6 },
  chipLabel: {
    ...type.label,
    color: colors.actionInk,
    flexShrink: 1,
  },
});
