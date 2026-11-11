/**
 * Playful building blocks: springy presses, chunky "pop" buttons with a hard offset
 * shadow, and little rotated stickers.
 */
import { useEffect, type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';

import { Icon, type IconName } from './icon';
import { T } from './ui';

export { Bouncy } from './bouncy';

/**
 * Chunky button with a black outline and a hard offset shadow that "presses in".
 * Used for the few big moments (I'm free, Send).
 */
export function PopButton({
  children,
  onPress,
  color = Colors.accent,
  style,
  radius = 28,
  disabled,
}: {
  children: ReactNode;
  onPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  disabled?: boolean;
}) {
  const press = useSharedValue(0);
  const face = useAnimatedStyle(() => ({
    transform: [{ translateX: press.get() * 4 }, { translateY: press.get() * 5 }],
  }));
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => press.set(withTiming(1, { duration: 70 }))}
      onPressOut={() => press.set(withSpring(0, { damping: 9, stiffness: 260 }))}
      style={[{ paddingRight: 4, paddingBottom: 5, opacity: disabled ? 0.5 : 1 }, style]}>
      {/* the hard shadow */}
      <View
        style={{ position: 'absolute', left: 4, top: 5, right: 0, bottom: 0, borderRadius: radius, backgroundColor: Colors.text }}
      />
      <Animated.View
        style={[{ borderRadius: radius, backgroundColor: color, borderWidth: 2, borderColor: Colors.text, overflow: 'hidden' }, face]}>
        {children}
      </Animated.View>
    </Pressable>
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
