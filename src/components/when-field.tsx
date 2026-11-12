import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Colors, Spacing } from '@/constants/theme';
import { formatTime } from '@/lib/time';
import { PRESETS, describeRange, type TimeRange } from '@/lib/when';

import { Chip, T } from './ui';
import { WhenPicker } from './when-picker';

/**
 * "When?" — quick choices (Right now, Tonight…) plus "Pick a date", which opens
 * the calendar picker. Controlled: the parent owns the range.
 */
export function WhenField({
  value,
  onChange,
  repeat,
  onRepeatChange,
  initialCustom = false,
}: {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
  repeat?: boolean;
  onRepeatChange?: (on: boolean) => void;
  initialCustom?: boolean;
}) {
  const [presets] = useState(() => PRESETS.map((p) => ({ ...p, r: p.range() })).filter((p) => p.r !== null));
  const [mode, setMode] = useState<string>(() => {
    if (initialCustom) return 'custom';
    const match = presets.find((p) => p.r!.start === value.start && p.r!.end === value.end);
    return match?.key ?? 'custom';
  });

  return (
    <View style={{ gap: Spacing.lg }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {presets.map((p) => (
          <Chip
            key={p.key}
            label={p.label}
            selected={mode === p.key}
            onPress={() => {
              setMode(p.key);
              onChange(p.r!);
              onRepeatChange?.(false);
            }}
          />
        ))}
        <Chip label="Pick a date" selected={mode === 'custom'} onPress={() => setMode('custom')} />
      </View>

      {mode === 'custom' ? (
        <WhenPicker value={value} onChange={onChange} repeat={repeat} onRepeatChange={onRepeatChange} />
      ) : null}

      <Animated.View key={`${value.start}-${value.end}-${repeat}`} entering={FadeIn.duration(200)}>
        <T variant="body" color={Colors.textSecondary}>
          {describeRange(value, formatTime)}
          {repeat ? ' · every week' : ''}
        </T>
      </Animated.View>
    </View>
  );
}
