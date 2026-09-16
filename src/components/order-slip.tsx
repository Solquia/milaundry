/**
 * The paper an order is handed over on.
 *
 * Two screens print this slip: the page a customer lands on the second they
 * book online, and the till the moment a walk-in is saved. They are the same
 * object — the shop is about to print one — so they are the same component
 * rather than two drawings of a receipt that can drift apart. The stock, the
 * punched notches, the dashed tear line and the torn hem are `torn-edge.tsx`;
 * what changes between the two is only the words and the code at the foot.
 *
 * The paper measures itself, because the teeth are drawn to a width: a slip in
 * a phone-wide column and a slip in the till's own frame both get a hem cut to
 * their own edge without either screen having to know how wide it is.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { OrderSceneArt } from './order-scene';
import { TORN_EDGE_HEIGHT, TicketPerforation, TornEdge } from './torn-edge';
import { colors, elevation, mono, space, type } from './ui-kit';
import type { OrderScene } from '@/lib/domain/order-scene';

/** How big the drawing at the head of the slip is, and the disc behind it. */
const SCENE_SIZE = 132;
const QR_SIZE = 96;

interface SlipPaperProps {
  children: React.ReactNode;
  /**
   * What sits behind the paper. The teeth and the punches are drawn *in* this
   * colour biting into the stock, so a slip on a card needs the card's white
   * here, not the page's blue-grey.
   */
  ground?: string;
}

export function SlipPaper({ children, ground = colors.bg }: SlipPaperProps) {
  const [width, setWidth] = useState(0);

  return (
    <View
      style={styles.paper}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setWidth((current) => (current === next ? current : next));
      }}
    >
      <TornEdge width={width} color={ground} edge="top" />
      {children}
      <TornEdge width={width} color={ground} edge="bottom" />
    </View>
  );
}

interface SlipCrownProps {
  scene: OrderScene;
  /** The shop's colour: the drawing's ink and the disc it stands on. */
  brand: string;
  halo: string;
  title: string;
  note: string;
}

/** The head of the slip: what happens next, drawn, then said. */
export function SlipCrown({ scene, brand, halo, title, note }: SlipCrownProps) {
  return (
    <View style={styles.crown}>
      <View style={[styles.halo, { backgroundColor: halo }]} />
      <OrderSceneArt scene={scene} brand={brand} size={SCENE_SIZE} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

/** The line the slip is meant to be torn along, in the ground's colour. */
export function SlipTear({ ground = colors.bg }: { ground?: string }) {
  return <TicketPerforation color={ground} ruleColor={colors.paperRule} />;
}

/** Everything below the tear: the facts, the figure, and the code. */
export function SlipStub({ children }: { children: React.ReactNode }) {
  return <View style={styles.stub}>{children}</View>;
}

interface SlipRowProps {
  label: string;
  value: string;
  /**
   * The docket in the receipt's own face. Monospace here is the material, not
   * a costume: it is the number the counter reads back, and a printer sets
   * every glyph at one width whether or not anyone designed it to.
   */
  isCode?: boolean;
}

export function SlipRow({ label, value, isCode }: SlipRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, isCode && styles.rowCode]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/** The figure, under the dashed rule that separates it from the facts. */
export function SlipTotal({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{label}</Text>
        <Text style={styles.totalValue}>{value}</Text>
      </View>
      {note ? <Text style={styles.caveat}>{note}</Text> : null}
    </>
  );
}

/** The code at the foot, on its own white tile so a scanner reads it off glass. */
export function SlipCode({ value, note }: { value: string; note: string }) {
  return (
    <View style={styles.codeBlock}>
      <View style={styles.codeFrame}>
        <QRCode value={value} size={QR_SIZE} />
      </View>
      <Text style={styles.codeNote}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * `overflow: 'hidden'` is what cuts the punched notches and the torn hem:
   * both are drawn as the ground biting into the paper.
   */
  paper: {
    backgroundColor: colors.paper,
    borderRadius: 20,
    overflow: 'hidden',
    ...elevation.lift,
  },
  crown: {
    alignItems: 'center',
    paddingTop: TORN_EDGE_HEIGHT + space.section,
    paddingHorizontal: space.section,
    paddingBottom: space.section,
    gap: space.tight,
  },
  /**
   * A disc of the shop's colour behind the drawing, so the object stands on
   * something rather than floating in the middle of a sheet of paper.
   */
  halo: {
    position: 'absolute',
    top: TORN_EDGE_HEIGHT + space.room,
    width: SCENE_SIZE + space.room,
    height: SCENE_SIZE + space.room,
    borderRadius: (SCENE_SIZE + space.room) / 2,
  },
  title: { ...type.title, color: colors.text, textAlign: 'center', marginTop: space.snug },
  note: { ...type.body, color: colors.subtle, textAlign: 'center' },
  stub: {
    paddingHorizontal: space.section,
    paddingTop: space.room,
    paddingBottom: TORN_EDGE_HEIGHT + space.section,
    gap: space.cosy,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.room },
  rowLabel: { ...type.caption, color: colors.subtle, flexShrink: 0, paddingTop: 2 },
  rowValue: { ...type.body, color: colors.text, flex: 1, textAlign: 'right', fontWeight: '600' },
  rowCode: { fontFamily: mono, letterSpacing: 1 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.paperRule,
    borderStyle: 'dashed',
    paddingTop: space.cosy,
    marginTop: space.tight,
  },
  totalLabel: { ...type.label, color: colors.text },
  totalValue: { ...type.title, fontSize: 22, color: colors.text, fontVariant: ['tabular-nums'] },
  caveat: { ...type.caption, color: colors.subtle },
  codeBlock: { alignItems: 'center', gap: space.snug, marginTop: space.snug },
  codeFrame: { padding: space.cosy, backgroundColor: '#FFFFFF', borderRadius: 12 },
  codeNote: { ...type.caption, color: colors.subtle },
});
