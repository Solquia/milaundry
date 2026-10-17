/**
 * /download — the APK, on the elegant blue the rest of the app stands on.
 *
 * THESIS: the field is the page, the same way home is. The washer icon and the
 * name sit on that light; the download rides on the white sheet. Not a splash
 * cut, not receipt paper.
 * OWN-WORLD: BlueField (deep / mid / lit / bloom / glow), white type on the
 * field, a 32pt-radius sheet in the cool field grey, white cards, action blue
 * for the one control.
 * STORY: a visitor sees Milaundry, takes the Android file, and knows the three
 * things Android will ask.
 * FIRST VIEWPORT: wordmark and icon on the blue; the filled download on the
 * sheet immediately under them.
 * FORM: customer home — field, greeting, sheet — not the welcome waterline.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 * finish review, the verdict, and DESIGN.md
 */
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlueField } from '@/components/blue-field';
import { BLUE_FIELD, Button, colors, elevation, fontFor, space, type } from '@/components/ui-kit';
import { RADII } from '@/lib/domain/design-scale';
import { downloadAudience, downloadPage } from '@/lib/domain/download';
import { useHaptic } from '@/lib/use-app-settings';

const ICON = require('../../assets/images/icon.png');

const COLUMN_MAX = 430;
const SHEET_RADIUS = 32;

export default function Download() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const haptic = useHaptic();
  const userAgent = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const page = downloadPage(downloadAudience({ platform: Platform.OS, userAgent }));

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = `${page.name} — Download`;
    }
  }, [page.name]);

  const onAction = () => {
    haptic('commit');
    if (page.action.kind === 'apk' && page.apk) {
      startApkDownload(page.apk.url, page.apk.fileName);
      return;
    }
    if (page.action.kind === 'store') {
      void Linking.openURL(page.action.url);
      return;
    }
    router.replace('/' as never);
  };

  return (
    <View style={styles.page}>
      <BlueField />
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space.gulf }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.greeting}>
          <Text style={styles.wordmark} accessibilityRole="header">
            {page.headline}
          </Text>
          <Text style={styles.lede}>{page.lede}</Text>
          <View style={styles.iconPlate} accessibilityLabel={`${page.name} app icon`}>
            <Image source={ICON} style={styles.icon} contentFit="cover" />
          </View>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.gulf }]}>
          <Button
            title={page.action.label}
            onPress={onAction}
            accessibilityLabel={page.action.label}
          />

          {page.steps.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardHead} accessibilityRole="header">
                After it lands
              </Text>
              {page.steps.map((step) => (
                <View key={step.n} style={styles.step}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepN}>{step.n}</Text>
                  </View>
                  <View style={styles.stepCopy}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepBody}>{step.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.version}>
            {page.action.kind === 'store' ? 'iPhone' : 'Android'} · {page.version}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function startApkDownload(url: string, fileName: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BLUE_FIELD.deep },
  scroll: { flexGrow: 1 },
  greeting: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: COLUMN_MAX,
    paddingHorizontal: space.section,
    paddingBottom: space.gulf,
    gap: space.cosy,
  },
  /** apple.com's product headline: big, bold, pulled tight. */
  wordmark: {
    ...type.hero,
    fontSize: 40,
    lineHeight: 46,
    color: colors.onAccent,
    letterSpacing: -1.2,
    textAlign: 'center',
  },
  lede: {
    ...type.body,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.3,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    width: '100%',
  },
  iconPlate: {
    width: 132,
    height: 132,
    // An app icon's own squircle.
    borderRadius: 30,
    borderCurve: 'continuous',
    overflow: 'hidden',
    marginTop: space.snug,
    ...elevation.hero,
  },
  icon: { width: 132, height: 132 },
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    borderCurve: 'continuous',
    paddingHorizontal: space.room,
    paddingTop: space.section,
    gap: space.section,
    width: '100%',
    maxWidth: COLUMN_MAX,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: RADII.card - 4,
    borderCurve: 'continuous',
    padding: space.room + 2,
    gap: space.room,
    ...elevation.rest,
  },
  cardHead: { ...type.section, fontSize: 22, lineHeight: 28, letterSpacing: -0.5, color: colors.text },
  step: { flexDirection: 'row', gap: space.cosy, alignItems: 'flex-start' },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepN: { ...type.label, fontSize: 14, lineHeight: 18, color: colors.onAccent },
  stepCopy: { flex: 1, flexShrink: 1, minWidth: 0, gap: 2 },
  stepTitle: { ...type.body, fontSize: 17, ...fontFor(600), color: colors.text },
  stepBody: { ...type.caption, fontSize: 15, lineHeight: 20, color: colors.subtle, flexShrink: 1 },
  version: { ...type.caption, color: colors.subtle, textAlign: 'center' },
});
