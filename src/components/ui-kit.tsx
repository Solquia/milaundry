import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { OrderStatus } from '@/lib/domain/order-status';
import { PAID_TAG, UNPAID_TAG } from '@/lib/domain/order-tags';
import { PH_DIAL_CODE, formatPhoneInput } from '@/lib/domain/phone-input';

/**
 * Colour roles.
 *
 * Strategy: at a laundry counter there are only three things colour has to
 * say — "you can act here", "money came in", "money is still owed". Every
 * other surface stays neutral, and the blue earns its force by being rare. It
 * used to be spent on every outline button, every link and every *unselected*
 * chip, so nothing on screen was louder than anything else.
 *
 * The field is tinted toward the brand hue so white cards lift off it. At the
 * old #F5F7FA against #FFFFFF the cards had no edge, which is what made four
 * stacked analytics cards read as one flat wall.
 *
 * Every pair below is checked against its real background, not eyeballed.
 */
export const colors = {
  // Identity ---------------------------------------------------------------
  /**
   * The brand blue: splash, the raised FAB, the active tab. Large marks only —
   * as 16px text or a button label on white it is 3.5:1 and fails AA.
   */
  primary: '#208AEF',
  primaryDark: '#1668B5',
  /** Filled actions and selection. One step deeper so a white label clears 5.9:1. */
  action: '#1370CE',
  /** Blue as text on white: links, disclosures, inline controls. 6.2:1. */
  actionInk: '#1263AF',
  /** Soft blue field for a selected row or a tinted surface. */
  actionSurface: '#E8F1FC',
  /** Blue at rule-mark weight: ruler ticks, tracks, inactive scale marks. */
  actionMuted: '#B6D4F2',

  // Surfaces ---------------------------------------------------------------
  bg: '#EDF2F8',
  card: '#FFFFFF',
  /** Inputs, wells — recessed against a card rather than the same white. */
  sunken: '#F7F9FC',

  // Ink --------------------------------------------------------------------
  text: '#14212E',
  /** 5.5:1 on white; the old #64748B sat at 4.7:1 and failed on tinted chips. */
  subtle: '#5A6B7D',
  onAccent: '#FFFFFF',

  // Lines ------------------------------------------------------------------
  border: '#DCE4EE',
  borderStrong: '#C3CFDE',

  // Money ------------------------------------------------------------------
  /** Collected, change to hand back, paid. 5.4:1 on white. */
  moneyIn: '#0B7A45',
  /** Owed to the shop: receivables, the amount to collect, unpaid tags. 5.4:1. */
  moneyOut: '#9A5B06',
  /** The field behind the day's takings — the one region colour owns outright. */
  takingsSurface: '#EFF7F2',
  takingsBorder: '#CDE8DA',

  // Semantics --------------------------------------------------------------
  danger: '#DC2626',
  success: '#0B7A45',
};

/**
 * Tag tones. Payment state is the only tag that carries money, so it is the
 * only one that carries colour; origin and fulfilment stay neutral.
 */
export const TAG_TONES = {
  neutral: { bg: '#E9EEF5', ink: '#43536B' },
  owed: { bg: '#FDF0D2', ink: '#8A4F05' },
  settled: { bg: '#DEF3E7', ink: '#0B6238' },
} as const;

/**
 * Spacing on a 4-unit base, named for the relationship each step expresses
 * rather than its size — so changing one stays a design decision, and a screen
 * cannot drift into using the same gap for everything.
 */
export const space = {
  /** Inside one line of text: a label and the value it introduces. */
  tight: 4,
  /** Siblings inside a single control: chips in a row, stepper parts. */
  snug: 8,
  /** Rows inside one group. */
  cosy: 12,
  /** The inside of a card, and the page gutter. */
  room: 16,
  /** Between two groups the eye should read as separate decisions. */
  section: 20,
  /** Between the input work and the decision it leads to. */
  gulf: 32,
} as const;

