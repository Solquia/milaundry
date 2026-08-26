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

/**
 * Motion on this screen answers three questions and nothing else:
 *
 * - *Where do I look?* One arrival, top to bottom, 60ms apart. It is over in
 *   well under a second — a sign-in screen must never make someone wait
 *   through its own choreography.
 * - *Where did these come from?* The saved accounts are read from device
 *   storage after the screen is already up, so they genuinely arrive late.
 *   They stagger as the list they are.
 * - *Did that work?* A removed account leaves, sliding out under the control
 *   that dismissed it, rather than blinking out of existence.
 *
 * Reduce Motion composes the same screen with every entrance already finished.
 */

/** Confident deceleration: fast out of the gate, soft on arrival. */
const ENTER_MS = 420;
const ENTER_EASING = Easing.out(Easing.cubic);
const ENTER_RISE = 14;
/** Between siblings. Capped by how few of them there are. */
const STAGGER_MS = 60;
const ROW_STAGGER_MS = 45;

/** Everything on this screen enters the same way, at its own moment. */
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
  gap,
  children,
}: {
  delay: number;
  isStill: boolean;
  /** Wrapping siblings costs them the screen's own gap; this gives it back. */
  gap?: number;
  children: React.ReactNode;
}) {
  const style = useEntrance(delay, isStill);
  return <Animated.View style={[style, gap ? { gap } : null]}>{children}</Animated.View>;
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
      <Entering delay={0} isStill={isReduceMotion} gap={4}>
        <Title>MiLaundry</Title>
        <Subtle>Sign in with your mobile number or shop username</Subtle>
      </Entering>

      <Entering delay={STAGGER_MS} isStill={isReduceMotion}>
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
      </Entering>

      {/* Logins used on this device: one tap fills the field above. The
          password is never stored, so it is still typed every time. */}
      {savedAccounts.length > 0 && (
        <Entering delay={STAGGER_MS * 2} isStill={isReduceMotion}>
          <Card compact>
            <Text style={styles.savedTitle}>Saved on this device</Text>
            {savedAccounts.map((account, index) => (
              <SavedRow
                key={account.id}
                account={account}
                delay={STAGGER_MS * 2 + index * ROW_STAGGER_MS}
                isStill={isReduceMotion}
                onUse={() => {
                  setLoginInput(account.label);
                  setError('');
                }}
                onForget={() => handleForget(account.id)}
              />
            ))}
            <Subtle>Your password is never saved.</Subtle>
          </Card>
        </Entering>
      )}

      <Entering delay={STAGGER_MS * 3} isStill={isReduceMotion}>
        <Link href="/sign-up">
          <Subtle>No account yet? Create one</Subtle>
        </Link>
      </Entering>
    </Screen>
  );
}

function SavedRow({
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

  // Removing an account is a state change worth explaining: the row leaves in
  // the direction of the control that dismissed it, then the list closes.
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
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(onForget);
  };

  return (
    <Animated.View
      style={[
        styles.savedRow,
        {
          opacity: Animated.multiply(entrance.opacity, exit),
          transform: [
            ...entrance.transform,
            {
              translateX: exit.interpolate({
                inputRange: [0, 1],
                outputRange: [36, 0],
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
        style={({ pressed }) => [styles.savedTap, pressed && styles.savedTapPressed]}
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
        onPress={leave}
      >
        <Ionicons name="close" size={18} color={colors.subtle} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  savedTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  savedTap: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  savedTapPressed: { opacity: 0.6 },
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
