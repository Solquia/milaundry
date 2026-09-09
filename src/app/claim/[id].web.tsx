/**
 * Where a receipt's code lands when a phone camera, not the app, reads it:
 * https://<host>/claim/<order-id>?token=…
 *
 * The token vouches for the code, so the shop's name is shown before anything
 * is asked. A guest gives a name and number, which makes the session; then
 * the load is claimed onto that account and the tracking page opens. Someone
 * already signed in claims in one tap. A receipt already on another account
 * says so, in the same words the app uses.
 *
 * The peek only answers for an unclaimed load, so a claimed receipt shows no
 * shop name. The claim itself is still offered: for the holder it is
 * idempotent and opens their order; for anyone else the server refuses it.
 */
import { useQuery } from '@tanstack/react-query';
import Head from 'expo-router/head';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ACCENTS,
  ErrorText,
  Loading,
  colors,
  formatMoney,
  space,
  type,
} from '@/components/ui-kit';
import { GuestForm } from '@/components/web/guest-form';
import { WebShell } from '@/components/web/web-shell';
import { claimOrder, peekOrder, peekScan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isUuid } from '@/lib/domain/qr';
import { scanFailure } from '@/lib/domain/scan-outcome';
import { formatOrderTime, shortOrderId } from '@/lib/domain/order-card';
import { STATUS_LABELS, type OrderStatus } from '@/lib/domain/order-status';
import {
  receiptAmount,
  receiptLineLabel,
  type PeekedReceipt,
} from '@/lib/domain/receipt-peek';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { claimHeadline, claimInvitation, claimSubmitLabel } from '@/lib/domain/web-claim';
import type { ScannedShop } from '@/lib/domain/welcome-flow';
import { storefrontTheme, type StorefrontTheme } from '@/lib/domain/web-theme';

export default function ClaimPage() {
  const params = useLocalSearchParams<{ id: string; token?: string | string[] }>();
  // A repeated query key arrives as an array; a hand-edited link as anything.
  const id = params.id ?? '';
  const token = (Array.isArray(params.token) ? params.token[0] : params.token) ?? '';
  const isWellFormed = isUuid(id) && isUuid(token);
  const { data: shop, isLoading, error } = useQuery({
    queryKey: ['peek-scan', 'order', id, token],
    queryFn: () => peekScan('order', id, token),
    enabled: isWellFormed,
  });

  if (!isWellFormed) {
    return <Notice title="This code is incomplete" body="Scan the receipt again, or ask the shop for a fresh one." />;
  }
  if (isLoading) return <Loading />;
  if (error) {
    return <Notice title="We could not read this code" body="Check your connection and try again." />;
  }
  return <ClaimBody shop={shop ?? null} orderId={id} token={token} />;
}

function ClaimBody({ shop, orderId, token }: { shop: ScannedShop | null; orderId: string; token: string }) {
  const router = useRouter();
  // The receipt's own contents. Absent for a load already on an account, which
  // is why the card below is conditional rather than assumed.
  const { data: receipt } = useQuery({
    queryKey: ['peek-order', orderId, token],
    queryFn: () => peekOrder(orderId, token),
  });
  const { session, isLoading: isAuthLoading } = useAuth();
  const [error, setError] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const theme = storefrontTheme(ACCENTS[shop ? resolveAccent(shop, ACCENTS.length) : 0]);
  const shopName = shop?.name ?? null;

  /**
   * Runs with a session in hand. Idempotent for the holder, refused for anyone
   * else. Throws the customer-facing sentence, so the guest form can show it
   * in its own error slot; the signed-in button catches it below.
   */
  const claim = async () => {
    try {
      const order = await claimOrder(orderId, token);
      // No welcome flag: whether to offer a password is remembered by the
      // browser that made the guest account, not decided by the route.
      router.replace(`/track/${order.id}` as never);
    } catch (err: unknown) {
      throw new Error(scanFailure({ type: 'order', id: orderId, token }, err));
    }
  };

  const claimSignedIn = async () => {
    setError('');
    setIsClaiming(true);
    try {
      await claim();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '');
      setIsClaiming(false);
    }
  };

  if (isAuthLoading) return <Loading />;

  return (
    <>
      <Head>
        <title>{claimHeadline(shopName)}</title>
      </Head>
      <WebShell>
        <View style={[styles.band, { backgroundColor: theme.brand }]}>
          <Text style={[styles.eyebrow, { color: theme.onBrand }]}>Your receipt</Text>
          <Text style={[styles.title, { color: theme.onBrand }]}>{claimHeadline(shopName)}</Text>
          {shop?.tagline ? <Text style={[styles.tagline, { color: theme.onBrand }]}>{shop.tagline}</Text> : null}
          {!shop ? (
            <Text style={[styles.tagline, { color: theme.onBrand }]}>
              This receipt may already be on an account. If it is yours, carry on and it opens.
            </Text>
          ) : null}
        </View>
        <View style={styles.body}>
          {receipt ? <ReceiptCard receipt={receipt} theme={theme} /> : null}
          <View style={styles.card}>
            {session ? (
              <>
                <Text style={styles.hint}>This load will be added to your account.</Text>
                <ErrorText>{error}</ErrorText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isClaiming }}
                  disabled={isClaiming}
                  onPress={() => void claimSignedIn()}
                  style={({ pressed }) => [
                    styles.submit,
                    { backgroundColor: theme.brand, opacity: isClaiming ? 0.6 : pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text style={[styles.submitText, { color: theme.onBrand }]}>
                    {isClaiming ? 'One moment…' : claimSubmitLabel(true)}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.hint}>{claimInvitation(shopName)}</Text>
                <GuestForm
                  submitLabel={claimSubmitLabel(false)}
                  busyLabel="One moment…"
                  onSignedIn={claim}
                  theme={theme}
                />
              </>
            )}
          </View>
          {shop ? (
            <Pressable accessibilityRole="link" onPress={() => router.push(`/s/${shop.slug}` as never)}>
              <Text style={[styles.link, { color: theme.brandInk }]}>See {shop.name}&apos;s prices and details ›</Text>
            </Pressable>
          ) : null}
        </View>
      </WebShell>
    </>
  );
}


