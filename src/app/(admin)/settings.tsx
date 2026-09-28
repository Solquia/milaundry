import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionHeader, listCard } from '@/components/admin-pulse';
import { AdminHero, adminColors } from '@/components/admin-ui';
import { TAG_TONES } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { confirmAction } from '@/lib/confirm';
import { signOutPrompt } from '@/lib/domain/confirm-prompts';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('') || 'SA'
  );
}

function SettingsRow({
  icon,
  label,
  detail,
  isFirst,
  tone = 'default',
  onPress,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  isFirst?: boolean;
  tone?: 'default' | 'danger';
  onPress?: () => void;
}) {
  const color = tone === 'danger' ? adminColors.danger : adminColors.text;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isFirst && styles.rowDivider,
        pressed && { backgroundColor: adminColors.paper },
      ]}
    >
      <View style={[styles.rowIcon, tone === 'danger' && { backgroundColor: '#FDECEC' }]}>
        <Ionicons
          name={icon}
          size={17}
          color={tone === 'danger' ? adminColors.danger : adminColors.accentInk}
        />
      </View>
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
      {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      {onPress && tone === 'default' ? (
        <Ionicons name="chevron-forward" size={18} color={adminColors.subtle} />
      ) : null}
    </Pressable>
  );
}

export default function AdminSettings() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const name = profile?.full_name || 'Superadmin';
  const login = profile?.username ? `@${profile.username}` : profile?.phone || '';
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <View style={styles.screen}>
      <AdminHero title="Settings" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[listCard, styles.profile]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {login ? <Text style={styles.login}>{login}</Text> : null}
          </View>
          <View style={styles.roleTag}>
            <Ionicons name="shield-checkmark" size={12} color={TAG_TONES.linked.ink} />
            <Text style={styles.roleTagText}>Superadmin</Text>
          </View>
        </View>

        <SectionHeader title="CONSOLE" />
        <View style={listCard}>
          <SettingsRow
            icon="add-circle-outline"
            label="Add a laundry shop"
            isFirst
            onPress={() => router.push('/(admin)/new-shop')}
          />
          <SettingsRow
            icon="storefront-outline"
            label="All shops"
            onPress={() => router.push('/(admin)/shops')}
          />
          <SettingsRow
            icon="pulse-outline"
            label="Platform overview"
            onPress={() => router.push('/(admin)')}
          />
        </View>

        <SectionHeader title="ABOUT" />
        <View style={listCard}>
          <SettingsRow icon="information-circle-outline" label="App version" detail={version} isFirst />
        </View>

        <View style={listCard}>
          <SettingsRow
            icon="log-out-outline"
            label="Sign out"
            tone="danger"
            isFirst
            onPress={() => confirmAction(signOutPrompt(), () => signOut())}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: adminColors.paper },
  content: {
    padding: 16,
    gap: 10,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: adminColors.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '700', color: adminColors.onHero },
  name: { fontSize: 17, fontWeight: '700', color: adminColors.text },
  login: { fontSize: 13, color: adminColors.subtle, marginTop: 2 },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: TAG_TONES.linked.bg,
  },
  roleTagText: { fontSize: 12, fontWeight: '700', color: TAG_TONES.linked.ink },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: adminColors.border },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: adminColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  rowDetail: { fontSize: 14, color: adminColors.subtle },
});
