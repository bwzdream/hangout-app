/**
 * Visual effects for hangout cards:
 *  - LiquidGradient: slowly drifting, blurred color blobs ("liquid" background)
 *  - Glass: frosted glass panel (native Liquid Glass on iOS 26+, blur elsewhere)
 *  - TiltCard: 3D tilt toward the finger/cursor with a moving sheen
 */
import { BlurTargetView, BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, View, type HostInstance, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Colors, Radius, isLight } from '@/constants/theme';

// ─── Palettes ────────────────────────────────────────────────
// Palettes come from the active theme (brand colors only).
export const PALETTES = Colors.palettes;

export type Palette = [string, string, string];

export function paletteFor(seed: string): Palette {
  let h = 0;
  for (const c of seed) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

// Android blurs a specific target view; share it with Glass panels inside the card.
const BlurTargetContext = createContext<RefObject<HostInstance | null> | null>(null);

// ─── Liquid gradient ─────────────────────────────────────────
function Blob({ color, size, from, to, duration }: { color: string; size: number; from: [number, number]; to: [number, number]; duration: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [t, duration]);
  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      transform: [
        { translateX: interpolate(p, [0, 1], [from[0], to[0]]) },
        { translateY: interpolate(p, [0, 1], [from[1], to[1]]) },
        { scale: interpolate(p, [0, 0.5, 1], [1, 1.25, 0.95]) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: 0.9 },
        style,
      ]}
    />
  );
}

const webBlur = Platform.OS === 'web' ? ({ filter: 'blur(38px) saturate(140%)' } as unknown as ViewStyle) : null;

/** Absolutely-fills its parent with a slowly moving, blurred gradient. */
export function LiquidGradient({ palette, children }: { palette: Palette; children?: ReactNode }) {
  const target = useRef<HostInstance>(null);
  const [size, setSize] = useState({ w: 340, h: 240 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const { w, h } = size;
  const blob = Math.max(w, h) * 0.85;

  return (
    <BlurTargetContext.Provider value={target}>
      <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
        <BlurTargetView ref={target} style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: palette[2] }]}>
          <View style={[StyleSheet.absoluteFill, webBlur]}>
            <Blob color={palette[0]} size={blob} from={[-blob * 0.35, -blob * 0.4]} to={[w * 0.35, h * 0.05]} duration={9000} />
            <Blob color={palette[1]} size={blob * 0.8} from={[w * 0.55, h * 0.1]} to={[w * 0.05, h * 0.45]} duration={11000} />
            <Blob color={palette[2]} size={blob * 0.9} from={[w * 0.2, h * 0.55]} to={[w * 0.6, -h * 0.2]} duration={13000} />
          </View>
        </BlurTargetView>
        {Platform.OS !== 'web' ? (
          <BlurView
            intensity={70}
            tint={isLight ? 'light' : 'dark'}
            blurTarget={target}
            blurMethod="dimezisBlurViewSdk31Plus"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {/* Legibility scrim + film grain–like depth at the bottom */}
        <LinearGradient
          colors={Colors.scrim}
          locations={[0.15, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children}
    </BlurTargetContext.Provider>
  );
}

// ─── Glass ───────────────────────────────────────────────────
const liquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

export function Glass({
  children,
  style,
  radius = Radius.lg,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}) {
  const target = useContext(BlurTargetContext);
  const frame: StyleProp<ViewStyle> = [
    { borderRadius: radius, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)' },
    style,
  ];

  if (liquidGlass) {
    return (
      <GlassView glassEffectStyle="regular" tintColor="rgba(10,10,11,0.25)" style={frame}>
        {children}
      </GlassView>
    );
  }

  return (
    <View style={frame}>
      {Platform.OS === 'web' ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(20,20,24,0.32)', borderRadius: radius },
            { backdropFilter: 'blur(22px) saturate(160%)', WebkitBackdropFilter: 'blur(22px) saturate(160%)' } as unknown as ViewStyle,
          ]}
        />
      ) : (
        <BlurView
          intensity={45}
          tint="systemUltraThinMaterialDark"
          blurTarget={target ?? undefined}
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
      )}
      {/* Top highlight, like light catching the edge of glass */}
      <LinearGradient
        colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

// ─── 3D tilt ─────────────────────────────────────────────────
const MAX_TILT = 9; // degrees

function Sheen({ ry, rx }: { ry: SharedValue<number>; rx: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(ry.get()) + Math.abs(rx.get()), [0, MAX_TILT * 2], [0.05, 0.4]),
    transform: [{ translateX: interpolate(ry.get(), [-MAX_TILT, MAX_TILT], [-160, 160]) }, { rotate: '20deg' }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -80, bottom: -80, left: '30%', width: 120 }, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', Colors.sheen, 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/** A card that tilts in 3D toward the pointer (web) or finger (native) and springs back. */
export function TiltCard({
  children,
  onPress,
  height,
  glow,
  radius = Radius.xl,
}: {
  children: ReactNode;
  onPress?: () => void;
  height: number;
  glow: string;
  radius?: number;
}) {
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const scale = useSharedValue(1);
  const box = useRef({ w: 1, h: 1 });

  const tiltTo = (x: number, y: number) => {
    const nx = Math.max(0, Math.min(1, x / box.current.w)) - 0.5;
    const ny = Math.max(0, Math.min(1, y / box.current.h)) - 0.5;
    ry.set(withSpring(nx * 2 * MAX_TILT, { damping: 18, stiffness: 180 }));
    rx.set(withSpring(-ny * 2 * MAX_TILT, { damping: 18, stiffness: 180 }));
  };
  const reset = () => {
    rx.set(withSpring(0, { damping: 14, stiffness: 120 }));
    ry.set(withSpring(0, { damping: 14, stiffness: 120 }));
    scale.set(withSpring(1));
  };

  const animated = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateX: `${rx.get()}deg` }, { rotateY: `${ry.get()}deg` }, { scale: scale.get() }],
  }));

  const shadow: ViewStyle =
    Platform.OS === 'web'
      ? ({ boxShadow: `0 18px 50px -18px ${glow}` } as unknown as ViewStyle)
      : { shadowColor: glow, shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 10 };

  const pointer =
    Platform.OS === 'web'
      ? {
          onPointerMove: (e: { nativeEvent: { offsetX: number; offsetY: number } }) => tiltTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY),
          onPointerLeave: reset,
        }
      : {
          onTouchStart: (e: { nativeEvent: { locationX: number; locationY: number } }) => {
            scale.set(withSpring(0.98));
            tiltTo(e.nativeEvent.locationX, e.nativeEvent.locationY);
          },
          onTouchMove: (e: { nativeEvent: { locationX: number; locationY: number } }) => tiltTo(e.nativeEvent.locationX, e.nativeEvent.locationY),
          onTouchEnd: reset,
          onTouchCancel: reset,
        };

  return (
    <Animated.View
      onLayout={(e) => {
        box.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
      }}
      style={[{ height, borderRadius: radius }, shadow, animated]}
      {...(pointer as object)}>
      <Pressable onPress={onPress} style={{ flex: 1, borderRadius: radius, overflow: 'hidden' }}>
        {children}
        <Sheen rx={rx} ry={ry} />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' }]}
        />
      </Pressable>
    </Animated.View>
  );
}
