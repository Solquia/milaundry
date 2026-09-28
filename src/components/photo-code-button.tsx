import { Ionicons } from '@expo/vector-icons';
import { scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, space, type } from '@/components/ui-kit';
import { codeFromPhoto, photoCodeCopy } from '@/lib/domain/scan-entry';
import { configureQrDecoder } from '@/lib/zxing-local';

/** A decoder that never loads must end in a message, not a spinner forever. */
const DECODE_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('QR decode timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

interface PhotoCodeButtonProps {
  /** Receives the decoded link, so the caller feeds it to the same path the camera does. */
  onCode: (raw: string) => void;
  /** A photo held no code, or could not be opened. */
  onProblem: (message: string) => void;
  isBusy?: boolean;
  /** `dark` sits on the scan screen's navy; `light` on an ordinary card. */
  tone?: 'light' | 'dark';
}

/**
 * The code, read from a photo instead of a live camera: a receipt photographed
 * earlier, a screenshot, a code sent in a chat. The library is opened, the
 * square is decoded on the device, and the link goes where a scan would.
 */
export function PhotoCodeButton({ onCode, onProblem, isBusy = false, tone = 'light' }: PhotoCodeButtonProps) {
  const copy = photoCodeCopy();
  const [isReading, setIsReading] = useState(false);
  const isDisabled = isBusy || isReading;
  const ink = tone === 'dark' ? colors.onAccent : colors.primary;

  const pick = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (picked.canceled) return;

    setIsReading(true);
    try {
      configureQrDecoder();
      const results = await withTimeout(scanFromURLAsync(picked.assets[0].uri, ['qr']), DECODE_TIMEOUT_MS);
      const code = codeFromPhoto(results);
      if (code) onCode(code);
      else onProblem(copy.none);
    } catch {
      onProblem(copy.unreadable);
    } finally {
      setIsReading(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: isReading }}
      disabled={isDisabled}
      onPress={() => void pick()}
      style={({ pressed }) => [
        styles.button,
        { borderColor: ink },
        (pressed || isDisabled) && styles.dimmed,
      ]}
    >
      {isReading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <Ionicons name="image-outline" size={20} color={ink} />
      )}
      <Text style={[styles.label, { color: ink }]}>{isReading ? copy.busy : copy.action}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.snug,
    minHeight: 48,
    paddingHorizontal: space.room,
    borderRadius: 999,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignSelf: 'stretch',
  },
  label: { ...type.label },
  dimmed: { opacity: 0.6 },
});
