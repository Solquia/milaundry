import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { Button, ErrorText, Loading, Screen, Subtle, Title } from '@/components/ui-kit';
import { peekScan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { HAND_OFF_ROUTE, type LinkLanding, linkLanding } from '@/lib/domain/link-landing';
import type { QrPayload, QrPayloadType } from '@/lib/domain/qr';
import { routeAfterScan, scanFailure } from '@/lib/domain/scan-outcome';
import { scanProblem } from '@/lib/domain/welcome-flow';
import { setPendingScan } from '@/lib/pending-scan-store';
import { useSignedInScan } from '@/lib/use-signed-in-scan';

/**
 * Where a printed link lands inside the app.
 *
 * Android and iOS open the app for `/join/<id>` and `/claim/<id>` once the
 * host vouches for it. A signed-in customer is connected or claimed on the
 * spot and taken where the scan was pointing; a signed-out one is handed to
 * sign-in with the scan waiting, the same way the front-door camera does it.
 * A cold start races session restore, so nothing is decided while the
 * session is still loading.
 */
export function NativeLinkLanding({ type }: { type: QrPayloadType }) {
  const params = useLocalSearchParams<{ id?: string; token?: string | string[] }>();
  const { session, isLoading } = useAuth();
  const landing = linkLanding({
    type,
    id: params.id,
    token: params.token,
    platform: Platform.OS,
    isAuthLoading: isLoading,
    hasSession: Boolean(session),
  });
  const { error, retry } = useLinkLanding(landing);
  const router = useRouter();
  const goHome = () => router.replace('/' as never);

  if (landing.kind === 'malformed') {
    return (
      <Screen>
        <Title>This code is incomplete</Title>
        <Subtle>Scan the code again, or ask the shop for a fresh one.</Subtle>
        <Button title="Open MiLaundry" onPress={goHome} />
      </Screen>
    );
  }
  if (!error) return <Loading />;
  return (
    <Screen>
      <Title>We could not finish that</Title>
      <ErrorText>{error}</ErrorText>
      <Button title="Try again" onPress={retry} />
      <Button title="Open MiLaundry" onPress={goHome} />
    </Screen>
  );
}

/** Runs the landing's side effect once per scan, and reports its failure. */
function useLinkLanding(landing: LinkLanding) {
  const router = useRouter();
  const finish = useSignedInScan();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const startedRef = useRef<string | null>(null);

  const scan = landing.kind === 'finish' || landing.kind === 'hand-off' ? landing.scan : null;
  const key = scan ? `${landing.kind}:${scan.id}:${attempt}` : null;

  useEffect(() => {
    if (!scan || !key || startedRef.current === key) return;
    startedRef.current = key;
    setError('');

    const run = landing.kind === 'finish' ? finishNow(scan, finish) : handOff(scan);
    run
      .then((route) => router.replace(route as never))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : scanProblem('network')));
  }, [key, scan, landing.kind, finish, router]);

  return { error, retry: () => setAttempt((n) => n + 1) };
}

async function finishNow(scan: QrPayload, finish: (scan: QrPayload) => Promise<void>): Promise<string> {
  try {
    await finish(scan);
  } catch (err: unknown) {
    throw new Error(scanFailure(scan, err));
  }
  return routeAfterScan(scan);
}

/** Looks the code up so the forms can greet by name, then keeps it for them. */
async function handOff(scan: QrPayload): Promise<string> {
  let shop;
  try {
    shop = await peekScan(scan.type, scan.id, scan.token);
  } catch {
    throw new Error(scanProblem('network'));
  }
  if (!shop) throw new Error(scanProblem('inactive'));
  setPendingScan({ ...scan, shop });
  return HAND_OFF_ROUTE;
}