/**
 * Depth. Every step carries a downward offset *and* a soft blur — a zero-offset
 * halo reads as decoration, not as a surface lifted off the page. Android gets
 * `elevation` alongside, since it ignores the iOS shadow properties.
 */
export const elevation = {
  /** A card resting on the field. */
  rest: {
    shadowColor: '#0B1B2B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  /** A card you can act on. */
  lift: {
    shadowColor: '#0B1B2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 16,
    elevation: 4,
  },
  /** The one surface that owns the screen. */
  hero: {
    shadowColor: '#0A3E75',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

/**
 * The hero field, ordered deep → light, painted from the lower left to the
 * upper right so the light falls from above the way it does on a real surface.
 *
 * The energy here is chroma, not lightness. The previous ramp topped out at
 * #1A6FC4 — blue channel 196 — which reads as corporate azure however bright
 * you make it. These stops run the blue channel to 190/210/223 while holding
 * luminance flat, so the field gains saturation rather than glare.
 *
 * Luminance is capped deliberately: white at 15px needs 4.5:1, which puts a
 * ceiling of 0.183 on the lightest stop. #1272DF sits at 0.177 — as vivid as
 * this surface can go and still carry body text anywhere on it. Every stop
 * clears AA, so the ramp can be re-angled without re-checking contrast.
 */
export const HERO_GRADIENT = ['#0B48BE', '#1060D2', '#1272DF'] as const;

/**
 * Identity accents — the one place colour names a *thing* rather than a state.
 *
 * A customer's connected shops all wore the same pale blue, so the list read as
 * two identical rows; a stable per-shop tone makes one findable at a glance the
 * way a contact avatar is. Deliberately not used for actions: blue has to keep
 * meaning "you can act here", and an accent spent on a button dilutes it.
 *
 * Every ink is ≥5:1 on its own surface, so initials stay legible, and the
 * initials themselves carry the identity when colour cannot.
 */
export const ACCENTS = [
  { surface: '#E8F1FC', ink: '#1263AF' },
  { surface: '#DCF2EE', ink: '#0F6B5F' },
  { surface: '#EAE8FB', ink: '#4B3FBF' },
  { surface: '#FCEFD6', ink: '#8A5606' },
  { surface: '#FBE6EC', ink: '#A32B52' },
  { surface: '#DEF3E7', ink: '#0B6238' },
] as const;

/**
 * Type roles. `hero` is reserved for the one figure a screen exists to
 * deliver; a screen with two heroes has none.
 */
export const type = {
  hero: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 23, fontWeight: '700', letterSpacing: -0.2 },
  section: { fontSize: 17, fontWeight: '700' },
  /** A value being edited — subordinate to `hero`, which is the answer. */
  value: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 15 },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 12 },
} satisfies Record<string, TextStyle>;

/**
 * Status badges, coloured by *how much the owner has to care*, not by
 * decorating each state with its own swatch. Eight equally saturated badges in
 * one list is eight things shouting; here the ramp runs
 *
 *   not started (neutral) → in the machines (distinct but mid-weight)
 *   → ready (the loudest badge in the app, because it is the only one that
 *     means a customer is waiting) → done or void (receded)
 *
 * `drying` is orange rather than a second purple: washing and drying are the
 * two states read most often, and at arm's length two neighbouring purples
 * were the same badge. Every value carries white 12px text at ≥4.5:1.
 */
const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#5A6B7D',
  received: '#1370CE',
  washing: '#6D3FD4',
  drying: '#C2410C',
  folded: '#0E7490',
  ready: '#0B7A45',
  completed: '#64748B',
  cancelled: '#B91C1C',
};

/** The one status that means somebody is standing at the counter. */
const URGENT_STATUS: OrderStatus = 'ready';

