/**
 * Pingle's logo: two hands meeting in a high five.
 * Vector (react-native-svg), so it stays crisp at any size. The source icon is a thin
 * outline; we trace it with a matching stroke to make the lines bolder.
 */
import { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import { Colors } from '@/constants/theme';

import { HIGH_FIVE_PATH } from './logo-path';

export function HandLogo({
  size = 40,
  color = Colors.text,
  weight = 2,
  wave = false,
}: {
  size?: number;
  color?: string;
  /** Extra line thickness (in icon units). 0 = original thin lines. */
  weight?: number;
  /** Little "high five" bounce every few seconds. */
  wave?: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!wave) return;
    t.set(
      withRepeat(
        withSequence(
          withDelay(2200, withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) })),
          withTiming(-0.6, { duration: 160 }),
          withTiming(0, { duration: 220, easing: Easing.out(Easing.back(2)) }),
        ),
        -1,
      ),
    );
  }, [t, wave]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + t.get() * 0.12 }, { rotate: `${t.get() * -6}deg` }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Center the drawing (bounds x 16–84, y 5–94) in the square */}
        <G transform="translate(0 0.5)">
          <Path d={HIGH_FIVE_PATH} fill={color} stroke={color} strokeWidth={weight} strokeLinejoin="round" />
        </G>
      </Svg>
    </Animated.View>
  );
}