/**
 * The receipt itself, above the button that claims it.
 *
 * A page that says only "this load will be added to your account" asks the
 * customer to attach a slip to their name before they can check it is theirs.
 * These are the lines already printed on the paper in their hand, so the
 * question the page asks is one they can actually answer.
 */
function ReceiptCard({ receipt, theme }: { receipt: PeekedReceipt; theme: StorefrontTheme }) {
  const { amount, label, isEstimate } = receiptAmount(receipt);

  return (
    <View style={styles.receipt}>
      <View style={styles.receiptHead}>
        <Text style={styles.ticket}>{shortOrderId(receipt.id)}</Text>
        <View style={[styles.status, { backgroundColor: theme.brandSoft }]}>
          <Text style={[styles.statusText, { color: theme.brandInk }]}>
            {STATUS_LABELS[receipt.status as OrderStatus] ?? receipt.status}
          </Text>
        </View>
      </View>
      <Text style={styles.taken}>{formatOrderTime(receipt.created_at, new Date())}</Text>

      {receipt.items.map((line, index) => (
        <View key={`${line.service_name}-${index}`} style={styles.line}>
          <Text style={styles.lineName} numberOfLines={2}>
            {receiptLineLabel(line)}
          </Text>
          <Text style={styles.lineAmount}>{formatMoney(line.subtotal)}</Text>
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{label}</Text>
        <Text style={styles.totalAmount}>
          {amount === null ? '—' : formatMoney(amount)}
        </Text>
      </View>
      {/* Said out loud, because the figure above it is not the bill yet. */}
      {isEstimate ? (
        <Text style={styles.estimateNote}>
          The shop weighs your laundry and confirms the price before you pay.
        </Text>
      ) : null}
    </View>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <WebShell>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>{title}</Text>
        <Text style={styles.noticeBody}>{body}</Text>
      </View>
    </WebShell>
  );
}

const styles = StyleSheet.create({
  band: { padding: space.room, gap: space.snug },
  eyebrow: { ...type.caption, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.9 },
  title: { ...type.title },
  tagline: { ...type.body, opacity: 0.9 },
  body: { padding: space.room, gap: space.cosy },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    gap: space.cosy,
  },
  hint: { ...type.body, color: colors.subtle },

  /** The slip itself: ticket and state on one line, then what is on it. */
  receipt: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    gap: space.snug,
  },
  receiptHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.snug,
  },
  ticket: { ...type.label, color: colors.subtle },
  status: { borderRadius: 999, paddingHorizontal: space.snug, paddingVertical: 3 },
  statusText: { ...type.caption },
  taken: { ...type.caption, color: colors.subtle },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.cosy,
    paddingTop: space.snug,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lineName: { ...type.body, color: colors.text, flex: 1 },
  lineAmount: { ...type.body, color: colors.text },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: space.snug,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
  },
  totalLabel: { ...type.label, color: colors.subtle },
  totalAmount: { ...type.value, color: colors.text },
  estimateNote: { ...type.caption, color: colors.subtle },
  submit: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitText: { ...type.label, fontSize: 16 },
  link: { ...type.label, textAlign: 'center', paddingVertical: space.cosy },
  notice: { padding: space.gulf, gap: space.snug, marginTop: space.gulf * 2 },
  noticeTitle: { ...type.title, color: colors.text, textAlign: 'center' },
  noticeBody: { ...type.body, color: colors.subtle, textAlign: 'center' },
});
