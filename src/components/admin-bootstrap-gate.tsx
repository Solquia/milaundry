import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorText, Screen, Subtle, Title, colors, space, type } from '@/components/ui-kit';
import {
  BOOTSTRAP_ADMIN_SQL,
  BOOTSTRAP_ADMIN_SQL_URL,
} from '@/lib/domain/admin-bootstrap';
import { useAuth } from '@/lib/auth';

/**
 * The bootstrap login is a customer until someone runs the SQL in SETUP.md.
 * Without this screen that looks like a finished product, not a missing step.
 */
export function AdminBootstrapGate() {
  const { refreshProfile, signOut } = useAuth();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const copySql = async () => {
    await Clipboard.setStringAsync(BOOTSTRAP_ADMIN_SQL);
    setCopied(true);
  };

  const checkAgain = async () => {
    setError('');
    setChecking(true);
    try {
      const next = await refreshProfile();
      if (next?.role !== 'superadmin') {
        setError('Still a customer. Run the SQL in the editor, then tap again.');
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen>
      <Title>One more step for admin</Title>
      <Subtle>
        This login is still a customer in the database, which is why you saw the
        customer home. Sign-out does not change that. Run this SQL in Supabase,
        then tap the button below.
      </Subtle>

      <View style={styles.sqlBox}>
        <Text selectable style={styles.sql}>
          {BOOTSTRAP_ADMIN_SQL}
        </Text>
      </View>

      <Button title={copied ? 'Copied' : 'Copy SQL'} onPress={() => void copySql()} />
      <Button
        title="Open Supabase SQL editor"
        variant="outline"
        onPress={() => void Linking.openURL(BOOTSTRAP_ADMIN_SQL_URL)}
      />
      <Button
        title={checking ? 'Checking…' : "I've run the SQL"}
        onPress={() => void checkAgain()}
        disabled={checking}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}

      <Pressable onPress={() => void signOut()} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sqlBox: {
    backgroundColor: colors.sunken,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: space.room,
  },
  sql: { ...type.body, color: colors.text },
  signOut: { alignSelf: 'center', padding: space.cosy },
  signOutText: { ...type.caption, color: colors.actionInk },
});
