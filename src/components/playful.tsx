/**
 * Playful building blocks: springy presses, chunky "pop" buttons with a hard offset
 * shadow, and little rotated stickers.
 */
import { useEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Colors } from '@/constants/theme';

import { Icon, type IconName } from './icon';
import { T } from './ui';

import { Bouncy } from './bouncy';

export { Bouncy };

/** Big, soft, rounded button for the main moments (Send, Create). Squishes on press. */
export function PopButton({
  children,
  onPress,
  color = Colors.accent,
  style,
  radius = 32,
  disabled,
}: {
  children: ReactNode;
  onPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  disabled?: boolean;
}) {
  return (
    <Bouncy
      onPress={onPress}
      disabled={disabled}
      squish={0.96}
      style={[
        {
          borderRadius: radius,
          backgroundColor: color,
          opacity: disabled ? 0.5 : 1,
          shadowColor: '#1E7A45',
          shadowOpacity: 0.22,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        },
        style,
      ]}>
      {children}
    </Bouncy>
  );
}

/** A small round sticker that gently wobbles. */
export function Sticker({
  icon,
  size = 48,
  color = Colors.text,
  iconColor = Colors.accent,
  rotate = -8,
}: {
  icon: IconName;
  size?: number;
  color?: string;
  iconColor?: string;
  rotate?: number;
}) {
  const r = useSharedValue(rotate);
  useEffect(() => {
    r.set(
      withDelay(
        600,
        withRepeat(withSequence(withTiming(rotate + 10, { duration: 900 }), withTiming(rotate - 6, { duration: 900 })), -1, true),
      ),
    );
  }, [r, rotate]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.get()}deg` }] }));
  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}>
      <Icon name={icon} size={size * 0.45} color={iconColor} />
    </Animated.View>
  );
}

/** Small rounded label, e.g. "2h left". */
export function Tag({ label, tone = 'ink' }: { label: string; tone?: 'ink' | 'mint' | 'soft' }) {
  const bg = { ink: Colors.text, mint: Colors.accent, soft: Colors.surfaceRaised }[tone];
  const fg = { ink: Colors.background, mint: Colors.onAccent, soft: Colors.text }[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <T variant="caption" color={fg} style={{ fontWeight: '700', fontSize: 12 }}>
        {label}
      </T>
    </View>
  );
}
