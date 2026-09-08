import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, ErrorText, colors, space, type } from '@/components/ui-kit';
import { parseTypedCode, typedCodeCopy } from '@/lib/domain/scan-entry';

interface TypedCodeFormProps {
  /** Receives the raw link, so the caller feeds it to the same path the camera does. */
  onCode: (raw: string) => void;
  isBusy?: boolean;
  /** A problem the caller found after the code was accepted (server refused it). */
  problem?: string;
}

/** The browser's stand-in for the camera: paste the link printed under the square. */
export function TypedCodeForm({ onCode, isBusy = false, problem = '' }: TypedCodeFormProps) {
  const copy = typedCodeCopy();
  const [raw, setRaw] = useState('');
  const [invalid, setInvalid] = useState('');

  const submit = () => {
    if (!parseTypedCode(raw)) {
      setInvalid(copy.invalid);
      return;
    }
    setInvalid('');
    onCode(raw.trim());
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.hint}>{copy.hint}</Text>
      <TextInput
        accessibilityLabel={copy.title}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder={copy.placeholder}
        placeholderTextColor={colors.subtle}
        value={raw}
        onChangeText={(text) => {
          setRaw(text);
          if (invalid) setInvalid('');
        }}
        onSubmitEditing={submit}
        style={styles.input}
      />
      <ErrorText>{invalid || problem}</ErrorText>
      <Button title={isBusy ? 'One moment…' : copy.submit} onPress={submit} disabled={isBusy || !raw.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: space.room,
    gap: space.snug,
    width: '100%',
  },
  title: { ...type.title, color: colors.text },
  hint: { ...type.body, color: colors.subtle },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: space.cosy,
    color: colors.text,
    backgroundColor: colors.bg,
  },
});
