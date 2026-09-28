import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HeroSegments, PanelCard } from '@/components/admin-pulse';
import { PillButton, adminColors } from '@/components/admin-ui';
import { Field, PasswordField, PhoneField, TAG_TONES, mono } from '@/components/ui-kit';
import {
  adminAssignMerchant,
  adminCreateShopAccount,
  adminListShopMembers,
  adminRemoveShopMember,
} from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { removeMemberPrompt } from '@/lib/domain/confirm-prompts';
import { credentialsHandoff, type CredentialsHandoff } from '@/lib/domain/credentials-handoff';
import { SHOP_ACCOUNT_ROLES, validateShopAccountForm, type ShopAccountRole } from '@/lib/domain/shop-account';
import { canRemoveMember, describeMemberRole } from '@/lib/domain/shop-member';
import { generateTempPassword, type PasswordSource } from '@/lib/domain/temp-password';
import type { ShopMemberRow } from '@/lib/types';

type AddMode = 'new' | 'existing';

type Props = {
  shopId: string;
  shopName: string;
  onError: (err: Error, contextPhone: string) => void;
  onMessage: (text: string) => void;
  refresh: () => void;
};

const ROLE_OPTIONS = SHOP_ACCOUNT_ROLES.map((role) => ({
  value: role,
  label: describeMemberRole(role),
}));

function memberName(member: ShopMemberRow): string {
  return member.full_name || member.username || member.phone || 'Unnamed';
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('') || '?'
  );
}

export function AdminShopTeam({ shopId, shopName, onError, onMessage, refresh }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [handoff, setHandoff] = useState<CredentialsHandoff | null>(null);

  const { data: members } = useQuery({
    queryKey: ['admin-shop-members', shopId],
    queryFn: () => adminListShopMembers(shopId),
  });

  const removeMember = useMutation({
    mutationFn: (profileId: string) => {
      const check = canRemoveMember(members ?? [], profileId);
      if (!check.ok) return Promise.reject(new Error(check.reason));
      return adminRemoveShopMember(shopId, profileId);
    },
    onSuccess: () => {
      onMessage('Access removed.');
      refresh();
    },
    onError: (err: Error) => onError(err, ''),
  });

  const askRemove = (member: ShopMemberRow) => {
    const check = canRemoveMember(members ?? [], member.profile_id);
    if (!check.ok) {
      onError(new Error(check.reason), '');
      return;
    }
    confirmAction(removeMemberPrompt(memberName(member), shopName), () =>
      removeMember.mutate(member.profile_id)
    );
  };

  return (
    <>
      {handoff ? <HandoffCard handoff={handoff} onDismiss={() => setHandoff(null)} /> : null}

      <PanelCard
        title="People"
        hint="Everyone who can sign in to this shop's dashboard."
        action={
          isAdding ? null : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsAdding(true)}
              style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="person-add-outline" size={16} color={adminColors.accentInk} />
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          )
        }
      >
        {members?.length === 0 ? <Text style={styles.empty}>No one can sign in yet.</Text> : null}
        <View>
          {members?.map((member, index) => (
            <MemberRow
              key={member.profile_id}
              member={member}
              isFirst={index === 0}
              isBusy={removeMember.isPending}
              onRemove={() => askRemove(member)}
            />
          ))}
        </View>
      </PanelCard>

      {isAdding ? (
        <AddPersonPanel
          shopId={shopId}
          onClose={() => setIsAdding(false)}
          onError={onError}
          onCreated={(next) => {
            setHandoff(next);
            setIsAdding(false);
            refresh();
          }}
          onAttached={() => {
            onMessage('Existing account added to this shop.');
            setIsAdding(false);
            refresh();
          }}
        />
      ) : null}
    </>
  );
}