/**
 * Where the laundry is, said the way an owner would say it across the counter.
 * "Pending" and "Received" were ambiguous — received what, the laundry or the
 * money? — and "Delivered / picked up" made a badge carry a slash.
 */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Not started',
  received: 'In the shop',
  washing: 'Washing',
  drying: 'Drying',
  folded: 'Folded',
  ready: 'Ready for pickup',
  completed: 'Done',
  cancelled: 'Cancelled',
};

export { formatMoney } from '@/lib/domain/money';

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  /**
   * Pinned below the scroll area. For the one decision a screen exists to
   * support — a running total, a commit button — that must not scroll away.
   */
  footer?: React.ReactNode;
  /**
   * Centres short content in the viewport instead of stacking it under the top
   * edge. For a screen that is one small block of controls — signing in — where
   * top alignment leaves the block marooned above an empty half-screen.
   * Content taller than the viewport still scrolls normally from the top.
   */
  center?: boolean;
};

export function Screen({ children, scroll = true, footer, center }: ScreenProps) {
  const content = scroll ? (
    // `handled` matters at a counter: after typing a customer name, the first
    // tap on a stepper used to be swallowed dismissing the keyboard, and the
    // owner had no way to tell the tap had not registered.
    <ScrollView
      contentContainerStyle={[styles.screenContent, center && styles.screenCentered]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[styles.screenContent, { flex: 1 }, center && styles.screenCentered]}
    >
      {children}
    </View>
  );
  return (
    // Only the side edges: the stack header already clears the notch and the
    // raised tab bar already applies the bottom inset, so claiming all four
    // here padded the screen twice.
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      {content}
      {footer ? <View style={styles.screenFooter}>{footer}</View> : null}
    </SafeAreaView>
  );
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

/** `compact` tightens padding and gaps for dense lists like the orders feed. */
export function Card({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return <View style={[styles.card, compact && styles.cardCompact]}>{children}</View>;
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

type PasswordFieldProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label?: string;
};

/**
 * Password field with a Show/Hide toggle. Mobile numbers are easy to retype,
 * passwords are not — letting people check what they typed prevents most
 * sign-in failures on a phone keyboard.
 */
export function PasswordField({ label = 'Password', ...inputProps }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.rowInput}
          placeholderTextColor={colors.subtle}
          secureTextEntry={!isVisible}
          autoCapitalize="none"
          autoCorrect={false}
          {...inputProps}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
          accessibilityState={{ selected: isVisible }}
          onPress={() => setIsVisible((visible) => !visible)}
          hitSlop={8}
          style={styles.revealButton}
        >
          <Text style={styles.revealText}>{isVisible ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

type PhoneFieldProps = {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
};

/**
 * Mobile number field with a fixed +63 country code. The user types only the
 * national part; input is re-formatted as `917 123 4567` on every keystroke.
 */
export function PhoneField({
  label = 'Mobile number',
  value,
  onChangeText,
}: PhoneFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.phoneRow}>
        <Text style={styles.phonePrefix}>{PH_DIAL_CODE}</Text>
        <TextInput
          style={styles.phoneInput}
          placeholderTextColor={colors.subtle}
          value={value}
          onChangeText={(next) => onChangeText(formatPhoneInput(next))}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          autoCapitalize="none"
          maxLength={12}
          placeholder="917 123 4567"
          accessibilityLabel={`${label}, country code ${PH_DIAL_CODE}`}
        />
      </View>
    </View>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'outline';
  /**
   * Needed wherever the visible title is a glyph. "−" and "+" announce as
   * "minus button" with no hint of which service is being counted.
   */
  accessibilityLabel?: string;
};

export function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
  accessibilityLabel,
}: ButtonProps) {
  // `action`, not the identity blue: white 16px on #208AEF is 3.5:1 and fails
  // AA. One step deeper keeps the same blue family at 5.9:1.
  const backgroundColor =
    variant === 'primary' ? colors.action : variant === 'danger' ? colors.danger : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'outline' && styles.buttonOutline,
      ]}
    >
      {/* Outline buttons are neutral. They are mostly the *unselected* half of
          a pair (Pickup/Deliver, payment methods, per-kg/per-piece); painting
          both halves blue meant selection carried no colour at all. */}
      <Text style={[styles.buttonText, variant === 'outline' && styles.buttonOutlineText]}>
        {title}
      </Text>
    </Pressable>
  );
}

