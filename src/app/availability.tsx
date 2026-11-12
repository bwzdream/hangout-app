import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { Button, Chip, Loading, Row, Screen, T } from '@/components/ui';
import { WhenPicker } from '@/components/when-picker';
import { Colors, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { errorMessage, notify } from '@/lib/alert';
import { addFreeSlot, addRules, deleteFreeSlot, deleteRule, getAvailability, getMyFreeSlots, getMyRules } from '@/lib/api';
import { suggestRecurringRules } from '@/lib/availability';
import { DAY_MS, WEEKDAYS, formatDay, formatTime, minutesToLabel } from '@/lib/time';
import { PRESETS, minuteOfDay, type TimeRange } from '@/lib/when';
import { useAuth } from '@/providers/auth';

const QUICK = [
  { label: 'Weeknights', days: [1, 2, 3, 4], start: 18 * 60, end: 22 * 60 },
  { label: 'Friday nights', days: [5], start: 18 * 60, end: 23 * 60 + 59 },
  { label: 'Weekend afternoons', days: [0, 6], start: 11 * 60, end: 17 * 60 },
];

const timeLabel = (m: number) => (m >= 1439 ? 'midnight' : minutesToLabel(m));

/** "Mon–Thu", "Sat & Sun", "Fridays"… */
function daysLabel(days: number[]) {
  const d = [...days].sort((a, b) => a - b);
  if (d.length === 1) return `${['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][d[0]]}`;
  if (d.length === 7) return 'Every day';
  if (d.join() === '0,6') return 'Weekends';
  if (d.join() === '1,2,3,4,5') return 'Weekdays';
  const consecutive = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  if (consecutive && d.length > 2) return `${WEEKDAYS[d[0]]}–${WEEKDAYS[d[d.length - 1]]}`;
  return d.map((x) => WEEKDAYS[x]).join(', ');
}

export default function Availability() {
  const { session } = useAuth();
  const meId = session?.user.id;
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<TimeRange>(() => PRESETS[2].range()!);
  const [repeat, setRepeat] = useState(true);

  const { data, loading, reload } = useData(async () => {
    const [rules, slots] = await Promise.all([getMyRules(), getMyFreeSlots()]);
    let learned: ReturnType<typeof suggestRecurringRules> = [];
    if (meId) {
      const now = Date.now();
      const avail = await getAvailability([meId], { start: now, end: now + 21 * DAY_MS });
      if (avail[meId]?.busy.length) learned = suggestRecurringRules(avail[meId], now);
    }
    return { rules, slots, learned };
  });

  // Group identical times across days: "Mon–Thu · 6pm – 10pm".
  const groups = useMemo(() => {
    const map = new Map<string, { start: number; end: number; days: number[]; ids: string[] }>();
    for (const r of data?.rules ?? []) {
      const key = `${r.start_minute}-${r.end_minute}`;
      const g = map.get(key) ?? { start: r.start_minute, end: r.end_minute, days: [], ids: [] };
      if (!g.days.includes(r.weekday)) g.days.push(r.weekday);
      g.ids.push(r.id);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => Math.min(...a.days) - Math.min(...b.days) || a.start - b.start);
  }, [data]);
  const freeDays = new Set((data?.rules ?? []).map((r) => r.weekday));

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reload();
    } catch (e) {
      notify('Something went wrong', errorMessage(e));
    }
  };

  const save = () =>
    run(async () => {
      if (repeat) {
        const end = minuteOfDay(draft.end) || 1440;
        await addRules([{ weekday: new Date(draft.start).getDay(), start_minute: minuteOfDay(draft.start), end_minute: end }]);
      } else {
        await addFreeSlot(new Date(draft.start).toISOString(), new Date(draft.end).toISOString());
      }
      setAdding(false);
    });

  if (loading && !data) return <Loading />;

  return (
    <Screen edges={['bottom']} center={false}>
      <View style={{ gap: Spacing.md }}>
        <T variant="largeTitle">When are you usually free?</T>
        <T variant="body" color={Colors.textSecondary}>
          Friends see these times, minus anything busy on your calendar.
        </T>
      </View>

      {/* Week at a glance */}
      <Row style={{ justifyContent: 'space-between' }}>
        {WEEKDAYS.map((d, i) => {
          const on = freeDays.has(i);
          return (
            <View key={d} style={{ alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? Colors.accent : 'transparent',
                  borderWidth: 1.5,
                  borderColor: on ? Colors.text : Colors.outline,
                }}>
                <T variant="label" color={on ? Colors.onAccent : Colors.textTertiary} style={{ fontWeight: '700' }}>
                  {d[0]}
                </T>
              </View>
            </View>
          );
        })}
      </Row>

      <View style={{ gap: Spacing.lg }}>
        {groups.length === 0 ? (
          <T variant="body" color={Colors.textSecondary}>
            Nothing yet. Tap one to start:
          </T>
        ) : null}
        {groups.map((g) => (
          <Animated.View key={`${g.start}-${g.end}`} layout={LinearTransition} exiting={FadeOut}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <T variant="title">{daysLabel(g.days)}</T>
                <T variant="body" color={Colors.textSecondary}>
                  {timeLabel(g.start)} – {timeLabel(g.end)}
                </T>
              </View>
              <Pressable hitSlop={10} accessibilityLabel="Remove" onPress={() => run(() => Promise.all(g.ids.map(deleteRule)))}>
                <Icon name="close" size={18} color={Colors.textTertiary} />
              </Pressable>
            </Row>
          </Animated.View>
        ))}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {QUICK.map((p) => (
            <Chip
              key={p.label}
              label={`+ ${p.label}`}
              onPress={() => run(() => addRules(p.days.map((weekday) => ({ weekday, start_minute: p.start, end_minute: p.end }))))}
            />
          ))}
          {(data?.learned ?? []).slice(0, 2).map((r) => (
            <Chip
              key={`l${r.weekday}-${r.start_minute}`}
              label={`✨ ${WEEKDAYS[r.weekday]} ${minutesToLabel(r.start_minute)}`}
              onPress={() => run(() => addRules([r]))}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: Spacing.lg }}>
        {adding ? (
          <Animated.View entering={FadeInDown.duration(240)} style={{ gap: Spacing.xl }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="title">Add a time</T>
              <Pressable hitSlop={10} onPress={() => setAdding(false)}>
                <Icon name="close" size={18} />
              </Pressable>
            </Row>
            <WhenPicker value={draft} onChange={setDraft} repeat={repeat} onRepeatChange={setRepeat} />
            <Button title={repeat ? `Free every ${new Date(draft.start).toLocaleDateString(undefined, { weekday: 'long' })}` : "I'm free then"} size="lg" onPress={save} />
          </Animated.View>
        ) : (
          <Button title="Add a time" icon="plus" variant="secondary" size="lg" onPress={() => setAdding(true)} />
        )}
      </View>

      {data && data.slots.length > 0 ? (
        <View style={{ gap: Spacing.lg }}>
          <T variant="title">Coming up</T>
          {data.slots.map((s) => (
            <Animated.View key={s.id} layout={LinearTransition} exiting={FadeOut}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="body">
                  {formatDay(s.starts_at)}, {formatTime(s.starts_at)} – {formatTime(s.ends_at)}
                </T>
                <Pressable hitSlop={10} accessibilityLabel="Remove" onPress={() => run(() => deleteFreeSlot(s.id))}>
                  <Icon name="close" size={18} color={Colors.textTertiary} />
                </Pressable>
              </Row>
            </Animated.View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
