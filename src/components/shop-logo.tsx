/**
 * A shop's mark: its logo when it has uploaded one, its initials when not.
 *
 * Every customer surface used to draw initials and ignore `logo_url`, so a
 * merchant's upload never reached the people it was for. This is the one
 * image-or-initials decision, shared by the shopfront hero, the directory and
 * the home tab, so a laundry is one mark everywhere.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/components/ui-kit';
import { shopInitials } from '@/lib/domain/connected-shops';

interface Accent {
  surface: string;
  ink: string;
}

interface ShopLogoProps {
  name: string;
  logoUrl: string | null;
  size?: number;
  /** The shop's tone for the initials; neutral grey when the shop is not yet yours. */
  accent?: Accent | null;
  /** What to draw with no logo: the shop's initials, or the directory's storefront glyph. */
  fallback?: 'initials' | 'storefront';
  /**
   * How the mark is cut.
   *
   * `circle` is the avatar: a disc filled edge to edge, which is right at list
   * sizes where the mark only has to identify a row. `plate` is the
   * letterhead — the whole logo held inside a rounded square on white, for the
   * one place on a surface where the logo *is* what is being looked at. A
   * laundry's mark is usually a badge with its name lettered inside it, and a
   * disc crop of that at display size cuts the lettering off.
   */
  shape?: 'circle' | 'plate';
}

export function ShopLogo({
  name,
  logoUrl,
  size = 44,
  accent = null,
  fallback = 'initials',
  shape = 'circle',
}: ShopLogoProps) {
  const isPlate = shape === 'plate';
  const frame = {
    width: size,
    height: size,
    borderRadius: isPlate ? Math.round(size * 0.28) : size / 2,
  };
  // A logo that will not decode (an upload the old file reader truncated to a
  // few bytes) used to leave an empty disc where the mark should be. The
  // initials are the mark the shop had before it uploaded anything, so a
  // broken image falls back to them rather than to nothing.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (logoUrl && logoUrl !== failedUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={[isPlate ? styles.plate : styles.image, frame]}
        // A plate holds the whole mark; a disc fills itself with it.
        contentFit={isPlate ? 'contain' : 'cover'}
        transition={150}
        accessibilityLabel={`${name} logo`}
        onError={() => setFailedUrl(logoUrl)}
      />
    );
  }

  return (
    <View
      style={[styles.fallback, frame, accent && { backgroundColor: accent.surface }]}
      accessibilityLabel={`${name} logo`}
    >
      {fallback === 'storefront' ? (
        <Ionicons name="storefront" size={size * 0.45} color={colors.subtle} />
      ) : (
        <Text
          style={[
            styles.initials,
            { fontSize: size * 0.36 },
            accent && { color: accent.ink },
          ]}
        >
          {shopInitials(name.trim() || 'Laundry shop')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.sunken },
  /**
   * White, not the app's sunken grey: a logo is artwork drawn for paper, and
   * the ground it was drawn against is what keeps its own colours true. The
   * inset is the margin a printed label leaves around a mark.
   */
  plate: { backgroundColor: colors.card, padding: space.snug },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
    overflow: 'hidden',
  },
  initials: { ...type.label, fontWeight: '700', color: colors.subtle },
});
