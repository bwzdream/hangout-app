import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import type { Profile } from '@/lib/types';

import { Icon, type IconName } from './icon';

// ─── Text ────────────────────────────────────────────────────
type Variant = 'display' | 'largeTitle' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'overline';

export function T({ variant = 'body', color, style, ...rest }: TextProps & { variant?: Variant; color?: string }) {
  const defaultColor =
    variant === 'caption' ? Colors.textSecondary : variant === 'overline' ? Colors.textTertiary : Colors.text;
  return <Text style={[text[variant], { color: color ?? defaultColor }, style]} {...rest} />;
}

const display = Fonts?.display;
const text = StyleSheet.create({
  display: { fontFamily: display, fontSize: 48, lineHeight: 50, fontWeight: '800', letterSpacing: -1.6 },
  largeTitle: { fontFamily: display, fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.9 },
  title: { fontFamily: display, fontSize: 26, lineHeight: 31, fontWeight: '700', letterSpacing: -0.6 },
  heading: { fontFamily: display, fontSize: 19, lineHeight: 24, fontWeight: '700', letterSpacing: -0.3 },
  body: { fontFamily: display, fontSize: 16, lineHeight: 22, fontWeight: '400', letterSpacing: -0.2 },
  label: { fontFamily: display, fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.15 },
  caption: { fontFamily: display, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  overline: { fontFamily: display, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
});

// ─── Layout ──────────────────────────────────────────────────
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  edges = ['top'],
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: ('top' | 'bottom')[];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const inner = <View style={[styles.content, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={styles.screen}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 64 }}
          keyboardShouldPersistTaps="handled"
          indicatorStyle="white"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={Colors.textSecondary} /> : undefined
          }>
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

/** Apple-style large title with an optional overline above and an action on the right. */
export function Header({ title, overline, right }: { title: string; overline?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        {overline ? <T variant="overline">{overline}</T> : null}
        <T variant="largeTitle">{title}</T>
      </View>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  raised,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  raised?: boolean;
}) {
  const base = [styles.card, raised && { backgroundColor: Colors.surfaceRaised }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export function Row({ children, style, gap = Spacing.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: Spacing.md }}>
      <Row style={{ justifyContent: 'space-between', minHeight: 24 }}>
        <T variant="overline">{title}</T>
        {action}
      </Row>
      {children}
    </View>
  );
}

/** iOS Settings–style grouped list: rows separated by hairlines inside one rounded surface. */
export function List({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.card, { padding: 0, gap: 0, overflow: 'hidden' }]}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={styles.separator} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  icon,
  left,
  right,
  onPress,
  destructive,
  chevron = !!onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
}) {
  const content = (
    <Row gap={Spacing.md} style={styles.listRow}>
      {left}
      {icon ? (
        <View style={styles.listIcon}>
          <Icon name={icon} size={17} color={destructive ? Colors.danger : Colors.text} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 1 }}>
        <T variant="label" color={destructive ? Colors.danger : Colors.text} numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T variant="caption" numberOfLines={2}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron" size={14} color={Colors.textTertiary} /> : null}
    </Row>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: Colors.surfacePressed }}>
      {content}
    </Pressable>
  );
}

// ─── Controls ────────────────────────────────────────────────
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  size = 'md',
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'white' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const bg = { primary: Colors.accent, white: Colors.white, secondary: Colors.surfaceRaised, ghost: 'transparent', danger: 'transparent' }[variant];
  const fg = { primary: Colors.onAccent, white: Colors.onAccent, secondary: Colors.text, ghost: Colors.text, danger: Colors.danger }[variant];
  const height = { sm: 36, md: 48, lg: 56 }[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, height, paddingHorizontal: size === 'sm' ? 14 : 22, opacity: disabled ? 0.4 : 1 },
        pressed && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Row gap={8}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 14 : 17} color={fg} /> : null}
          <T variant="label" color={fg} style={size === 'lg' ? { fontSize: 17, fontWeight: '700' } : size === 'sm' ? { fontSize: 14 } : undefined}>
            {title}
          </T>
        </Row>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Icon name={icon} size={18} />
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? Colors.white : Colors.surfaceRaised },
        pressed && styles.pressed,
        style,
      ]}>
      <T variant="label" color={selected ? Colors.onAccent : Colors.textSecondary} style={{ fontSize: 14 }}>
        {label}
      </T>
    </Pressable>
  );
}

