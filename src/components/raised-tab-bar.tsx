import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { glassChip, useIsGlass } from '@/components/glass';
import { colors, fontFor } from '@/components/ui-kit';
import type { TabConfig } from '@/lib/domain/tab-config';
import { useHaptic } from '@/lib/use-app-settings';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Derived from the installed expo-router rather than importing
// @react-navigation/bottom-tabs, which this project does not depend on directly.
export type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const BAR_HEIGHT = 56;
/**
 * How far the center button pokes above the bar: not at all. An iOS tab bar
 * is one flat strip; the scan action earns its emphasis with a filled blue
 * disc inside the strip, not by floating over the page.
 */
const LIFT = 0;
const CIRCLE = 44;
/** The iOS separator: a hairline of grey at a third strength. */
const SEPARATOR = 'rgba(60, 60, 67, 0.22)';

/** SF Symbols fill the selected tab's glyph; the outline is the resting one. */
function glyphFor(icon: string, isFocused: boolean): IconName {
  if (!isFocused) return icon as IconName;
  return icon.replace(/-outline$/, '') as IconName;
}

type Props = TabBarProps & { tabs: readonly TabConfig[] };

/**
 * Bottom bar with a center action. The whole bar is drawn inside one
 * container tall enough to hold that button, so it is never clipped (Android
 * clips children that overflow their parent).
 */
export function RaisedTabBar({ state, navigation, descriptors, tabs }: Props) {
  const isGlass = useIsGlass();
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index];
  const activeRouteName = activeRoute?.name;
  const haptic = useHaptic();

  // A flow the customer has committed to — booking — asks for the bar to go:
  // one stray tap on Home would throw the half-built order away.
  const barStyle = activeRoute ? descriptors[activeRoute.key]?.options.tabBarStyle : undefined;
  const flatBarStyle = StyleSheet.flatten(barStyle) as { display?: string } | undefined;
  if (flatBarStyle?.display === 'none') return null;

  return (
    <View style={[styles.container, { height: BAR_HEIGHT + LIFT + insets.bottom }]}>
      <View
        style={[
          styles.surface,
          isGlass && styles.surfaceGlass,
          { height: BAR_HEIGHT + insets.bottom },
        ]}
      />
      <View accessibilityRole="tablist" style={[styles.row, { paddingBottom: insets.bottom }]}>
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
                  <Ionicons name={tab.icon as IconName} color={colors.onAccent} size={22} />
                </View>
              </Pressable>
            );
          }

          // The 22px glyph can carry the identity blue (a control needs 3:1);
          // the 11px label cannot — at 3.5:1 it would fail AA, so it takes the
          // deeper ink. Same blue family, two different jobs.
          const iconTint = isFocused ? colors.action : colors.subtle;
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
              <Ionicons name={glyphFor(tab.icon, isFocused)} color={iconTint} size={24} />
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
    backgroundColor: 'rgba(249, 249, 251, 0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEPARATOR,
  },
  /** Frosted, like the iOS tab bar: the page shows faintly through it. */
  surfaceGlass: {
    ...glassChip,
    borderWidth: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.95)',
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
    gap: 2,
  },
  label: { fontSize: 10, lineHeight: 12, letterSpacing: 0.1, ...fontFor(500) },
  centerItem: {
    flex: 1,
    height: BAR_HEIGHT + LIFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.action,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  circleActive: { backgroundColor: colors.primaryDark },
});
