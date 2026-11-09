import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { TimeRangePicker, defaultRange } from '@/components/time-picker';
import { Button, Card, Chip, List, ListRow, Loading, Row, Screen, Section, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { errorMessage, notify } from '@/lib/alert';
import { addFreeSlot, addRules, deleteFreeSlot, deleteRule, getAvailability, getMyFreeSlots, getMyRules } from '@/lib/api';
import { suggestRecurringRules } from '@/lib/availability';
import { DAY_MS, WEEKDAYS, formatDay, formatTime, minutesToLabel } from '@/lib/time';
import { useAuth } from '@/providers/auth';

const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PRESETS = [
  { label: 'Weeknights', days: [1, 2, 3, 4], start: 18 * 60, end: 22 * 60 },
  { label: 'Friday nights', days: [5], start: 18 * 60, end: 23 * 60 + 59 },
  { label: 'Weekend afternoons', days: [0, 6], start: 11 * 60, end: 17 * 60 },
  { label: 'Weekend brunch', days: [0, 6], start: 10 * 60, end: 13 * 60 },
];

const TIMES = Array.from({ length: 37 }, (_, i) => 6 * 60 + i * 30); // 6am → midnight

function RemoveLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable hitSlop={8} onPress={onPress}>
      <T variant="caption" color={Colors.textTertiary}>
        Remove
      </T>
    </Pressable>
  );
}

export default function Availability() {
  const { session } = useAuth();
  const meId = session?.user.id;
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState(18 * 60);
  const [end, setEnd] = useState(22 * 60);
  const [slot, setSlot] = useState(defaultRange);
  const [showSlot, setShowSlot] = useState(false);

  const { data, loading, reload } = useData(async () => {
    const [rules, slots] = await Promise.all([getMyRules(), getMyFreeSlots()]);
    let learned: ReturnType<typeof suggestRecurringRules> = [];
    if (meId) {
      const now = Date.now();
      const avail = await getAvailability([meId], { start: now, end: now + 21 * DAY_MS });
      // Only learn from calendar data if a calendar has actually been synced.
      if (avail[meId]?.busy.length) learned = suggestRecurringRules(avail[meId], now);
    }
    return { rules, slots, learned };
  });

  const grouped = useMemo(() => {
    const g: Record<number, NonNullable<typeof data>['rules']> = {};
    for (const r of data?.rules ?? []) (g[r.weekday] ??= []).push(r);
    return g;
  }, [data]);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reload();
    } catch (e) {
      notify('Something went wrong', errorMessage(e));
    }
  };

  const addRoutine = () => {
    if (days.length === 0) return notify('Pick at least one day');
    if (end <= start) return notify('End time must be after start time');
    run(async () => {
      await addRules(days.map((weekday) => ({ weekday, start_minute: start, end_minute: end })));
      setDays([]);
    });
  };

  if (loading && !data) return <Loading />;

  const ruleRows = WEEKDAYS.flatMap((_, weekday) =>
    (grouped[weekday] ?? []).map((r) => (
      <ListRow
        key={r.id}
        title={FULL_DAYS[weekday]}
        subtitle={`${minutesToLabel(r.start_minute)} – ${r.end_minute === 1440 ? 'midnight' : minutesToLabel(r.end_minute)}`}
        chevron={false}
        right={<RemoveLink onPress={() => run(() => deleteRule(r.id))} />}
      />
    )),
  );

  return (
    <Screen edges={['bottom']}>
      <T variant="caption">
        Friends see these times, minus anything busy on your synced calendars.
      </T>

      {data && data.learned.length > 0 ? (
        <Section title="Suggested from your calendar">
          <List>
            {data.learned.map((r) => (
              <ListRow
                key={`${r.weekday}-${r.start_minute}`}
                icon="sparkle"
                title={FULL_DAYS[r.weekday]}
                subtitle={`${minutesToLabel(r.start_minute)} – ${minutesToLabel(r.end_minute)} has been open`}
                chevron={false}
                right={<Button title="Add" size="sm" onPress={() => run(() => addRules([r]))} />}
              />
            ))}
          </List>
        </Section>
      ) : null}

      <Section title="Weekly routine">
        {ruleRows.length > 0 ? <List>{ruleRows}</List> : <T variant="caption">Nothing yet. Start with a preset.</T>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((p) => (
            <Chip
              key={p.label}
              label={`+ ${p.label}`}
              onPress={() => run(() => addRules(p.days.map((weekday) => ({ weekday, start_minute: p.start, end_minute: p.end }))))}
            />
          ))}
        </View>
      </Section>

      <Section title="Custom">
        <Card style={{ gap: Spacing.lg }}>
          <Row gap={6} style={{ justifyContent: 'space-between' }}>
            {WEEKDAYS.map((name, i) => {
              const on = days.includes(i);
              return (
                <Pressable
                  key={name}
                  onPress={() => setDays((d) => (on ? d.filter((x) => x !== i) : [...d, i]))}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    maxWidth: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? Colors.white : Colors.surfaceRaised,
                  }}>
                  <T variant="label" color={on ? Colors.onAccent : Colors.textSecondary} style={{ fontSize: 13 }}>
                    {name.slice(0, 1)}
                  </T>
                </Pressable>
              );
            })}
          </Row>
          <T variant="overline">From</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TIMES.slice(0, -1).map((m) => (
              <Chip key={m} label={minutesToLabel(m)} selected={m === start} onPress={() => setStart(m)} />
            ))}
          </ScrollView>
          <T variant="overline">Until</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TIMES.slice(1).map((m) => (
              <Chip key={m} label={m === 1440 ? 'midnight' : minutesToLabel(m)} selected={m === end} onPress={() => setEnd(m)} />
            ))}
          </ScrollView>
          <Button title="Add to routine" variant="white" onPress={addRoutine} />
        </Card>
      </Section>

      <Section
        title="One-off free time"
        action={
          <Pressable hitSlop={8} onPress={() => setShowSlot((s) => !s)}>
            <T variant="caption" color={Colors.text} style={{ fontWeight: '600' }}>
              {showSlot ? 'Close' : 'Add'}
            </T>
          </Pressable>
        }>
        {showSlot ? (
          <Card style={{ gap: Spacing.lg }}>
            <TimeRangePicker value={slot} onChange={setSlot} />
            <Button
              title="I'm free then"
              onPress={() =>
                run(async () => {
                  await addFreeSlot(new Date(slot.start).toISOString(), new Date(slot.end).toISOString());
                  setShowSlot(false);
                })
              }
            />
          </Card>
        ) : null}
        {data && data.slots.length > 0 ? (
          <List>
            {data.slots.map((s) => (
              <ListRow
                key={s.id}
                title={formatDay(s.starts_at)}
                subtitle={`${formatTime(s.starts_at)} – ${formatTime(s.ends_at)}`}
                chevron={false}
                right={<RemoveLink onPress={() => run(() => deleteFreeSlot(s.id))} />}
              />
            ))}
          </List>
        ) : !showSlot ? (
          <T variant="caption">No one-off free time coming up.</T>
        ) : null}
      </Section>
    </Screen>
  );
}
