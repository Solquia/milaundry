import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminHero, PillButton, adminColors } from '@/components/admin-ui';
import { useAuth } from '@/lib/auth';

export default function AdminSettings() {
  const { profile, signOut } = useAuth();

  return (
    <View style={styles.screen}>
      <AdminHero title="Settings" subtitle="Console preferences" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>SIGNED IN AS</Text>
          <Text style={styles.value}>{profile?.full_name || 'Superadmin'}</Text>
          <Text style={styles.subtle}>
            {profile?.username || profile?.phone || ''}
          </Text>
        </View>
        <PillButton title="Sign out" variant="danger" onPress={() => signOut()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: adminColors.paper },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: adminColors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: adminColors.border,
    padding: 16,
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: adminColors.subtle,
  },
  value: { fontSize: 18, fontWeight: '800', color: adminColors.text },
  subtle: { fontSize: 14, color: adminColors.subtle },
});
