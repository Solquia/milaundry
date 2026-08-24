import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { OrderStatus } from '@/lib/domain/order-status';

export const colors = {
  primary: '#208AEF',
  primaryDark: '#1668B5',
  bg: '#F5F7FA',
  card: '#FFFFFF',
  text: '#1A202C',
  subtle: '#64748B',
  border: '#E2E8F0',
  danger: '#DC2626',
  success: '#16A34A',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#D97706',
  received: '#2563EB',
  in_progress: '#7C3AED',
  ready: '#16A34A',
  completed: '#475569',
  cancelled: '#DC2626',
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  received: 'Received',
  in_progress: 'In progress',
  ready: 'Ready for pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function formatMoney(amount: number): string {
  return `₱${amount.toFixed(2)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
};

export function Screen({ children, scroll = true }: ScreenProps) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.screenContent}>{children}</ScrollView>
  ) : (
    <View style={[styles.screenContent, { flex: 1 }]}>{children}</View>
  );
  return <SafeAreaView style={styles.screen}>{content}</SafeAreaView>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtle({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Text style={styles.subtle} onPress={onPress}>
      {children}
    </Text>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

type FieldProps = TextInputProps & { label: string };

export function Field({ label, ...inputProps }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.subtle}
        {...inputProps}
      />
    </View>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'outline';
};

export function Button({ title, onPress, disabled, variant = 'primary' }: ButtonProps) {
  const backgroundColor =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'outline' && styles.buttonOutline,
      ]}
    >
      <Text style={[styles.buttonText, variant === 'outline' && { color: colors.primary }]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <View style={[styles.badge, { backgroundColor: STATUS_COLORS[status] }]}>
      <Text style={styles.badgeText}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.subtle}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtle: { fontSize: 14, color: colors.subtle },
  error: { fontSize: 14, color: colors.danger, marginVertical: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  field: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.subtle },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonOutline: { borderWidth: 1, borderColor: colors.primary },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 32 },
});
