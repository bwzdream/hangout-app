/**
 * Pingle's mascot: a waving hand with a little face.
 * Vector (react-native-svg), so it stays crisp at any size.
 */
import { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { Colors } from '@/constants/theme';

export function HandLogo({
  size = 40,
  color = Colors.text,
  face = Colors.accent,
  waves = true,
  wave = false,
}: {
  size?: number;
  /** Hand color. */
  color?: string;
  /** Eyes & smile color (usually the background it sits on). */
  face?: string;
  /** Show the little motion lines. */
  waves?: boolean;
  /** Gently wave back and forth. */
  wave?: boolean;
}) {
  const r = useSharedValue(0);
  useEffect(() => {
    if (!wave) return;
    r.set(
      withRepeat(
        withSequence(
          withDelay(1800, withTiming(-14, { duration: 160, easing: Easing.out(Easing.quad) })),
          withTiming(12, { duration: 220 }),
          withTiming(-10, { duration: 200 }),
          withTiming(0, { duration: 180 }),
        ),
        -1,
      ),
    );
  }, [r, wave]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.get()}deg` }] }));

  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <G transform="translate(-4 0) rotate(-16 52 56)">
          <Rect x={30} y={20} width={11} height={36} rx={5.5} fill={color} />
          <Rect x={42.5} y={13} width={11} height={42} rx={5.5} fill={color} />
          <Rect x={55} y={17} width={11} height={38} rx={5.5} fill={color} />
          <Rect x={67} y={26} width={10} height={30} rx={5} fill={color} />
          <Rect x={28} y={40} width={50} height={40} rx={19} fill={color} />
          <Rect x={13} y={45} width={26} height={12} rx={6} fill={color} transform="rotate(38 26 51)" />
          <Circle cx={45} cy={59} r={3.2} fill={face} />
          <Circle cx={60} cy={59} r={3.2} fill={face} />
          <Path d="M45.5 66.5 Q52.5 72.5 59.5 66.5" stroke={face} strokeWidth={3.2} fill="none" strokeLinecap="round" />
        </G>
        {waves ? (
          <>
            <Path d="M78 18 Q86 24 86 34" stroke={color} strokeWidth={4.5} fill="none" strokeLinecap="round" />
            <Path d="M84 8 Q96 17 95 33" stroke={color} strokeWidth={4.5} fill="none" strokeLinecap="round" />
          </>
        ) : null}
      </Svg>
    </Animated.View>
  );
}
