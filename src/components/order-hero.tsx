/**
 * The top of an order: who it is for, what it is worth, and where it stands.
 *
 * The old screen opened with "Order #4b141b63" — the one line on the page a
 * person cannot read — and buried the customer's name in the third card. Here
 * the name is the headline and the ticket number is the eyebrow. The total is
 * on the same line so the two things the owner says across the counter are
 * the two largest things on the screen, and it goes amber only while the shop
 * is still owed it. The ways to reach the customer are buttons, not a link
 * hidden in a phone number.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { OrderWithDetails } from '@/lib/api';
import { shortOrderId } from '@/lib/domain/order-card';
import { orderContact } from '@/lib/domain/order-contact';
import { orderTags } from '@/lib/domain/order-tags';

import { ContactPills } from './contact-pills';
import { CROWN, StatusBadge, Tag, colors, elevation, formatMoney, formatWhen, mono, space, type } from './ui-kit';

function DetailLine({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text: string;
}) {
  return (
    <View style={styles.detail}>
      <Ionicons name={icon} size={16} color={colors.subtle} style={styles.detailIcon} />
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

export function OrderHero({ order, now }: { order: OrderWithDetails; now: Date }) {
  const contact = orderContact(order);
  const total = order.final_total ?? order.estimated_total;
  const isEstimate = (order.final_total ?? null) === null;
  const isCancelled = order.status === 'cancelled';
  const isOwed = order.payment_status !== 'paid' && !isCancelled;
  const amountNote = isCancelled
    ? 'Cancelled'
    : `${isEstimate ? 'Estimate' : 'Final'} · ${isOwed ? 'to collect' : 'paid'}`;

  return (
    <View style={styles.hero}>
      <View style={styles.eyebrow}>
        <Text style={styles.ticket}>{shortOrderId(order.id).toUpperCase()}</Text>
        <Text style={styles.when}>{formatWhen(order.created_at, now)}</Text>
      </View>

      <View style={styles.headline}>
        <Text style={[styles.name, !contact.isNamed && styles.nameUnnamed]} numberOfLines={2}>
          {contact.name}
        </Text>
        <View style={styles.amount}>
          <Text style={[styles.total, isOwed && styles.totalOwed]}>{formatMoney(total)}</Text>
          <Text style={styles.amountNote}>{amountNote}</Text>
        </View>
      </View>

      <View style={styles.tags}>
        <StatusBadge status={order.status} />
        {orderTags(order).map((tag) => (
          <Tag key={tag} label={tag} />
        ))}
      </View>

      <View style={styles.details}>
        {contact.phone ? (
          <ContactPills phone={contact.phone} />
        ) : (
          <DetailLine icon="call-outline" text="No contact number on file" />
        )}
        {order.fulfillment === 'delivery' ? (
          <DetailLine
            icon="bicycle-outline"
            text={`Deliver to ${order.delivery_address || 'no address given'}`}
          />
        ) : null}
        {order.pickup_at ? (
          <DetailLine icon="time-outline" text={`Pickup ${formatWhen(order.pickup_at, now)}`} />
        ) : null}
        {order.deliver_by ? (
          <DetailLine
            icon="calendar-outline"
            text={`Deliver by ${formatWhen(order.deliver_by, now)}`}
          />
        ) : null}
        {order.notes ? <DetailLine icon="document-text-outline" text={order.notes} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: space.cosy,
    padding: space.section,
    ...CROWN,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.lift,
  },
  eyebrow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.snug },
  ticket: { fontFamily: mono, fontSize: 12, letterSpacing: 0.8, color: colors.subtle },
  when: { ...type.caption, color: colors.subtle },
  headline: { flexDirection: 'row', alignItems: 'flex-start', gap: space.cosy },
  name: { ...type.title, fontSize: 22, color: colors.text, flex: 1, minWidth: 0 },
  // A stand-in like "Online customer" is not a name; it should not read like one.
  nameUnnamed: { fontStyle: 'italic', fontWeight: '500', color: colors.subtle },
  amount: { alignItems: 'flex-end', gap: 2 },
  total: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: colors.text },
  totalOwed: { color: colors.moneyOut },
  amountNote: { ...type.caption, color: colors.subtle },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.tight },
  details: {
    gap: space.snug,
    paddingTop: space.cosy,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: space.snug },
  detailIcon: { marginTop: 2 },
  detailText: { ...type.body, fontSize: 14, color: colors.text, flex: 1 },
});
