import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';

import {
  Button,
  Card,
  ErrorText,
  PasswordField,
  PhoneField,
  Screen,
  Subtle,
  Title,
} from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { friendlyAuthError } from '@/lib/domain/auth-error';
import { validateCredentials } from '@/lib/domain/credentials';

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const validated = validateCredentials(phone, password);
    if (!validated.ok) {
      setError(validated.message);
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await signIn(validated.phone, password);
      router.replace('/');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? friendlyAuthError(err.message, validated.phone)
          : 'Sign in failed'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <Title>MiLaundry</Title>
      <Subtle>Sign in with your mobile number</Subtle>
      <Card>
        <PhoneField value={phone} onChangeText={setPhone} />
        <PasswordField
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
        />
        <ErrorText>{error}</ErrorText>
        <Button title={isSubmitting ? 'Signing in…' : 'Sign in'} onPress={handleSubmit} disabled={isSubmitting} />
      </Card>
      <Link href="/sign-up">
        <Subtle>No account yet? Create one</Subtle>
      </Link>
    </Screen>
  );
}
