import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AudiencePicker, type Audience } from '@/components/audience-picker';
import { Icon } from '@/components/icon';
import { Bouncy, PopButton } from '@/components/playful';
import { Avatar, Chip, Input, Row, Screen, T, displayName } from '@/components/ui';
import { WhenField } from '@/components/when-field';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { errorMessage, notify } from '@/lib/alert';
import { createActivity, getFriends, getMyCircles, sendPing } from '@/lib/api';
import { PRESETS, type TimeRange } from '@/lib/when';

const IDEAS = [
  { label: 'Dinner', emoji: '🍜' },
  { label: 'Drinks', emoji: '🍸' },
  { label: 'Coffee', emoji: '☕️' },
  { label: 'Movie night', emoji: '🎬' },
  { label: 'Hike', emoji: '🥾' },
  { label: 'Game night', emoji: '🎮' },
];

export default function NewActivity() {
  const params = useLocalSearchParams<{ start?: string; end?: string; invite?: string; title?: string }>();
  const fromParams = useMemo<TimeRange | null>(() => {
    const s = Number(params.start);
    const e = Number(params.end);
    if (!s || !e || e <= s) return null;
    const snap = (ms: number) => Math.round(ms / 1800000) * 1800000;
    return { start: snap(s), end: Math.max(snap(e), snap(s) + 3600000) };
  }, [params.start, params.end]);
  const initialInvite = useMemo(() => (params.invite ? params.invite.split(',').filter(Boolean) : []), [params.invite]);

  const [title, setTitle] = useState(params.title ?? '');
  const [emoji, setEmoji] = useState('🎉');
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [range, setRange] = useState<TimeRange>(() => fromParams ?? (PRESETS[1].range() ?? PRESETS[2].range())!);
  const [audience, setAudience] = useState<Audience>(
    initialInvite.length ? { visibility: 'invite', circleId: null } : { visibility: 'friends', circleId: null },
  );
  const [invitees, setInvitees] = useState<string[]>(initialInvite);
  const [showWho, setShowWho] = useState(initialInvite.length > 0);
  const [showMore, setShowMore] = useState(false);
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
      // Let friends know (invite-only plans stay quiet).
      if (audience.visibility !== 'invite') {
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

  const whoLabel =
    audience.visibility === 'invite'
      ? invitees.length
        ? `${invitees.length} invited`
        : 'Pick who to invite'
      : audience.visibility === 'circle'
        ? (data?.circles ?? []).find((c) => c.id === audience.circleId)?.name ?? 'A circle'
        : 'All friends';

  return (
    <Screen edges={['bottom']} center={false}>
      <View style={{ gap: Spacing.lg }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What's the plan?"
          placeholderTextColor={Colors.textTertiary}
          maxLength={80}
          multiline
          style={{ fontFamily: Fonts.display, fontSize: 40, lineHeight: 46, color: Colors.text, paddingVertical: 4 }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {IDEAS.map((i) => (
            <Chip
              key={i.label}
              label={`${i.emoji}  ${i.label}`}
              selected={title === i.label}
              onPress={() => {
                setTitle(i.label);
                setEmoji(i.emoji);
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: Spacing.lg }}>
        <T variant="title">When?</T>
        <WhenField value={range} onChange={setRange} initialCustom={!!fromParams} />
      </View>

      <View style={{ gap: Spacing.lg }}>
        <T variant="title">Where?</T>
        <Input value={location} onChangeText={setLocation} placeholder="A place or address (optional)" />
      </View>

      <View style={{ gap: Spacing.lg }}>
        <Pressable onPress={() => setShowWho((v) => !v)} hitSlop={8}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="title">Who?</T>
            <T variant="label" style={{ textDecorationLine: 'underline' }}>
              {showWho ? 'Done' : whoLabel}
            </T>
          </Row>
        </Pressable>
        {showWho ? (
          <Animated.View entering={FadeInDown.duration(220)} style={{ gap: Spacing.lg }}>
            <AudiencePicker value={audience} onChange={setAudience} circles={data?.circles ?? []} allowInvite />
            {audience.visibility === 'invite' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg }}>
                {(data?.friends ?? []).map((f) => {
                  const on = invitees.includes(f.id);
                  return (
                    <Bouncy
                      key={f.id}
                      onPress={() => setInvitees((list) => (on ? list.filter((x) => x !== f.id) : [...list, f.id]))}
                      style={{ alignItems: 'center', gap: 6, width: 72 }}>
                      <View>
                        <Avatar profile={f} size={60} ring={on ? Colors.text : undefined} />
                        {on ? (
                          <View
                            style={{
                              position: 'absolute',
                              right: -2,
                              bottom: -2,
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: Colors.accent,
                              borderWidth: 2,
                              borderColor: Colors.background,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                            <Icon name="check" size={12} color={Colors.onAccent} />
                          </View>
                        ) : null}
                      </View>
                      <T variant="caption" color={Colors.text} numberOfLines={1}>
                        {displayName(f).split(' ')[0]}
                      </T>
                    </Bouncy>
                  );
                })}
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </View>

      <View style={{ gap: Spacing.lg }}>
        <Pressable onPress={() => setShowMore((v) => !v)} hitSlop={8}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="body" color={Colors.textSecondary}>
              Add details or change the cover
            </T>
            <Icon name={showMore ? 'close' : 'plus'} size={18} />
          </Row>
        </Pressable>
        {showMore ? (
          <Animated.View entering={FadeInDown.duration(220)} style={{ gap: Spacing.lg }}>
            <Input value={details} onChangeText={setDetails} placeholder="Anything people should know" multiline />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {['🎉', '🍜', '🍸', '☕️', '🎬', '🎳', '🥾', '🎮', '🎤', '🏖️'].map((e) => (
                <Bouncy
                  key={e}
                  onPress={() => setEmoji(e)}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: e === emoji ? Colors.accent : Colors.surface,
                    borderWidth: e === emoji ? 1.5 : 0,
                    borderColor: Colors.text,
                  }}>
                  <Text style={{ fontSize: 24 }}>{e}</Text>
                </Bouncy>
              ))}
            </View>
          </Animated.View>
        ) : null}
      </View>

      <PopButton onPress={save} disabled={saving}>
        <Row style={{ padding: 20, justifyContent: 'center' }}>
          <T variant="title" color={Colors.onAccent}>
            {saving ? 'Creating…' : 'Create hangout'}
          </T>
        </Row>
      </PopButton>
    </Screen>
  );
}
