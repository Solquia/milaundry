import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { GLASS_EDGE, GLASS_FILL_DENSE, glassPane, useIsGlass } from '@/components/glass';
import { Button, ErrorText, colors, space, type } from '@/components/ui-kit';
import { parseTypedCode, typedCodeCopy } from '@/lib/domain/scan-entry';

interface TypedCodeFormProps {
  /** Receives the raw link, so the caller feeds it to the same path the camera does. */
  onCode: (raw: string) => void;
  isBusy?: boolean;
  /** A problem the caller found after the code was accepted (server refused it). */
  problem?: string;
  /** Which links count as a code; the customer's scanner by default. */
  accepts?: (raw: string) => boolean;
  /** Words for a scanner that reads something other than the customer's codes. */
  copy?: Partial<ReturnType<typeof typedCodeCopy>>;
}

/** The browser's stand-in for the camera: paste the link printed under the square. */
export function TypedCodeForm({
  onCode,
  isBusy = false,
  problem = '',
  accepts = (raw) => parseTypedCode(raw) !== null,
  copy: override,
}: TypedCodeFormProps) {
  const copy = { ...typedCodeCopy(), ...override };
  const [raw, setRaw] = useState('');
  const [invalid, setInvalid] = useState('');
  const isGlass = useIsGlass();

  const submit = () => {
    if (!accepts(raw.trim())) {
      setInvalid(copy.invalid);
      return;
    }
    setInvalid('');
    onCode(raw.trim());
  };

  return (
    <View style={[styles.card, isGlass && styles.cardGlass]}>
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
        style={[styles.input, isGlass && styles.inputGlass]}
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
  // The customer app's frosted version; merchant and signed-out scanners keep the white.
  cardGlass: { ...glassPane, borderRadius: 16 },
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
  inputGlass: { backgroundColor: GLASS_FILL_DENSE, borderColor: GLASS_EDGE },
});
