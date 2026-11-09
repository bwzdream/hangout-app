import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AudiencePicker, type Audience } from '@/components/audience-picker';
import { Icon } from '@/components/icon';
import { TimeRangePicker, defaultRange } from '@/components/time-picker';
import { Avatar, Button, Card, Chip, Input, List, ListRow, Row, Screen, Section, T, displayName } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { errorMessage, notify } from '@/lib/alert';
import { createActivity, getFriends, getMyCircles, sendPing } from '@/lib/api';

const COVERS = ['🍸', '🍜', '☕️', '🎬', '🎳', '🏀', '🎮', '🎤', '🥾', '🏖️', '🎨', '🎉'];
const IDEAS = ['Dinner', 'Drinks', 'Coffee', 'Movie night', 'Hike', 'Game night'];

export default function NewActivity() {
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
  const [emoji, setEmoji] = useState('🍸');
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
    if (!title.trim()) return notify('Give your hangout a name');
    if (audience.visibility === 'invite' && invitees.length === 0) return notify('Choose who to invite');
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
          message: `${title.trim()}${location.trim() ? ` at ${location.trim()}` : ''}. Join?`,
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
      notify("Couldn't create hangout", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: Spacing.md }}>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="Name your hangout"
          maxLength={80}
          style={{ fontSize: 24, fontWeight: '700', paddingVertical: 18 }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {IDEAS.map((i) => (
            <Chip key={i} label={i} selected={title === i} onPress={() => setTitle(i)} />
          ))}
        </View>
      </View>

      <Section title="Cover">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {COVERS.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEmoji(e)}
              style={{
                width: 48,
                height: 48,
                borderRadius: Radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: e === emoji ? Colors.surfacePressed : Colors.surface,
                borderWidth: 1.5,
                borderColor: e === emoji ? Colors.accent : 'transparent',
              }}>
              <Text style={{ fontSize: 22 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Card>
        <TimeRangePicker value={range} onChange={setRange} />
      </Card>

      <View style={{ gap: Spacing.lg }}>
        <Input label="Location" value={location} onChangeText={setLocation} placeholder="Add a place or address" />
        <Input label="Details" value={details} onChangeText={setDetails} placeholder="Anything people should know" multiline />
      </View>

      <Section title="Who can see it">
        <AudiencePicker value={audience} onChange={setAudience} circles={data?.circles ?? []} allowInvite />
        {audience.visibility === 'invite' ? (
          <List>
            {(data?.friends ?? []).map((f) => {
              const on = invitees.includes(f.id);
              return (
                <ListRow
                  key={f.id}
                  title={displayName(f)}
                  left={<Avatar profile={f} size={32} />}
                  chevron={false}
                  onPress={() => setInvitees((list) => (on ? list.filter((x) => x !== f.id) : [...list, f.id]))}
                  right={
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: on ? Colors.accent : 'transparent',
                        borderWidth: on ? 0 : 1.5,
                        borderColor: Colors.textTertiary,
                      }}>
                      {on ? <Icon name="check" size={14} color={Colors.onAccent} /> : null}
                    </View>
                  }
                />
              );
            })}
          </List>
        ) : (
          <Pressable onPress={() => setAlsoPing((v) => !v)}>
            <Row>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: alsoPing ? Colors.accent : 'transparent',
                  borderWidth: alsoPing ? 0 : 1.5,
                  borderColor: Colors.textTertiary,
                }}>
                {alsoPing ? <Icon name="check" size={13} color={Colors.onAccent} /> : null}
              </View>
              <T variant="label">Notify them with a ping</T>
            </Row>
          </Pressable>
        )}
      </Section>

      <Button title="Create hangout" size="lg" variant="white" onPress={save} loading={saving} />
    </Screen>
  );
}
