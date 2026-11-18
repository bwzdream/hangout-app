/**
 * "I'm free" — tell friends when you're free. Plain words, one decision at a time:
 *   1. When?  2. (optional) What do you feel like doing?  3. Tell my friends.
 * The post disappears on its own when your free time ends.
 */
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AudiencePicker, type Audience } from '@/components/audience-picker';
import { HandLogo } from '@/components/logo';
import { SentCelebration } from '@/components/sent-celebration';
import { PopButton } from '@/components/playful';
import { Chip, Row, Screen, T } from '@/components/ui';
import { WhenField } from '@/components/when-field';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { errorMessage, notify } from '@/lib/alert';
import { addFreeSlot, addRules, getMyCircles, sendPing } from '@/lib/api';
import { formatTime } from '@/lib/time';
import { PRESETS, minuteOfDay, type TimeRange } from '@/lib/when';
import { useAuth } from '@/providers/auth';

const IDEAS = ['Dinner', 'Coffee', 'Drinks', 'A walk', 'Watch something', 'Anything!'];

export default function NewPing() {
  const { profile } = useAuth();
  const [message, setMessage] = useState('');
  const [range, setRange] = useState<TimeRange>(() => (PRESETS[1].range() ?? PRESETS[0].range())!);
  const [repeat, setRepeat] = useState(false);
  const [audience, setAudience] = useState<Audience>({ visibility: 'friends', circleId: null });
  const [showWho, setShowWho] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { data: circles } = useData(getMyCircles);

  const send = async () => {
    setSending(true);
    try {
      const startsAt = new Date(range.start).toISOString();
      const endsAt = new Date(range.end).toISOString();
      await sendPing({
        message: message.trim(),
        gif_url: null,
        sticker: null,
        starts_at: startsAt,
        ends_at: endsAt,
        visibility: audience.visibility === 'circle' ? 'circle' : 'friends',
        circle_id: audience.circleId,
        activity_id: null,
        // Disappears when the free time is over.
        expires_at: new Date(Math.max(range.end, Date.now() + 15 * 60000)).toISOString(),
      });
      // Being free is also availability, so friends' "free" lists pick it up.
      await addFreeSlot(startsAt, endsAt, message.trim()).catch(() => {});
      if (repeat) {
        await addRules([
          { weekday: new Date(range.start).getDay(), start_minute: minuteOfDay(range.start), end_minute: minuteOfDay(range.end) || 1440 },
        ]).catch(() => {});
      }
      setSent(true);
    } catch (e) {
      notify("Couldn't send", errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const who =
    audience.visibility === 'circle' ? (circles ?? []).find((c) => c.id === audience.circleId)?.name ?? 'your group' : 'all your friends';

  if (sent) {
    const circle = audience.visibility === 'circle' ? (circles ?? []).find((c) => c.id === audience.circleId) : null;
    return (
      <Screen edges={['bottom']} center={false}>
        <SentCelebration me={profile} range={range} note={message.trim()} circleMemberIds={circle ? circle.memberIds : null} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} center={false}>
      <View style={{ gap: Spacing.lg }}>
        <T variant="largeTitle">When are you free?</T>
        <WhenField value={range} onChange={setRange} repeat={repeat} onRepeatChange={setRepeat} />
      </View>

      <View style={{ gap: Spacing.lg }}>
        <View style={{ gap: 2 }}>
          <T variant="title">Want to do something?</T>
          <T variant="body" color={Colors.textSecondary}>
            Optional. Pick one or type your own.
          </T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {IDEAS.map((m) => (
            <Chip key={m} label={m} selected={m === message} onPress={() => setMessage(m === message ? '' : m)} />
          ))}
        </View>
        <TextInput
          value={IDEAS.includes(message) ? '' : message}
          onChangeText={setMessage}
          placeholder="Or type something…"
          placeholderTextColor={Colors.textTertiary}
          maxLength={140}
          style={{
            fontFamily: Fonts.body,
            fontSize: 17,
            color: Colors.text,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: Colors.outline,
          }}
        />
      </View>

      <View style={{ gap: Spacing.md }}>
        <T variant="body" color={Colors.textSecondary}>
          {who === 'all your friends' ? 'All your friends' : `Only ${who}`} will see this until {formatTime(range.end)}. Then it disappears.
        </T>
        <Pressable onPress={() => setShowWho((v) => !v)} hitSlop={8}>
          <T variant="label" style={{ textDecorationLine: 'underline' }}>
            {showWho ? 'Done' : 'Only tell some friends'}
          </T>
        </Pressable>
        {showWho ? (
          <Animated.View entering={FadeInDown.duration(220)}>
            <AudiencePicker value={audience} onChange={setAudience} circles={circles ?? []} />
          </Animated.View>
        ) : null}
      </View>

      <PopButton onPress={send} disabled={sending}>
        <Row style={{ padding: 20, justifyContent: 'center' }} gap={10}>
          <HandLogo size={30} />
          <T variant="title" color={Colors.onAccent}>
            {sending ? 'Sending…' : 'Tell my friends'}
          </T>
        </Row>
      </PopButton>
    </Screen>
  );
}
