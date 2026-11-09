import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
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

import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Profile } from '@/lib/types';

// ─── Text ────────────────────────────────────────────────────
type Variant = 'hero' | 'title' | 'heading' | 'body' | 'label' | 'caption';

export function T({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  const theme = useTheme();
  const muted = variant === 'caption';
  return (
    <Text
      style={[textStyles[variant], { color: color ?? (muted ? theme.textSecondary : theme.text) }, style]}
      {...rest}
    />
  );
}

const textStyles = StyleSheet.create({
  hero: { fontSize: 34, lineHeight: 40, fontWeight: '800', fontFamily: Fonts?.rounded },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', fontFamily: Fonts?.rounded },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700', fontFamily: Fonts?.rounded },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
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
  const theme = useTheme();
  const inner = <View style={[styles.content, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.primary} /> : undefined
          }>
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  onPress,
  tone = 'card',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tone?: 'card' | 'cardAlt' | 'accentSoft' | 'successSoft';
}) {
  const theme = useTheme();
  const base = [styles.card, { backgroundColor: theme[tone], borderColor: theme.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { transform: [{ scale: 0.98 }] }]}>
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
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="heading">{title}</T>
        {action}
      </Row>
      {children}
    </View>
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
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const theme = useTheme();
  const bg = {
    primary: theme.primary,
    accent: theme.accent,
    secondary: theme.cardAlt,
    ghost: 'transparent',
    danger: 'transparent',
  }[variant];
  const fg = {
    primary: theme.primaryText,
    accent: theme.primaryText,
    secondary: theme.text,
    ghost: theme.accent,
    danger: theme.danger,
  }[variant];
  const pad = { sm: 8, md: 13, lg: 17 }[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, paddingVertical: pad, opacity: disabled ? 0.45 : 1 },
        pressed && { transform: [{ scale: 0.96 }] },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <T variant="label" color={fg} style={size === 'lg' ? { fontSize: 17 } : undefined}>
          {icon ? `${icon}  ` : ''}
          {title}
        </T>
      )}
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
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.card,
          borderColor: selected ? theme.accent : theme.border,
        },
        style,
      ]}>
      <T variant="label" color={selected ? theme.primaryText : theme.text}>
        {label}
      </T>
    </Pressable>
  );
}

export function Input({ label, style, ...props }: TextInputProps & { label?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <T variant="label">{label}</T> : null}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
          props.multiline && { minHeight: 90, textAlignVertical: 'top' },
          style as StyleProp<TextStyle>,
        ]}
        {...props}
      />
    </View>
  );
}

// ─── People ──────────────────────────────────────────────────
const AVATAR_COLORS = ['#FFD6CC', '#E3DAFF', '#CFF5DF', '#FFF0B8', '#CDEBFF', '#FFD9F0'];

export function Avatar({ profile, size = 44, ring }: { profile?: Profile | null; size?: number; ring?: string }) {
  const seed = (profile?.id ?? 'x').charCodeAt(0) + (profile?.id ?? 'x').charCodeAt(1 % (profile?.id?.length ?? 1));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: AVATAR_COLORS[seed % AVATAR_COLORS.length],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 3 : 0,
        borderColor: ring,
      }}>
      <Text style={{ fontSize: size * 0.5 }}>{profile?.avatar_emoji ?? '🙂'}</Text>
    </View>
  );
}

export function AvatarStack({ profiles, size = 28, max = 5 }: { profiles: (Profile | undefined)[]; size?: number; max?: number }) {
  const theme = useTheme();
  const shown = profiles.filter(Boolean).slice(0, max) as Profile[];
  const extra = profiles.length - shown.length;
  return (
    <Row gap={0}>
      {shown.map((p, i) => (
        <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -size / 3, borderRadius: size, borderWidth: 2, borderColor: theme.card }}>
          <Avatar profile={p} size={size} />
        </View>
      ))}
      {extra > 0 ? (
        <T variant="caption" style={{ marginLeft: 6 }}>
          +{extra}
        </T>
      ) : null}
    </Row>
  );
}

export const displayName = (p?: Profile | null) => p?.display_name || (p ? `@${p.username}` : 'Someone');

// ─── Feedback ────────────────────────────────────────────────
export function Empty({ emoji, title, body, action }: { emoji: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl }}>
      <Text style={{ fontSize: 40 }}>{emoji}</Text>
      <T variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {body ? (
        <T variant="caption" style={{ textAlign: 'center' }}>
          {body}
        </T>
      ) : null}
      {action}
    </Card>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: theme.background }}>
      <ActivityIndicator color={theme.primary} size="large" />
    </View>
  );
}

/** A little bounce to make things feel alive. */
export function Bounce({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [scale] = useState(() => new Animated.Value(0.6));
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, delay, useNativeDriver: true }).start();
  }, [scale, delay]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.xl,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  button: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  chip: {
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
});
