import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AudiencePicker, type Audience } from '@/components/audience-picker';
import { TimeRangePicker, defaultRange } from '@/components/time-picker';
import { Avatar, Button, Card, Input, Row, Screen, Section, T, displayName } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage, notify } from '@/lib/alert';
import { createActivity, getFriends, getMyCircles, sendPing } from '@/lib/api';

const EMOJIS = ['🎉', '🍕', '☕️', '🍻', '🎳', '🏀', '🎮', '🎤', '🍜', '🌮', '🎬', '🥾', '🏖️', '🧋', '🛍️', '🎨'];

const IDEAS = [
  { emoji: '☕️', title: 'Coffee catch-up' },
  { emoji: '🍜', title: 'Dinner' },
  { emoji: '🎬', title: 'Movie night' },
  { emoji: '🥾', title: 'Hike' },
  { emoji: '🎮', title: 'Game night' },
  { emoji: '🍻', title: 'Drinks' },
];

export default function NewActivity() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ start?: string; end?: string; invite?: string; title?: string }>();
  const initialRange = useMemo(() => {
    const s = Number(params.start);
    const e = Number(params.end);
    if (s && e && e > s) {
      // Snap to half hours so the picker chips line up.
      const snap = (ms: number) => Math.round(ms / 1800000) * 1800000;
      return { start: snap(s), end: Math.max(snap(e), snap(s) + 3600000) };
    }
    return defaultRange();
  }, [params.start, params.end]);
  const initialInvite = useMemo(() => (params.invite ? params.invite.split(',').filter(Boolean) : []), [params.invite]);

  const [title, setTitle] = useState(params.title ?? '');
  const [emoji, setEmoji] = useState('🎉');
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [range, setRange] = useState(initialRange);
  const [audience, setAudience] = useState<Audience>(
    initialInvite.length ? { visibility: 'invite', circleId: null } : { visibility: 'friends', circleId: null },
  );
  const [invitees, setInvitees] = useState<string[]>(initialInvite);
  const [alsoPing, setAlsoPing] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data } = useData(async () => {
    const [friends, circles] = await Promise.all([getFriends(), getMyCircles()]);
    return { friends: friends.friends, circles };
  });

  const save = async () => {
    if (!title.trim()) return notify('Give it a name ✍️');
    if (audience.visibility === 'invite' && invitees.length === 0) return notify('Pick who to invite 👯');
    setSaving(true);
    try {
      const activity = await createActivity(
        {
          title: title.trim(),
          emoji,
          location: location.trim(),
          details: details.trim(),
          starts_at: new Date(range.start).toISOString(),
          ends_at: new Date(range.end).toISOString(),
          visibility: audience.visibility,
          circle_id: audience.circleId,
        },
        invitees,
      );
      // Pings go to all friends or a circle; invite-only plans stay quiet.
      if (alsoPing && audience.visibility !== 'invite') {
        await sendPing({
          message: `${emoji} ${title.trim()}${location.trim() ? ` @ ${location.trim()}` : ''} — join me?`,
          gif_url: null,
          sticker: emoji,
          starts_at: activity.starts_at,
          ends_at: activity.ends_at,
          visibility: audience.visibility === 'circle' ? 'circle' : 'friends',
          circle_id: audience.circleId,
          activity_id: activity.id,
          expires_at: new Date(
            Math.max(Math.min(range.start, Date.now() + 24 * 3600000), Date.now() + 15 * 60000),
          ).toISOString(),
        }).catch(() => {});
      }
      router.replace({ pathname: '/activity/[id]', params: { id: activity.id } });
    } catch (e) {
      notify("Couldn't create", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Section title="What's the plan?">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {IDEAS.map((i) => (
            <Button
              key={i.title}
              title={`${i.emoji} ${i.title}`}
              size="sm"
              variant={title === i.title ? 'accent' : 'secondary'}
              onPress={() => {
                setTitle(i.title);
                setEmoji(i.emoji);
              }}
            />
          ))}
        </View>
        <Input value={title} onChangeText={setTitle} placeholder="Tacos at Lupe's" maxLength={80} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {EMOJIS.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEmoji(e)}
              style={{
                width: 42,
                height: 42,
                borderRadius: Radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: e === emoji ? theme.accent : 'transparent',
                backgroundColor: theme.card,
              }}>
              <Text style={{ fontSize: 22 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section title="When">
        <Card>
          <TimeRangePicker value={range} onChange={setRange} />
        </Card>
      </Section>

      <Input label="📍 Where" value={location} onChangeText={setLocation} placeholder="Address or place name" />
      <Input label="📝 Details" value={details} onChangeText={setDetails} placeholder="Bring snacks! Meet by the fountain." multiline />

      <Section title="Who can see this?">
        <AudiencePicker value={audience} onChange={setAudience} circles={data?.circles ?? []} allowInvite />
        {audience.visibility === 'invite' ? (
          <Card style={{ gap: Spacing.sm }}>
            {(data?.friends ?? []).map((f) => {
              const on = invitees.includes(f.id);
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setInvitees((list) => (on ? list.filter((x) => x !== f.id) : [...list, f.id]))}>
                  <Row gap={Spacing.md}>
                    <Avatar profile={f} size={36} />
                    <T variant="label" style={{ flex: 1 }}>
                      {displayName(f)}
                    </T>
                    <Text style={{ fontSize: 20 }}>{on ? '✅' : '⬜️'}</Text>
                  </Row>
                </Pressable>
              );
            })}
            {data?.friends.length === 0 ? <T variant="caption">Add friends first 🙂</T> : null}
          </Card>
        ) : (
          <Pressable onPress={() => setAlsoPing((v) => !v)}>
            <Row>
              <Text style={{ fontSize: 20 }}>{alsoPing ? '✅' : '⬜️'}</Text>
              <T variant="label">Ping them so they know 📣</T>
            </Row>
          </Pressable>
        )}
      </Section>

      <Button title="Post hangout" icon="🚀" size="lg" onPress={save} loading={saving} />
    </Screen>
  );
}
