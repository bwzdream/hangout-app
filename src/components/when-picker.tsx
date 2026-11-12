/**
 * One time picker for the whole app:
 *   month calendar → part of day → fine-tune with − / + → optional "repeat weekly".
 */
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Colors, Spacing } from '@/constants/theme';
import { formatTime } from '@/lib/time';
import { DAYPARTS, atMinute, dayStart, minuteOfDay, type TimeRange } from '@/lib/when';

import { MonthCalendar } from './calendar-views';
import { Bouncy } from './bouncy';
import { Icon } from './icon';
import { Chip, IconButton, Row, T } from './ui';

const STEP = 30;

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T variant="body" color={Colors.textSecondary}>
        {label}
      </T>
      <Row gap={14}>
        <Bouncy onPress={onMinus} accessibilityLabel={`Earlier ${label}`} style={stepBtn}>
          <T variant="heading">−</T>
        </Bouncy>
        <T variant="title" style={{ minWidth: 104, textAlign: 'center' }}>
          {value}
        </T>
        <Bouncy onPress={onPlus} accessibilityLabel={`Later ${label}`} style={stepBtn}>
          <Icon name="plus" size={16} />
        </Bouncy>
      </Row>
    </Row>
  );
}

const stepBtn = {
  width: 40,
  height: 40,
  borderRadius: 20,
  borderWidth: 1.5,
  borderColor: Colors.text,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

export function WhenPicker({
  value,
  onChange,
  repeat,
  onRepeatChange,
}: {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
  /** Pass these to offer "repeat every week". */
  repeat?: boolean;
  onRepeatChange?: (on: boolean) => void;
}) {
  const [today] = useState(() => dayStart(Date.now()));
  const [month, setMonth] = useState(() => new Date(value.start));
  const day = dayStart(value.start);
  const startMin = minuteOfDay(value.start);
  const endMin = value.end - day >= 24 * 3600000 ? 24 * 60 : minuteOfDay(value.end);

  const set = (d: number, s: number, e: number) => {
    const start = Math.max(0, Math.min(s, 23 * 60 + 30));
    const end = Math.max(start + STEP, Math.min(e, 24 * 60));
    onChange({ start: atMinute(d, start), end: atMinute(d, end) });
  };

  const weekday = new Date(value.start).toLocaleDateString(undefined, { weekday: 'long' });
  const shiftMonth = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <Animated.View entering={FadeInDown.duration(240)} style={{ gap: Spacing.xl }}>
      <View style={{ gap: Spacing.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="title">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</T>
          <Row>
            <IconButton icon="chevronLeft" label="Previous month" onPress={() => shiftMonth(-1)} />
            <IconButton icon="chevron" label="Next month" onPress={() => shiftMonth(1)} />
          </Row>
        </Row>
        <MonthCalendar
          month={month}
          selected={day}
          marks={{}}
          minDay={today}
          onSelect={(d) => set(d, startMin, endMin)}
        />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {DAYPARTS.map((p) => (
          <Chip
            key={p.label}
            label={p.label}
            selected={startMin === p.start && endMin === p.end}
            onPress={() => set(day, p.start, p.end)}
          />
        ))}
      </View>

      <View style={{ gap: Spacing.lg }}>
        <Stepper
          label="From"
          value={formatTime(value.start)}
          onMinus={() => set(day, startMin - STEP, endMin)}
          onPlus={() => set(day, startMin + STEP, Math.max(endMin, startMin + 2 * STEP))}
        />
        <Stepper
          label="Until"
          value={endMin >= 24 * 60 ? 'Midnight' : formatTime(value.end)}
          onMinus={() => set(day, startMin, Math.max(startMin + STEP, endMin - STEP))}
          onPlus={() => set(day, startMin, endMin + STEP)}
        />
      </View>

      {onRepeatChange ? (
        <Pressable onPress={() => onRepeatChange(!repeat)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="heading">Repeat every {weekday}</T>
              <T variant="caption">Adds this to your weekly free time.</T>
            </View>
            <Switch
              value={!!repeat}
              onValueChange={onRepeatChange}
              trackColor={{ false: Colors.surfaceRaised, true: Colors.accent }}
              thumbColor={Colors.white}
              ios_backgroundColor={Colors.surfaceRaised}
            />
          </Row>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
