import { useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, ErrorText, Screen, Subtle, Title } from '@/components/ui-kit';
import { claimOrder, registerWithShop } from '@/lib/api';
import { parseQrPayload, type QrPayload } from '@/lib/domain/qr';
import { routeAfterScan, scanFailure, scanHint } from '@/lib/domain/scan-outcome';
import { SCAN_RETRY_MS, scanProblem } from '@/lib/domain/welcome-flow';

/**
 * The raised button in the middle of the tab bar. One camera, two codes: the
 * shop's code on the counter connects the customer to that laundry; the code
 * printed on the receipt stapled to their bag claims that load onto their
 * account. Both land where the scan was pointing — the shopfront or the order.
 */
export default function ScanQr() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const isHandlingRef = useRef(false);

  /** Shows the problem, then lets the camera read again after a beat. */
  const fail = (message: string) => {
    setError(message);
    setTimeout(() => {
      isHandlingRef.current = false;
    }, SCAN_RETRY_MS);
  };

  const finish = async (scan: QrPayload) => {
    if (scan.type === 'shop') {
      await registerWithShop(scan.id, scan.token);
      await queryClient.invalidateQueries({ queryKey: ['registered-shops'] });
      return;
    }
    await claimOrder(scan.id, scan.token);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['registered-shops'] }),
      queryClient.invalidateQueries({ queryKey: ['order', scan.id] }),
    ]);
  };

  const handleScanned = async ({ data }: { data: string }) => {
    if (isHandlingRef.current) return;
    isHandlingRef.current = true;
    setError('');

    const scan = parseQrPayload(data);
    if (!scan) {
      fail(scanProblem('not-ours'));
      return;
    }

    try {
      await finish(scan);
      router.replace(routeAfterScan(scan) as never);
    } catch (err: unknown) {
      fail(scanFailure(scan, err));
    }
  };

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <Screen>
        <Title>Camera access needed</Title>
        <Subtle>
          MiLaundry uses the camera to read the code at the counter and the code
          on your receipt.
        </Subtle>
        <Button title="Allow camera" onPress={requestPermission} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScanned}
      />
      <Subtle>{scanHint()}</Subtle>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1, borderRadius: 12, overflow: 'hidden' },
});
