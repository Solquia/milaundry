/**
 * An owner cutting a key for the counter.
 *
 * Until now only a MiLaundry superadmin could create a staff login, so a shop
 * taking on a new hire had to write to us and wait. What happens while they
 * wait is that the owner hands out their own password — which is a worse
 * outcome than anything this card risks.
 *
 * There is no role control on this card, and that is the design rather than an
 * omission: an owner may only ever mint staff. The Edge Function refuses
 * anything else from a merchant caller and `owner_attach_shop_staff` (0022)
 * takes no role argument at all.
 *
 * The password is generated here and never stored anywhere the app can read it
 * back, so the handoff has to be copied while it is on screen. The card says
 * so rather than letting an owner discover it later.
 */
import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { createShopStaff } from '@/lib/api';
import { credentialsHandoff } from '@/lib/domain/credentials-handoff';
import { validateStaffDraft } from '@/lib/domain/staff-invite';
import { generateTempPassword } from '@/lib/domain/temp-password';
import type { Shop } from '@/lib/types';

import {
  Button,
  Card,
  ErrorText,
  Field,
  PhoneField,
  Subtle,
  colors,
  type,
} from './ui-kit';

/** What the owner is holding after a successful create, until they dismiss it. */
interface Handoff {
  fullName: string;
  phone: string;
  password: string;
}

export function StaffCard({ shop }: { shop: Shop }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string }>({});
  const [error, setError] = useState('');
  const [isSaving, setSaving] = useState(false);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [didCopy, setDidCopy] = useState(false);

  const handleCreate = async () => {
    setError('');
    const checked = validateStaffDraft({ fullName, phone });
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const password = generateTempPassword();
      await createShopStaff(shop.id, { ...checked.value, password });
      setHandoff({ ...checked.value, password });
      setFullName('');
      setPhone('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create the account.');
    } finally {
      setSaving(false);
    }
  };

  if (handoff) {
    const note = credentialsHandoff(handoff);
    const asText = [note.title, ...note.lines].join('\n');

    return (
      <Card>
        <Text style={styles.title}>{note.title}</Text>
        {note.lines.map((line) => (
          <Text key={line} style={styles.credential} selectable>
            {line}
          </Text>
        ))}
        <Subtle>{note.note}</Subtle>
        {/* Said plainly, because it is true: nothing stores this password. */}
        <Text style={styles.warning}>
          Copy this now — the password is not shown again. If it is lost, add the
          person again with a different number, or ask MiLaundry to reset it.
        </Text>
        <Button
          title={didCopy ? 'Copied' : 'Copy these details'}
          variant="outline"
          onPress={() => {
            void Clipboard.setStringAsync(asText);
            setDidCopy(true);
          }}
        />
        <Button
          title="Done"
          onPress={() => {
            setHandoff(null);
            setDidCopy(false);
          }}
        />
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.title}>Staff logins</Text>
      <Subtle>
        A staff login opens the orders list, a new walk-in order, and the price
        list. Earnings, the customer book and these settings stay yours.
      </Subtle>

      <Field
        label="Their name"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Ana Cruz"
        autoComplete="name"
      />
      <ErrorText>{errors.fullName}</ErrorText>

      <PhoneField
        label="Their mobile number"
        value={phone}
        onChangeText={setPhone}
      />
      <ErrorText>{errors.phone}</ErrorText>
      <Subtle>They sign in with this number and the password you hand them.</Subtle>

      <ErrorText>{error}</ErrorText>
      <Button
        title={isSaving ? 'Creating…' : 'Create staff login'}
        disabled={isSaving}
        onPress={() => void handleCreate()}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...type.section, color: colors.text },
  /** Selectable: an owner reads these out or copies one line at a time. */
  credential: { ...type.body, fontFamily: type.label.fontFamily, color: colors.text },
  warning: { ...type.caption, color: colors.moneyOut },
});