/**
 * Small neutral tag for order badges like Walk-in / Delivery / Unpaid.
 * Money owed gets the amber treatment; the comparison goes through
 * `UNPAID_TAG` so renaming the label cannot silently drop it.
 */
export function Tag({ label }: { label: string }) {
  // Only the money tags take colour. Walk-in / Online / Pickup / Delivery are
  // facts about the order, not things to act on, so they stay neutral and let
  // the payment state be the one tag that catches the eye.
  const tone =
    label === UNPAID_TAG
      ? TAG_TONES.owed
      : label === PAID_TAG
        ? TAG_TONES.settled
        : TAG_TONES.neutral;

  return (
    <View style={[styles.tag, { backgroundColor: tone.bg }]}>
      <Text style={[styles.tagText, { color: tone.ink }]}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  // A ring, not just a hue: the state that needs action is distinguishable
  // without relying on colour vision or on remembering which green is which.
  const isUrgent = status === URGENT_STATUS;
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: STATUS_COLORS[status] },
        isUrgent && styles.badgeUrgent,
      ]}
    >
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

/**
 * An empty state that is not a dead end. When there is something the owner can
 * do about it, `actionLabel` puts that action here rather than making them
 * work out which tab to go hunting in.
 */
export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={[styles.subtle, styles.emptyText]}>{message}</Text>
      {actionLabel && onAction ? (
        <View style={styles.emptyAction}>
          {/* The only thing on an empty screen — it gets the filled treatment. */}
          <Button title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * A failure the owner can act on: what broke, and a way to try again. Replaces
 * printing a raw backend string and leaving them with nothing to press. The
 * live region announces it, since a screen reader gets no other signal that a
 * refresh silently failed.
 */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View
      style={styles.errorState}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={styles.errorStateText}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="outline" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: space.room, gap: space.cosy },
  // `flexGrow` rather than `flex`: the content still grows past the viewport
  // and scrolls when it is taller, instead of being squeezed to fit.
  screenCentered: { flexGrow: 1, justifyContent: 'center' },
  screenFooter: {
    paddingHorizontal: space.room,
    paddingVertical: space.cosy,
    gap: space.snug,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
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
  cardCompact: { padding: 12, gap: 6, borderRadius: 10 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.subtle },
  input: {
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingLeft: 12,
  },
  rowInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  revealButton: { paddingHorizontal: 12, paddingVertical: 10 },
  revealText: { fontSize: 14, fontWeight: '600', color: colors.actionInk },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingLeft: 12,
  },
  phonePrefix: {
    fontSize: 16,
    color: colors.subtle,
    fontWeight: '600',
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    paddingRight: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonOutline: { borderWidth: 1, borderColor: colors.borderStrong },
  buttonOutlineText: { color: colors.text },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeUrgent: {
    borderWidth: 2,
    borderColor: colors.card,
    // The ring reads as a halo against the card; paired with the deepest
    // green it makes "Ready for pickup" the one badge that finds the eye.
    paddingHorizontal: 12,
  },
  badgeText: { color: colors.onAccent, fontSize: 12, fontWeight: '600' },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  // Colour comes from TAG_TONES; every pair clears 5.7:1 on its own chip.
  tagText: { fontSize: 12, fontWeight: '600' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: space.gulf, gap: space.cosy },
  emptyText: { textAlign: 'center' },
  emptyAction: { alignSelf: 'stretch' },
  errorState: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: space.room,
    gap: space.cosy,
  },
  errorStateText: { fontSize: 14, color: '#991B1B' },
});
