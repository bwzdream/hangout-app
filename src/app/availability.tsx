import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { TimeRangePicker, defaultRange } from '@/components/time-picker';
import { Button, Card, Chip, Loading, Row, Screen, Section, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { errorMessage, notify } from '@/lib/alert';
import { addFreeSlot, addRules, deleteFreeSlot, deleteRule, getAvailability, getMyFreeSlots, getMyRules } from '@/lib/api';
import { suggestRecurringRules } from '@/lib/availability';
import { DAY_MS, WEEKDAYS, formatRange, minutesToLabel } from '@/lib/time';
import { useAuth } from '@/providers/auth';

const PRESETS = [
  { label: '🌙 Weeknights 6–10pm', days: [1, 2, 3, 4], start: 18 * 60, end: 22 * 60 },
  { label: '🎉 Friday nights', days: [5], start: 18 * 60, end: 23 * 60 + 59 },
  { label: '☀️ Weekend afternoons', days: [0, 6], start: 11 * 60, end: 17 * 60 },
  { label: '🥞 Weekend brunch', days: [0, 6], start: 10 * 60, end: 13 * 60 },
];

const TIMES = Array.from({ length: 37 }, (_, i) => 6 * 60 + i * 30); // 6am → midnight

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
      // Only suggest from calendar data if the user has actually synced a calendar.
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
      notify('Oops', errorMessage(e));
    }
  };

  const addRoutine = () => {
    if (days.length === 0) return notify('Pick at least one day 📆');
    if (end <= start) return notify('End time should be after start time ⏰');
    run(async () => {
      await addRules(days.map((weekday) => ({ weekday, start_minute: start, end_minute: end })));
      setDays([]);
    });
  };

  if (loading && !data) return <Loading />;

  return (
    <Screen edges={['bottom']}>
      <T variant="caption">
        Friends see these times (minus anything busy on your synced calendar). Add one-off free time below.
      </T>

      {data && data.learned.length > 0 ? (
        <Section title="From your calendar ✨">
          <T variant="caption" style={{ marginTop: -6 }}>
            These have been open on your calendar for the next few weeks:
          </T>
          {data.learned.map((r) => (
            <Card key={`${r.weekday}-${r.start_minute}`} tone="accentSoft">
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="label">
                  {WEEKDAYS[r.weekday]} {minutesToLabel(r.start_minute)}–{minutesToLabel(r.end_minute)}
                </T>
                <Button title="Add" size="sm" variant="accent" onPress={() => run(() => addRules([r]))} />
              </Row>
            </Card>
          ))}
        </Section>
      ) : null}

      <Section title="Weekly routine">
        {WEEKDAYS.map((name, weekday) =>
          grouped[weekday]?.length ? (
            <Card key={weekday}>
              <T variant="label">{name}</T>
              {grouped[weekday].map((r) => (
                <Row key={r.id} style={{ justifyContent: 'space-between' }}>
                  <T>
                    {minutesToLabel(r.start_minute)} – {minutesToLabel(r.end_minute)}
                  </T>
                  <Button title="Remove" variant="danger" size="sm" onPress={() => run(() => deleteRule(r.id))} />
                </Row>
              ))}
            </Card>
          ) : null,
        )}
        {data?.rules.length === 0 ? <T variant="caption">Nothing yet — try a preset 👇</T> : null}
      </Section>

      <Section title="Quick presets">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((p) => (
            <Chip
              key={p.label}
              label={p.label}
              onPress={() =>
                run(() => addRules(p.days.map((weekday) => ({ weekday, start_minute: p.start, end_minute: p.end }))))
              }
            />
          ))}
        </View>
      </Section>

      <Section title="Custom routine">
        <Card style={{ gap: Spacing.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {WEEKDAYS.map((name, i) => (
              <Chip
                key={name}
                label={name}
                selected={days.includes(i)}
                onPress={() => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))}
              />
            ))}
          </View>
          <T variant="label">From</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TIMES.slice(0, -1).map((m) => (
              <Chip key={m} label={minutesToLabel(m)} selected={m === start} onPress={() => setStart(m)} />
            ))}
          </ScrollView>
          <T variant="label">Until</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TIMES.slice(1).map((m) => (
              <Chip key={m} label={m === 1440 ? 'midnight' : minutesToLabel(m)} selected={m === end} onPress={() => setEnd(m)} />
            ))}
          </ScrollView>
          <Button title="Add to routine" onPress={addRoutine} />
        </Card>
      </Section>

      <Section
        title="One-off free time"
        action={<Button title={showSlot ? 'Close' : '+ Add'} variant="ghost" size="sm" onPress={() => setShowSlot((s) => !s)} />}>
        {showSlot ? (
          <Card style={{ gap: Spacing.md }}>
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
        {data?.slots.map((s) => (
          <Card key={s.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="label" style={{ flex: 1 }}>
                {formatRange(s.starts_at, s.ends_at)}
              </T>
              <Button title="Remove" variant="danger" size="sm" onPress={() => run(() => deleteFreeSlot(s.id))} />
            </Row>
          </Card>
        ))}
        {data?.slots.length === 0 && !showSlot ? <T variant="caption">No one-off free time coming up.</T> : null}
      </Section>
    </Screen>
  );
}
