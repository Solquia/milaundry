import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { HandoffNote } from '@/components/handoff-note';
import { REVEAL_STAGGER_MS, Reveal } from '@/components/reveal';
import {
  Button,
  Card,
  ErrorText,
  Field,
  PasswordField,
  PhoneField,
  Screen,
  Subtle,
  Title,
  colors,
  space,
  type,
} from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { friendlyAuthError } from '@/lib/domain/auth-error';
import { MIN_PASSWORD_LENGTH, validateCredentials } from '@/lib/domain/credentials';
import { peekPendingScan } from '@/lib/pending-scan-store';
import { useFinishScan } from '@/lib/use-finish-scan';

/**
 * The sibling of the sign-in screen, and built to match it: one card, centred,
 * arriving the same way. Two screens one tap apart that compose or animate
 * differently read as a bug rather than as variety.
 *
 * The line above the card survives where sign-in's did not, because it answers
 * a question that screen never raises: someone deciding whether to create an
 * account needs to know what the account is for. When a scan brought them
 * here, the answer is the laundry they just scanned, and the connection is
 * made for them the moment the account exists.
 */

export default function SignUp() {
  const { signUp } = useAuth();
  const router = useRouter();
  const pendingScan = peekPendingScan();
  const finishScan = useFinishScan();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      setError('Enter your full name.');
      return;
    }
    const validated = validateCredentials(phone, password);
    if (!validated.ok) {
      setError(validated.message);
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const signedUp = await signUp(validated.phone, password, fullName.trim());
      const destination = await finishScan(signedUp?.role);
      router.replace(destination as never);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? friendlyAuthError(err.message, validated.phone)
          : 'Sign up failed'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/welcome' as never);
  };

  const purpose = pendingScan
    ? `Follow every load you leave at ${pendingScan.shop.name}`
    : 'Track your laundry with your favourite shops';

  const submitTitle = isSubmitting
    ? 'Creating account…'
    : !pendingScan
      ? 'Create account'
      : pendingScan.type === 'order'
        ? 'Create account & claim'
        : 'Create account & connect';

  return (
    <Screen center>
      {/* Wrapping siblings costs them the screen's gap; this gives it back. */}
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
        <Title>Create account</Title>
        <Subtle>{purpose}</Subtle>
      </Reveal>

      {pendingScan && (
        <Reveal delay={REVEAL_STAGGER_MS}>
          <HandoffNote scan={pendingScan} />
        </Reveal>
      )}

      <Reveal delay={REVEAL_STAGGER_MS * (pendingScan ? 2 : 1)}>
        <Card>
          <Field
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Juan Dela Cruz"
          />
          <PhoneField value={phone} onChangeText={setPhone} />
          <PasswordField
            value={password}
            onChangeText={setPassword}
            // A rule, not a restatement of the label: this is the one place the
            // requirement can be read before it is enforced.
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          />
          <ErrorText>{error}</ErrorText>
          <Button title={submitTitle} onPress={handleSubmit} disabled={isSubmitting} />
        </Card>
      </Reveal>

      <Reveal delay={REVEAL_STAGGER_MS * 3}>
        <Link href="/sign-in">
          <Subtle>Already have an account? Sign in</Subtle>
        </Link>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headingBlock: { gap: 4 },
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
});