export function Input({ label, style, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: Spacing.sm }}>
      {label ? <T variant="overline">{label}</T> : null}
      <TextInput
        placeholderTextColor={Colors.textTertiary}
        selectionColor={Colors.accent}
        keyboardAppearance="dark"
        style={[styles.input, props.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 14 }, style as StyleProp<TextStyle>]}
        {...props}
      />
    </View>
  );
}

export function Badge({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'muted' }) {
  return (
    <View style={[styles.badge, { backgroundColor: tone === 'accent' ? Colors.accentDim : Colors.surfaceRaised }]}>
      <T variant="caption" color={tone === 'accent' ? Colors.accent : Colors.textSecondary} style={{ fontWeight: '700', fontSize: 12 }}>
        {label}
      </T>
    </View>
  );
}

// ─── People ──────────────────────────────────────────────────
const AVATAR_TONES = ['#3B3355', '#2E4A3D', '#4F3A30', '#2D3E57', '#523049', '#47462D', '#2F4B4E', '#4A2F2F'];

export const displayName = (p?: Profile | null) => p?.display_name || (p ? `@${p.username}` : 'Someone');

function initials(p?: Profile | null) {
  const source = (p?.display_name || p?.username || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

function toneFor(id?: string) {
  let h = 0;
  for (const c of id ?? '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function Avatar({ profile, size = 44, ring }: { profile?: Profile | null; size?: number; ring?: string }) {
  const inner = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: toneFor(profile?.id),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: Colors.text, fontWeight: '700', fontSize: size * 0.36, letterSpacing: 0.3, fontFamily: display }}>
        {initials(profile)}
      </Text>
    </View>
  );
  if (!ring) return inner;
  return (
    <View style={{ padding: 2, borderRadius: size, borderWidth: 2, borderColor: ring }}>
      {inner}
    </View>
  );
}

export function AvatarStack({ profiles, size = 28, max = 5 }: { profiles: (Profile | undefined)[]; size?: number; max?: number }) {
  const shown = profiles.filter(Boolean).slice(0, max) as Profile[];
  const extra = profiles.length - shown.length;
  return (
    <Row gap={0}>
      {shown.map((p, i) => (
        <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -size / 3, borderRadius: size, borderWidth: 2, borderColor: Colors.surface }}>
          <Avatar profile={p} size={size} />
        </View>
      ))}
      {extra > 0 ? (
        <T variant="caption" style={{ marginLeft: 8 }}>
          +{extra}
        </T>
      ) : null}
    </Row>
  );
}

// ─── Events ──────────────────────────────────────────────────
/** Bold calendar block: "NOV / 14". */
export function DateBlock({ date, size = 56 }: { date: string | number; size?: number }) {
  const d = new Date(date);
  return (
    <View style={[styles.dateBlock, { width: size, height: size }]}>
      <T variant="overline" color={Colors.accent} style={{ fontSize: 10, lineHeight: 12 }}>
        {d.toLocaleDateString(undefined, { month: 'short' })}
      </T>
      <T variant="title" style={{ fontSize: size * 0.42, lineHeight: size * 0.48 }}>
        {d.getDate()}
      </T>
    </View>
  );
}

// ─── Feedback ────────────────────────────────────────────────
export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl }}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={22} color={Colors.textSecondary} />
      </View>
      <T variant="heading" style={{ textAlign: 'center', marginTop: Spacing.xs }}>
        {title}
      </T>
      {body ? (
        <T variant="caption" style={{ textAlign: 'center', maxWidth: 280 }}>
          {body}
        </T>
      ) : null}
      {action ? <View style={{ marginTop: Spacing.sm }}>{action}</View> : null}
    </Card>
  );
}

export function Loading() {
  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={Colors.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg + 4,
    paddingTop: Spacing.lg,
    gap: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg + 2,
    gap: Spacing.md,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.hairline, marginLeft: 60 },
  listRow: { paddingHorizontal: Spacing.lg, paddingVertical: 13, minHeight: 56 },
  listIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: { borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: { borderRadius: Radius.pill, paddingHorizontal: 15, paddingVertical: 9 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    fontFamily: display,
  },
  badge: { borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  dateBlock: {
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
