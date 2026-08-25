import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';

import {
  Button,
  Card,
  ErrorText,
  Field,
  PasswordField,
  Screen,
  Subtle,
  Title,
} from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { friendlyAuthError } from '@/lib/domain/auth-error';
import { MIN_PASSWORD_LENGTH } from '@/lib/domain/credentials';
import { parseLoginId } from '@/lib/domain/login-id';

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <Link href="/sign-up">
        <Subtle>No account yet? Create one</Subtle>
      </Link>
    </Screen>
  );
}
