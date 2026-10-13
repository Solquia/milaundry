/**
 * The owner's rewards: the third shelf of the Prices tab, beside services and
 * add-ons, because a reward is a price — what a loyal customer pays.
 *
 * Three programs, each a card with a switch. Turning one on puts it live with
 * a sensible default (10th wash free, 10% off a first order, 5% off for
 * regulars) so the owner is one tap from a working program, then tunes it.
 * A preview of the customer's card sits on top, so the owner sees exactly
 * what their regulars will see.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { getShopRewards, saveShopReward } from '@/lib/api';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import {
  BENEFIT_OPTIONS,
  KIND_BLURBS,
  KIND_LABELS,
  REWARD_DEFAULTS,
  REWARD_KINDS,
  programHeadline,
  validateRewardDraft,
  type RewardBenefit,
  type RewardKind,
  type RewardProgram,
  type ShopReward,
} from '@/lib/domain/rewards';

import { Segmented } from './segmented';
import { StampCard } from './stamp-card';
import {
  Button,
  Card,
  ErrorState,
  ErrorText,
  Field,
  Loading,
  Subtle,
  colors,
  space,
  type,
} from './ui-kit';

const VALUE_LABELS: Record<RewardBenefit, string> = {
  free: 'Most it covers in ₱ (leave blank for the whole order)',
  percent: 'Discount in %',
  amount: 'Pesos off',
};

const VISITS_LABELS: Record<Exclude<RewardKind, 'welcome'>, string> = {
  stamp_card: 'Visits to fill the card',
  regular: 'Visits to become a regular',
};

type SaveInput = Pick<
  ShopReward,
  'kind' | 'visits_needed' | 'benefit' | 'benefit_value' | 'is_active'
>;

function asText(value: number): string {
  return value > 0 ? String(value) : '';
}

function RewardEditor({
  kind,
  reward,
  isSaving,
  onSave,
}: {
  kind: RewardKind;
  reward: ShopReward | undefined;
  isSaving: boolean;
  onSave: (input: SaveInput) => Promise<void>;
}) {
  const start = reward ?? { ...REWARD_DEFAULTS[kind], is_active: false };
  const [visits, setVisits] = useState(asText(start.visits_needed));
  const [benefit, setBenefit] = useState<RewardBenefit>(start.benefit);
  const [value, setValue] = useState(asText(start.benefit_value));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isActive = reward?.is_active ?? false;

  const submit = async (nextActive: boolean, successNotice: string) => {
    setError('');
    setNotice('');
    const checked = validateRewardDraft({ kind, visits, benefit, value });
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    try {
      await onSave({ kind, ...checked.value, is_active: nextActive });
      setNotice(successNotice);
    } catch (err: unknown) {
      setError(friendlyMerchantError('save-price', err instanceof Error ? err.message : ''));
    }
  };

  const handleToggle = async (next: boolean) => {
    if (next || !reward) {
      await submit(next, next ? 'Live. Customers can see it now.' : 'Turned off.');
      return;
    }
    // Switching off keeps the saved terms, so a half-typed field in the form
    // can never hold a program live.
    setError('');
    setNotice('');
    try {
      const { visits_needed, benefit: savedBenefit, benefit_value } = reward;
      await onSave({ kind, visits_needed, benefit: savedBenefit, benefit_value, is_active: false });
      setNotice('Turned off.');
    } catch (err: unknown) {
      setError(friendlyMerchantError('save-price', err instanceof Error ? err.message : ''));
    }
  };

  return (
    <Card>
      <View style={styles.editorHead}>
        <View style={styles.editorTitle}>
          <Text style={type.section}>{KIND_LABELS[kind]}</Text>
          <Subtle>{KIND_BLURBS[kind]}</Subtle>
        </View>
        <View style={styles.switchCol}>
          <Switch
            accessibilityLabel={`${KIND_LABELS[kind]} on`}
            value={isActive}
            disabled={isSaving}
            onValueChange={handleToggle}
            trackColor={{ true: colors.action, false: colors.border }}
          />
          <Text style={styles.switchText}>{isActive ? 'Live' : 'Off'}</Text>
        </View>
      </View>

      {kind === 'welcome' ? null : (
        <Field
          label={VISITS_LABELS[kind]}
          value={visits}
          onChangeText={setVisits}
          keyboardType="number-pad"
          maxLength={3}
        />
      )}
      <Text style={styles.fieldLabel}>Reward</Text>
      <Segmented
        options={BENEFIT_OPTIONS}
        value={benefit}
        onChange={setBenefit}
        accessibilityRole="radiogroup"
      />
      <Field
        label={VALUE_LABELS[benefit]}
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        maxLength={8}
        placeholder={benefit === 'free' ? 'Whole order' : undefined}
      />
      <ErrorText>{error}</ErrorText>
      {notice ? (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      <Button
        title={isSaving ? 'Saving…' : isActive ? 'Save changes' : 'Save and turn on'}
        variant={isActive ? 'outline' : 'primary'}
        onPress={() => submit(true, 'Saved. Customers see the new terms now.')}
        disabled={isSaving}
      />
    </Card>
  );
}

export function MerchantRewards({ shopId }: { shopId: string }) {
  const queryClient = useQueryClient();
  const { data: rewards, isLoading, error, refetch } = useQuery({
    queryKey: ['shop-rewards', shopId],
    queryFn: () => getShopRewards(shopId),
  });
  const save = useMutation({
    mutationFn: (input: SaveInput) => saveShopReward({ shop_id: shopId, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shop-rewards', shopId] }),
  });

  if (isLoading) return <Loading />;
  if (error) {
    return (
      <ErrorState
        message={friendlyMerchantError('load-prices', error.message)}
        onRetry={() => refetch()}
      />
    );
  }

  const list = rewards ?? [];
  const live: RewardProgram[] = REWARD_KINDS.flatMap((kind) => {
    const reward = list.find((row) => row.kind === kind && row.is_active);
    return reward ? [{ ...reward, ready: 0 }] : [];
  });

  return (
    <View style={styles.stack}>
      <Card>
        <Text style={type.section}>Bring customers back</Text>
        <Subtle>
          Every finished order counts as a visit, for app customers and for walk-ins whose phone
          number you type. Customers see their card on your shop page. When one has earned a
          reward, a Rewards card shows on their order so you can apply it, and the bill drops by
          itself.
        </Subtle>
      </Card>

      {live.length > 0 ? (
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>What your customers see</Text>
          <StampCard programs={live} standing={null} />
        </View>
      ) : null}

      {REWARD_KINDS.map((kind) => {
        const reward = list.find((row) => row.kind === kind);
        return (
          <RewardEditor
            key={`${kind}-${reward?.id ?? 'new'}`}
            kind={kind}
            reward={reward}
            isSaving={save.isPending}
            onSave={(input) => save.mutateAsync(input)}
          />
        );
      })}
    </View>
  );
}

/**
 * The same editor, folded into one card for Settings: what is live at a
 * glance, and one tap to open the programs. Unfolded in the stack it would
 * push every other setting three screens down.
 */
