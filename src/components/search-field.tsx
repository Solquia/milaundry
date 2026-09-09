/**
 * Find one thing in a long list.
 *
 * A customer says their name across the counter; the owner should be able to
 * type three letters of it, not switch to "All" and scroll every order the
 * shop has ever taken. Plain and quiet: a search box is a tool, not a hero.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { RADII, colors, space, type } from './ui-kit';

export function SearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  accessibilityLabel: string;
}) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="search-outline" size={18} color={colors.subtle} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        accessibilityLabel={accessibilityLabel}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color={colors.borderStrong} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    minHeight: 44,
    paddingHorizontal: space.cosy,
    borderRadius: RADII.pill,
    paddingLeft: space.room,
    backgroundColor: colors.card,
  },
  input: { flex: 1, ...type.body, color: colors.text, paddingVertical: space.snug },
});
