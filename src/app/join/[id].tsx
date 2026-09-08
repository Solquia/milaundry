/**
 * Where the counter code lands when a phone camera, not the app, reads it.
 *
 * The code is https://<host>/join/<shop-id>?token=…. In the app the scanner
 * never comes here: it parses the value and connects the account. In a
 * browser this route asks the server which shop the code belongs to and
 * sends the customer to that shop's page. A code the server does not vouch
 * for — an inactive shop, a wrong token — says so instead of guessing.
 */
import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Loading, colors, space, type } from '@/components/ui-kit';
import { WebShell } from '@/components/web/web-shell';
import { peekScan } from '@/lib/api';

export default function JoinPage() {
  const { id, token } = useLocalSearchParams<{ id: string; token?: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['peek-scan', 'shop', id, token],
    queryFn: () => peekScan('shop', id!, token!),
    enabled: Boolean(id && token),
  });

  if (id && token && isLoading) return <Loading />;
  if (data) return <Redirect href={`/s/${data.slug}` as never} />;

  return (
    <WebShell>
      <View style={styles.notice}>
        <Text style={styles.title}>
          {error ? 'We could not read this code' : 'This code is not active'}
        </Text>
        <Text style={styles.body}>
          {error
            ? 'Check your connection and try again.'
            : 'Ask the shop for a fresh code, or search for them on MiLaundry.'}
        </Text>
      </View>
    </WebShell>
  );
}

const styles = StyleSheet.create({
  notice: { padding: space.gulf, gap: space.snug, marginTop: space.gulf * 2 },
  title: { ...type.title, color: colors.text, textAlign: 'center' },
  body: { ...type.body, color: colors.subtle, textAlign: 'center' },
});
