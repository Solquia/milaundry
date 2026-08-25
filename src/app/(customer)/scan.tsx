import { useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, ErrorText, Screen, Subtle, Title } from '@/components/ui-kit';
import { claimOrder, registerWithShop } from '@/lib/api';
import { parseQrPayload } from '@/lib/domain/qr';

export default function ScanQr() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const isHandlingRef = useRef(false);

  const handleScanned = async ({ data }: { data: string }) => {
    if (isHandlingRef.current) return;
    isHandlingRef.current = true;
    setError('');

    const payload = parseQrPayload(data);
    if (!payload) {
      setError('That QR code is not a MiLaundry code.');
      setTimeout(() => {
        isHandlingRef.current = false;
      }, 1500);
      return;
    }

    try {
      if (payload.type === 'shop') {
        await registerWithShop(payload.id, payload.token);
        await queryClient.invalidateQueries({ queryKey: ['registered-shops'] });
        // Land on the shop's home page so its services are one tap away.
        router.replace(`/(customer)/shop/${payload.id}` as never);
      } else {
        await claimOrder(payload.id, payload.token);
        await queryClient.invalidateQueries({ queryKey: ['my-orders'] });
        await queryClient.invalidateQueries({ queryKey: ['registered-shops'] });
        router.replace(`/(customer)/order/${payload.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Scan failed');
      setTimeout(() => {
        isHandlingRef.current = false;
      }, 1500);
    }
  };

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <Screen>
        <Title>Camera access needed</Title>
        <Subtle>
          MiLaundry uses the camera to scan shop and order QR codes.
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
      <Subtle>Point the camera at a MiLaundry shop or order QR code.</Subtle>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1, borderRadius: 12, overflow: 'hidden' },
});
