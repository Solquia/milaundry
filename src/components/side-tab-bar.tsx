import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TabBarProps } from '@/components/raised-tab-bar';
import { colors, fontFor, space } from '@/components/ui-kit';
import { SIDEBAR_WIDTH } from '@/lib/domain/desk-layout';
import type { TabConfig } from '@/lib/domain/tab-config';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SEPARATOR = 'rgba(60, 60, 67, 0.14)';

/** The settings screen is not a tab, but on a desk it earns a row of its own. */
const SETTINGS_ROUTE = 'settings';

function glyphFor(icon: string, isFocused: boolean): IconName {
  if (!isFocused) return icon as IconName;
  return icon.replace(/-outline$/, '') as IconName;
}

type Props = TabBarProps & {
  tabs: readonly TabConfig[];
  /** The shop this dashboard is for, shown under the product's name. */
  shopName?: string | null;
};

/**
 * The tab bar turned on its side for a laptop.
 *
 * A bottom bar on a 1440px window put five icons a hand's width apart along
 * the foot of the screen, where a mouse never rests. Down the left edge they
 * read as a list, which is how every desk tool a shop owner already uses is
 * laid out. Same tabs, same order, same role filter as the phone bar: the
 * raised "center" tab has no centre here, so it is simply a row.
 */
export function SideTabBar({ state, navigation, tabs, shopName }: Props) {
  const activeRouteName = state.routes[state.index]?.name;

  const go = (routeName: string) => {
    const route = state.routes.find((candidate) => candidate.name === routeName);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (activeRouteName !== routeName && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const renderRow = (name: string, title: string, icon: string) => {
    const isFocused = activeRouteName === name;
    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityLabel={title}
        accessibilityState={{ selected: isFocused }}
        onPress={() => go(name)}
        style={({ hovered }: { hovered?: boolean }) => [
          styles.row,
          hovered && !isFocused && styles.rowHover,
          isFocused && styles.rowActive,
        ]}
      >
        <Ionicons
          name={glyphFor(icon, isFocused)}
          size={20}
          color={isFocused ? colors.action : colors.subtle}
        />
        <Text style={[styles.rowLabel, isFocused && styles.rowLabelActive]} numberOfLines={1}>
          {title}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
        <View style={styles.brandText}>
          <Text style={styles.product} numberOfLines={1}>
            MiLaundry
          </Text>
          {shopName ? (
            <Text style={styles.shop} numberOfLines={1}>
              {shopName}
            </Text>
          ) : null}
        </View>
      </View>
      <View accessibilityRole="tablist" style={styles.list}>
        {tabs.map((tab) => renderRow(tab.name, tab.title, tab.icon))}
      </View>
      <View style={styles.foot}>{renderRow(SETTINGS_ROUTE, 'Settings', 'settings-outline')}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: colors.card,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: SEPARATOR,
    paddingVertical: space.section,
    paddingHorizontal: 12,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingBottom: space.section,
  },
  logo: { width: 36, height: 36, borderRadius: 9 },
  brandText: { flex: 1 },
  product: { fontSize: 16, lineHeight: 20, color: colors.text, ...fontFor(700) },
  shop: { fontSize: 13, lineHeight: 17, color: colors.subtle, ...fontFor(500) },
  list: { gap: 2, flex: 1 },
  foot: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEPARATOR,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  rowHover: { backgroundColor: colors.bg },
  rowActive: { backgroundColor: colors.actionSurface },
  rowLabel: { fontSize: 15, color: colors.text, ...fontFor(500) },
  rowLabelActive: { color: colors.actionInk, ...fontFor(600) },
});
