/**
 * Visual + text that explain "Meet people nearby" at a glance, and the Home entry card.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Colors, Spacing } from '@/constants/theme';

import { Bouncy } from './bouncy';
import { Icon } from './icon';
import { Row, T } from './ui';

const BUBBLES = [
  { label: 'JM', x: -78, y: -26, tone: '#E3DFD7' },
  { label: 'AK', x: 70, y: -42, tone: Colors.accent },
  { label: 'SR', x: 58, y: 48, tone: '#E3DFD7' },
];

/** A map pin with a pulsing ring and a few nearby faces. */
export function NearbyIllustration({ size = 200 }: { size?: number }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false));
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.get()),
    transform: [{ scale: 0.5 + pulse.get() * 0.9 }],
  }));
  const scale = size / 200;
  return (
    <View style={{ width: size, height: size * 0.8, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[{ position: 'absolute', width: 170 * scale, height: 170 * scale, borderRadius: 85 * scale, backgroundColor: Colors.accent }, ring]}
      />
      <View
        style={{
          position: 'absolute',
          width: 150 * scale,
          height: 150 * scale,
          borderRadius: 75 * scale,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: Colors.outline,
        }}
      />
      {BUBBLES.map((b) => (
        <View
          key={b.label}
          style={{
            position: 'absolute',
            transform: [{ translateX: b.x * scale }, { translateY: b.y * scale }],
            width: 44 * scale,
            height: 44 * scale,
            borderRadius: 22 * scale,
            backgroundColor: b.tone,
            borderWidth: 3,
            borderColor: Colors.background,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <T variant="caption" color={Colors.text} style={{ fontWeight: '800', fontSize: 13 * scale }}>
            {b.label}
          </T>
        </View>
      ))}
      <View
        style={{
          width: 64 * scale,
          height: 64 * scale,
          borderRadius: 32 * scale,
          backgroundColor: Colors.text,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name="pin" size={28 * scale} color={Colors.accent} />
      </View>
    </View>
  );
}

/** Home entry card. Explains the idea when you haven't tried it; shows a summary once you're public. */
export function NearbyCard({ enabled, freeNearby }: { enabled: boolean; freeNearby?: number }) {
  if (enabled) {
    return (
      <Bouncy onPress={() => router.push('/public')} squish={0.98} style={{ backgroundColor: Colors.surface, borderRadius: 28, padding: 20 }}>
        <Row gap={Spacing.lg}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.text, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="pin" size={22} color={Colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="heading">People nearby</T>
            <T variant="body" color={Colors.textSecondary}>
              {freeNearby ? `${freeNearby} free near you. Tap to see.` : 'See who’s free near you.'}
            </T>
          </View>
          <Icon name="chevron" size={16} color={Colors.textTertiary} />
        </Row>
      </Bouncy>
    );
  }
  return (
    <Bouncy onPress={() => router.push('/public')} squish={0.98} style={{ backgroundColor: Colors.surface, borderRadius: 28, padding: 22, gap: Spacing.lg }}>
      <View style={{ alignItems: 'center' }}>
        <NearbyIllustration size={200} />
      </View>
      <View style={{ gap: 6 }}>
        <T variant="title">Meet people nearby</T>
        <T variant="body" color={Colors.textSecondary}>
          Share a little free time with people near you, not just friends. If someone’s free at the same time, you can ask to hang out. Nothing happens unless you both say yes.
        </T>
      </View>
      <Row gap={8}>
        <T variant="label" style={{ textDecorationLine: 'underline' }}>
          See how it works
        </T>
        <Icon name="chevron" size={14} />
      </Row>
    </Bouncy>
  );
}
