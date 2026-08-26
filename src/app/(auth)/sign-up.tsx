import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';

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
} from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { friendlyAuthError } from '@/lib/domain/auth-error';
import { MIN_PASSWORD_LENGTH, validateCredentials } from '@/lib/domain/credentials';

/**
 * The sibling of the sign-in screen, and built to match it: one card, centred,
 * arriving the same way. Two screens one tap apart that compose or animate
 * differently read as a bug rather than as variety.
 *
 * The line above the card survives where sign-in's did not, because it answers
 * a question that screen never raises: someone deciding whether to create an
 * account needs to know what the account is for.
 */

export default function SignUp() {
  const { signUp } = useAuth();
  const router = useRouter();
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
      await signUp(validated.phone, password, fullName.trim());
      router.replace('/');
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

  return (
    <Screen center>
      {/* Wrapping siblings costs them the screen's gap; this gives it back. */}
      <Reveal style={styles.headingBlock}>
        <Title>Create account</Title>
        <Subtle>Track your laundry with your favourite shops</Subtle>
      </Reveal>

      <Reveal delay={REVEAL_STAGGER_MS}>
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
          <Button
            title={isSubmitting ? 'Creating account…' : 'Create account'}
            onPress={handleSubmit}
            disabled={isSubmitting}
          />
        </Card>
      </Reveal>

      <Reveal delay={REVEAL_STAGGER_MS * 2}>
        <Link href="/sign-in">
          <Subtle>Sign in instead</Subtle>
        </Link>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headingBlock: { gap: 4 },
});
