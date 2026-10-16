import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  ACCENTS,
  EmptyState,
  Loading,
  Screen,
  TAG_TONES,
  RADII,
  colors,
  fontFor,
  space,
  type,
} from "@/components/ui-kit";
import { glassPane } from "@/components/glass";
import { ShopLogo } from "@/components/shop-logo";
import { getMyRewards, getRegisteredShops } from "@/lib/api";
import { customerNudge } from "@/lib/domain/rewards";
import { assignBrandAccents } from "@/lib/domain/shop-branding";
import { shopLogoUri } from "@/lib/domain/shop-cover";
import { emptyDirectoryMessage } from "@/lib/domain/shop-directory";
import type { Shop } from "@/lib/types";

/**
 * The customer's own laundries, and nothing else.
 *
 * This tab used to go on to list every other shop in the system under "More
 * laundry shops", with a connect button on each. A customer meets a laundry by
 * standing in it, not by browsing — so the way to a new shop is the code at
 * its counter, and the list of everyone else's laundries is gone.
 */
export default function CustomerShops() {
  const router = useRouter();

  const { data: registered, isLoading } = useQuery({
    queryKey: ["registered-shops"],
    queryFn: getRegisteredShops,
  });

  // One call for every card's reward line; a failure only costs the lines.
  const { data: rewards } = useQuery({
    queryKey: ["my-rewards"],
    queryFn: () => getMyRewards(),
  });

  const mine = useMemo(() => registered ?? [], [registered]);

  // Assigned across the list, so two of your shops never share a tone — but a
  // tone a shop chose for itself is held fixed, and only the rest walk.
  const mineAccents = useMemo(
    () =>
      assignBrandAccents(
        mine.map((shop) => ({ id: shop.id, brand_accent: shop.brand_accent })),
        ACCENTS.length,
      ),
    [mine],
  );

  const openShop = (shopId: string) =>
    router.push(`/(customer)/shop/${shopId}` as never);

  const emptyMessage = emptyDirectoryMessage(mine.length);

  if (isLoading) return <Loading />;

  return (
    <Screen>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Your Laundries
      </Text>
      {emptyMessage ? <EmptyState message={emptyMessage} /> : null}
      {/* One grouped list, the way Settings sets a run of rows. */}
      {mine.length > 0 ? (
        <View style={styles.group}>
          {mine.map((shop, index) => {
            const standing = rewards?.find((row) => row.shop_id === shop.id);
            const nudge = standing ? customerNudge(standing) : null;
            const isReady = Boolean(
              standing?.programs.some((program) => program.ready > 0),
            );
            return (
              <ShopCard
                key={shop.id}
                isFirst={index === 0}
                shop={shop}
                accent={ACCENTS[mineAccents[index]]}
                onPress={() => openShop(shop.id)}
              >
                {nudge ? <RewardLine text={nudge} isReady={isReady} /> : null}
              </ShopCard>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

/** How close the next reward is, under the shop it is earned at. */
function RewardLine({ text, isReady }: { text: string; isReady: boolean }) {
  const tone = isReady ? TAG_TONES.settled : TAG_TONES.linked;
  return (
    <View style={[styles.reward, { backgroundColor: tone.bg }]}>
      <Ionicons name="gift" size={14} color={tone.ink} />
      <Text style={[styles.rewardText, { color: tone.ink }]}>{text}</Text>
    </View>
  );
}

/**
 * One row of the list: the shop's logo as an app-icon tile — its initials in
 * its own accent when it has none, the same tone it wears on the home screen —
 * then its name and address, and the disclosure chevron. A reward line, when
 * there is one, sits under the words inside the same row.
 */
function ShopCard({
  isFirst,
  shop,
  accent,
  onPress,
  children,
}: {
  isFirst: boolean;
  shop: Shop;
  accent?: (typeof ACCENTS)[number];
  onPress: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${shop.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {isFirst ? null : <View style={styles.separator} />}
      <View style={styles.shopRow}>
        <ShopLogo
          name={shop.name}
          logoUrl={shopLogoUri(shop)}
          size={LOGO}
          shape="plate"
          accent={accent ?? null}
          fallback={accent ? "initials" : "storefront"}
        />
        <View style={styles.words}>
          <Text style={styles.shopName} numberOfLines={1}>
            {shop.name}
          </Text>
          {shop.address ? (
            <Text style={styles.address} numberOfLines={2}>
              {shop.address}
            </Text>
          ) : null}
          {children}
        </View>
        <Ionicons name="chevron-forward" size={16} color={CHEVRON} />
      </View>
    </Pressable>
  );
}

/** The iOS disclosure chevron's grey. */
const CHEVRON = "#C7C7CC";
const LOGO = 48;

const styles = StyleSheet.create({
  sectionTitle: {
    ...type.section,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.5,
    color: colors.text,
    marginTop: space.snug,
  },
  group: {
    ...glassPane,
    overflow: "hidden",
  },
  row: {
    paddingVertical: space.cosy,
    paddingLeft: space.room,
    paddingRight: space.cosy,
  },
  rowPressed: { backgroundColor: "rgba(255, 255, 255, 0.6)" },
  /** Starts where the words start, the way an iOS list rule does. */
  separator: {
    position: "absolute",
    top: 0,
    right: 0,
    left: space.room + LOGO + space.cosy,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(60, 60, 67, 0.12)",
  },
  shopRow: { flexDirection: "row", alignItems: "center", gap: space.cosy },
  words: { flex: 1, minWidth: 0, gap: 2 },
  shopName: {
    ...type.body,
    fontSize: 17,
    lineHeight: 22,
    ...fontFor(600),
    color: colors.text,
  },
  address: {
    ...type.caption,
    fontSize: 14,
    lineHeight: 19,
    color: colors.subtle,
  },
  reward: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.tight + 2,
    marginTop: space.tight + 2,
    paddingHorizontal: space.snug + 2,
    paddingVertical: space.tight,
    borderRadius: RADII.pill,
  },
  rewardText: { ...type.caption, ...fontFor(600), flexShrink: 1 },
});