function MemberRow({
  member,
  isFirst,
  isBusy,
  onRemove,
}: {
  member: ShopMemberRow;
  isFirst: boolean;
  isBusy: boolean;
  onRemove: () => void;
}) {
  const name = memberName(member);
  const isOwner = member.role === 'owner';
  const tone = isOwner ? TAG_TONES.linked : TAG_TONES.neutral;
  const login = member.username ? `@${member.username}` : member.phone;
  return (
    <View style={[styles.member, !isFirst && styles.memberDivider]}>
      <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
        <Text style={[styles.avatarText, { color: tone.ink }]}>{initialsOf(name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.memberName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.memberMeta} numberOfLines={1}>
          {login}
        </Text>
      </View>
      <View style={[styles.roleTag, { backgroundColor: tone.bg }]}>
        <Text style={[styles.roleTagText, { color: tone.ink }]}>{describeMemberRole(member.role)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${name}`}
        onPress={onRemove}
        disabled={isBusy}
        hitSlop={8}
        style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: adminColors.paper }]}
      >
        <Ionicons name="trash-outline" size={18} color={adminColors.subtle} />
      </Pressable>
    </View>
  );
}

function submitLabel(isBusy: boolean, isNew: boolean): string {
  if (isBusy) return 'Working…';
  return isNew ? 'Create login' : 'Add to this shop';
}

function AddPersonPanel({
  shopId,
  onClose,
  onError,
  onCreated,
  onAttached,
}: {
  shopId: string;
  onClose: () => void;
  onError: (err: Error, contextPhone: string) => void;
  onCreated: (handoff: CredentialsHandoff) => void;
  onAttached: () => void;
}) {
  const [mode, setMode] = useState<AddMode>('new');
  const [role, setRole] = useState<ShopAccountRole>('staff');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [passwordSource, setPasswordSource] = useState<PasswordSource>('generate');
  const [password, setPassword] = useState(() => generateTempPassword());
  const [isCopied, setIsCopied] = useState(false);

  const createAccount = useMutation({
    mutationFn: () => {
      const result = validateShopAccountForm({ fullName, phoneInput: phone, password, role });
      if (!result.ok) return Promise.reject(new Error(result.message));
      return adminCreateShopAccount(shopId, result.account).then(() => result.account);
    },
    onSuccess: (account) =>
      onCreated(
        credentialsHandoff({ fullName: account.fullName, phone: account.phone, password: account.password })
      ),
    onError: (err: Error) => onError(err, phone),
  });

  const attachExisting = useMutation({
    mutationFn: () => {
      const result = validateShopAccountForm({
        fullName: 'existing account',
        phoneInput: phone,
        password: 'placeholder',
        role,
      });
      if (!result.ok) return Promise.reject(new Error(result.message));
      return adminAssignMerchant(shopId, result.account.phone, result.account.role);
    },
    onSuccess: onAttached,
    onError: (err: Error) => onError(err, phone),
  });

  const copyPassword = async () => {
    await Clipboard.setStringAsync(password);
    setIsCopied(true);
  };

  const togglePasswordSource = () => {
    const next = passwordSource === 'generate' ? 'choose' : 'generate';
    setPasswordSource(next);
    setPassword(next === 'generate' ? generateTempPassword() : '');
    setIsCopied(false);
  };

  const isNew = mode === 'new';
  const isBusy = createAccount.isPending || attachExisting.isPending;

  return (
    <PanelCard
      title="Add a person"
      action={
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={22} color={adminColors.subtle} />
        </Pressable>
      }
    >
      <HeroSegments
        tone="light"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'new', label: 'New login' },
          { value: 'existing', label: 'Existing account' },
        ]}
      />
      <Text style={styles.help}>
        {isNew
          ? 'Creates a login for this shop. You hand over the number and password.'
          : 'For someone who already signed up. They keep their own password.'}
      </Text>

      {isNew ? (
        <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="e.g. Maria Santos" />
      ) : null}
      <PhoneField label="Mobile number" value={phone} onChangeText={setPhone} />

      <View style={styles.group}>
        <Text style={styles.groupLabel}>Role</Text>
        <HeroSegments tone="light" value={role} onChange={setRole} options={ROLE_OPTIONS} />
      </View>

      {isNew ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Password</Text>
          {passwordSource === 'generate' ? (
            <View style={styles.passwordBox}>
              <Text selectable style={styles.passwordText}>
                {password}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Make another password"
                onPress={() => {
                  setPassword(generateTempPassword());
                  setIsCopied(false);
                }}
                hitSlop={6}
                style={styles.iconButton}
              >
                <Ionicons name="refresh" size={18} color={adminColors.accentInk} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy password"
                onPress={copyPassword}
                hitSlop={6}
                style={styles.iconButton}
              >
                <Ionicons
                  name={isCopied ? 'checkmark' : 'copy-outline'}
                  size={18}
                  color={isCopied ? adminColors.success : adminColors.accentInk}
                />
              </Pressable>
            </View>
          ) : (
            <PasswordField
              label="Their password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
            />
          )}
          <Text accessibilityRole="button" style={styles.link} onPress={togglePasswordSource}>
            {passwordSource === 'generate' ? 'Type my own instead' : 'Generate one for me'}
          </Text>
        </View>
      ) : null}

      <PillButton
        title={submitLabel(isBusy, isNew)}
        onPress={() => (isNew ? createAccount.mutate() : attachExisting.mutate())}
        disabled={isBusy}
      />
    </PanelCard>
  );
}

function HandoffCard({ handoff, onDismiss }: { handoff: CredentialsHandoff; onDismiss: () => void }) {
  const [isCopied, setIsCopied] = useState(false);
  const copyAll = async () => {
    await Clipboard.setStringAsync(handoff.lines.join('\n'));
    setIsCopied(true);
  };
  return (
    <View style={styles.handoff}>
      <View style={styles.handoffHead}>
        <Ionicons name="checkmark-circle" size={20} color={TAG_TONES.settled.ink} />
        <Text style={styles.handoffTitle}>{handoff.title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} hitSlop={10}>
          <Ionicons name="close" size={20} color={TAG_TONES.settled.ink} />
        </Pressable>
      </View>
      <View style={styles.handoffLines}>
        {handoff.lines.map((line) => (
          <Text key={line} selectable style={styles.handoffLine}>
            {line}
          </Text>
        ))}
      </View>
      <Text style={styles.handoffNote}>{handoff.note}</Text>
      <PillButton title={isCopied ? 'Copied' : 'Copy login details'} variant="outline" onPress={copyAll} />
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: adminColors.accentSoft,
  },
  addButtonText: { fontSize: 14, fontWeight: '700', color: adminColors.accentInk },
  empty: { fontSize: 14, color: adminColors.subtle },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  memberDivider: { borderTopWidth: 1, borderTopColor: adminColors.border },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' },
  memberName: { fontSize: 15, fontWeight: '600', color: adminColors.text },
  memberMeta: { fontSize: 13, color: adminColors.subtle },
  roleTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roleTagText: { fontSize: 12, fontWeight: '700' },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  help: { fontSize: 13, color: adminColors.subtle },
  group: { gap: 8 },
  groupLabel: { fontSize: 13, fontWeight: '600', color: adminColors.subtle },
  passwordBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: adminColors.border,
    backgroundColor: adminColors.paper,
  },
  passwordText: { flex: 1, fontFamily: mono, fontSize: 16, color: adminColors.text },
  link: { fontSize: 14, fontWeight: '600', color: adminColors.action },
  handoff: {
    padding: 16,
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFE3CF',
    backgroundColor: TAG_TONES.settled.bg,
  },
  handoffHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  handoffTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: TAG_TONES.settled.ink },
  handoffLines: { gap: 2 },
  handoffLine: { fontFamily: mono, fontSize: 15, color: adminColors.text },
  handoffNote: { fontSize: 13, color: TAG_TONES.settled.ink },
});
