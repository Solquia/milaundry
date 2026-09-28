import { useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { PhotoCodeButton } from '@/components/photo-code-button';
import { TypedCodeForm } from '@/components/typed-code-form';
import { Button, ErrorText, Screen, Subtle, Title } from '@/components/ui-kit';
import { getOrder } from '@/lib/api';
import {
  merchantScanCopy,
  merchantScanFailure,
  merchantScanRoute,
  readMerchantCode,
} from '@/lib/domain/merchant-scan';
import { scanEntryMode } from '@/lib/domain/scan-entry';
import { SCAN_RETRY_MS } from '@/lib/domain/welcome-flow';
import { useActiveShop } from '@/lib/use-active-shop';

/**
 * The counter's scanner: point at the tag on a bag (or a customer's receipt)
 * and the order opens. Nothing is claimed; the order is read through the
 * shop's own session, so a tag from another shop simply does not open.
 */
export default function ScanTag() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { shop } = useActiveShop();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const [isLooking, setIsLooking] = useState(false);
  const isHandlingRef = useRef(false);
  const copy = merchantScanCopy();
  // Merchant tabs stay mounted: a camera left reading behind the order it
  // just opened would open that order again, so it only runs while shown.
  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  /** Shows the problem, then lets the camera read again after a beat. */
  const fail = (message: string) => {
    setError(message);
    setIsLooking(false);
    setTimeout(() => {
      isHandlingRef.current = false;
    }, SCAN_RETRY_MS);
  };

  const handleScanned = async ({ data }: { data: string }) => {
    if (isHandlingRef.current) return;
    isHandlingRef.current = true;
    setError('');

    const code = readMerchantCode(data);
    if (code.kind === 'counter') return fail(copy.counter);
    if (code.kind === 'unknown') return fail(copy.unknown);

    setIsLooking(true);
    try {
      const order = await getOrder(code.orderId);
      if (shop && order.shop_id !== shop.id) return fail(merchantScanFailure(new Error('0 rows')));
      queryClient.setQueryData(['order', order.id], order);
      setIsLooking(false);
      isHandlingRef.current = false;
      router.push(merchantScanRoute(order.id) as never);
    } catch (err: unknown) {
      fail(merchantScanFailure(err));
    }
  };

  const onCode = (raw: string) => void handleScanned({ data: raw });
  const photoButton = <PhotoCodeButton onCode={onCode} onProblem={setError} isBusy={isLooking} />;

  // The browser has no live scanner; a USB barcode gun types into this field
  // just as well as a person pasting the link.
  if (scanEntryMode(Platform.OS) === 'typed') {
    return (
      <Screen>
        <TypedCodeForm
          onCode={onCode}
          isBusy={isLooking}
          problem={error}
          accepts={(raw) => readMerchantCode(raw).kind === 'order'}
          copy={{ title: copy.typedTitle, hint: copy.typedHint, invalid: copy.unknown }}
        />
        {photoButton}
      </Screen>
    );
  }

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <Screen>
        <Title>Camera access needed</Title>
        <Subtle>{copy.camera}</Subtle>
        <Button title="Allow camera" onPress={requestPermission} />
        {photoButton}
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      {isFocused ? (
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={isLooking ? undefined : handleScanned}
        />
      ) : (
        <View style={styles.camera} />
      )}
      <Subtle>{isLooking ? copy.looking : copy.hint}</Subtle>
      <ErrorText>{error}</ErrorText>
      {photoButton}
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1, borderRadius: 12, overflow: 'hidden' },
});