export function RewardsSettingsCard({ shopId }: { shopId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: rewards } = useQuery({
    queryKey: ['shop-rewards', shopId],
    queryFn: () => getShopRewards(shopId),
  });
  const live = (rewards ?? []).filter((reward) => reward.is_active);
  const summary =
    live.length === 0
      ? 'No promos running. Give regulars a reason to come back: a free 10th wash, a first-visit discount, or a regulars’ discount.'
      : `${live.length} running: ${live.map((reward) => programHeadline(reward)).join(' · ')}`;
  const buttonTitle = isOpen ? 'Close promos' : live.length === 0 ? 'Set up promos' : 'Edit promos';

  return (
    <View style={styles.stack}>
      <Card>
        <View style={styles.settingsHead}>
          <Ionicons name="gift" size={22} color={colors.actionInk} />
          <Text style={[type.section, styles.settingsTitle]}>Promos & loyalty rewards</Text>
        </View>
        <Subtle>{summary}</Subtle>
        <Button
          title={buttonTitle}
          variant={isOpen ? 'outline' : 'primary'}
          onPress={() => setIsOpen((open) => !open)}
        />
      </Card>
      {isOpen ? <MerchantRewards shopId={shopId} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.section },
  settingsHead: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  settingsTitle: { flex: 1, color: colors.text },
  editorHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.cosy },
  editorTitle: { flex: 1, gap: space.tight },
  switchCol: { alignItems: 'center', gap: 2 },
  switchText: { ...type.caption, color: colors.subtle },
  fieldLabel: { ...type.label, color: colors.text },
  notice: { ...type.caption, color: colors.moneyIn },
  preview: { gap: space.snug },
  previewLabel: { ...type.label, color: colors.subtle },
});
