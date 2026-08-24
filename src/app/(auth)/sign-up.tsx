import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';

import { Button, Card, ErrorText, Field, Screen, Subtle, Title } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { validateCredentials } from '@/lib/domain/credentials';

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
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <Title>Create account</Title>
      <Subtle>Track your laundry with your favorite shops</Subtle>
      <Card>
        <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Juan Dela Cruz" />
        <Field
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="0917 123 4567"
          autoCapitalize="none"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 8 characters"
        />
        <ErrorText>{error}</ErrorText>
        <Button
          title={isSubmitting ? 'Creating…' : 'Create account'}
          onPress={handleSubmit}
          disabled={isSubmitting}
        />
      </Card>
      <Link href="/sign-in">
        <Subtle>Already have an account? Sign in</Subtle>
      </Link>
    </Screen>
  );
}
