import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/components/ui-kit';
import type { TabConfig } from '@/lib/domain/tab-config';
import { useHaptic } from '@/lib/use-app-settings';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Derived from the installed expo-router rather than importing
// @react-navigation/bottom-tabs, which this project does not depend on directly.
export type TabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>
>[0];

const BAR_HEIGHT = 62;
/** How far the center button pokes above the bar. */
const LIFT = 18;
const CIRCLE = 56;

type Props = TabBarProps & { tabs: readonly TabConfig[] };

/**
 * Bottom bar with a raised circular center action. The whole bar is drawn
 * inside one container tall enough to hold the lifted button, so the circle is
 * never clipped (Android clips children that overflow their parent).
 */
export function RaisedTabBar({ state, navigation, tabs }: Props) {
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name;
  const haptic = useHaptic();

  return (
    <View style={[styles.container, { height: BAR_HEIGHT + LIFT + insets.bottom }]}>
      <View
        style={[styles.surface, { height: BAR_HEIGHT + insets.bottom }]}
      />
      <View
        accessibilityRole="tablist"
        style={[styles.row, { paddingBottom: insets.bottom }]}
      >
        {tabs.map((tab) => {
          const route = state.routes.find((candidate) => candidate.name === tab.name);
          if (!route) return null;

          const isFocused = activeRouteName === tab.name;
          const handlePress = () => {
            // The raised tab is the app's one physical-looking button, so it
            // gets the weight to match. Pressing the tab you are already on
            // still answers — silence there reads as a missed tap.
            haptic(tab.isCenter ? 'commit' : 'tap');
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          if (tab.isCenter) {
            return (
              <Pressable
                key={tab.name}
                accessibilityRole="tab"
                accessibilityLabel={tab.title}
                accessibilityState={{ selected: isFocused }}
                onPress={handlePress}
                style={styles.centerItem}
              >
                <View style={[styles.circle, isFocused && styles.circleActive]}>
                  <Ionicons name={tab.icon as IconName} color={colors.onAccent} size={28} />
                </View>
              </Pressable>
            );
          }

          // The 22px glyph can carry the identity blue (a control needs 3:1);
          // the 11px label cannot — at 3.5:1 it would fail AA, so it takes the
          // deeper ink. Same blue family, two different jobs.
          const iconTint = isFocused ? colors.primary : colors.subtle;
          const labelTint = isFocused ? colors.actionInk : colors.subtle;
          return (
            <Pressable
              key={tab.name}
              accessibilityRole="tab"
              accessibilityLabel={tab.title}
              accessibilityState={{ selected: isFocused }}
              onPress={handlePress}
              style={styles.item}
            >
              <Ionicons name={tab.icon as IconName} color={iconTint} size={22} />
              <Text style={[styles.label, { color: labelTint }]} numberOfLines={1}>
                {tab.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: 'transparent' },
  surface: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  item: {
    flex: 1,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: { fontSize: 11, fontWeight: '600' },
  centerItem: {
    flex: 1,
    height: BAR_HEIGHT + LIFT,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.card,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  circleActive: { backgroundColor: colors.primaryDark },
});
