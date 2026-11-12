import type { ReactNode } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that squishes on press and springs back. */
export function Bouncy({
  children,
  onPress,
  style,
  disabled,
  accessibilityLabel,
  squish = 0.94,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
  squish?: number;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.set(withSpring(squish, { damping: 12, stiffness: 400 }));
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      }}
      onPressOut={() => scale.set(withSpring(1, { damping: 8, stiffness: 300 }))}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}
