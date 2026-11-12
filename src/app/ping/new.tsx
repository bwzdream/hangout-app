import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AudiencePicker, type Audience } from '@/components/audience-picker';
import { GifPicker, type GifChoice } from '@/components/gif-picker';
import { Icon } from '@/components/icon';
import { PopButton, Sticker } from '@/components/playful';
import { WhenField } from '@/components/when-field';
import { Chip, Row, Screen, T } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { errorMessage, notify } from '@/lib/alert';
import { addFreeSlot, addRules, getMyCircles, sendPing } from '@/lib/api';
import { PRESETS, minuteOfDay, type TimeRange } from '@/lib/when';

const VIBES = ['Dinner?', 'Drinks?', 'Coffee?', 'Walk?', 'Game night?', 'Anything!'];
const EXPIRY = [1, 3, 6, 24];

export default function NewPing() {
  const [message, setMessage] = useState('');
  const [range, setRange] = useState<TimeRange>(() => (PRESETS[1].range() ?? PRESETS[0].range())!);
  const [repeat, setRepeat] = useState(false);
  const [gif, setGif] = useState<GifChoice>({ gifUrl: null, sticker: null });
  const [audience, setAudience] = useState<Audience>({ visibility: 'friends', circleId: null });
  const [expiryHours, setExpiryHours] = useState(6);
  const [showOptions, setShowOptions] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<number | null | undefined>(undefined);
  const { data: circles } = useData(getMyCircles);

  const send = async () => {
    setSending(true);
    try {
      // A ping disappears at the chosen expiry or when the free window ends, whichever is first.
      const expires = Math.min(Date.now() + expiryHours * 3600000, range.end);
      const startsAt = new Date(range.start).toISOString();
      const endsAt = new Date(range.end).toISOString();
      const { notified } = await sendPing({
        message: message.trim(),
        gif_url: gif.gifUrl,
        sticker: gif.gifUrl ? null : gif.sticker,
        starts_at: startsAt,
        ends_at: endsAt,
        visibility: audience.visibility === 'circle' ? 'circle' : 'friends',
        circle_id: audience.circleId,
        activity_id: null,
        expires_at: new Date(Math.max(expires, Date.now() + 15 * 60000)).toISOString(),
      });
      // Being free is also availability, so overlaps pick it up.
      await addFreeSlot(startsAt, endsAt, message.trim()).catch(() => {});
      if (repeat) {
        await addRules([
          { weekday: new Date(range.start).getDay(), start_minute: minuteOfDay(range.start), end_minute: minuteOfDay(range.end) || 1440 },
        ]).catch(() => {});
      }
      setSent(notified);
      setTimeout(() => router.back(), 1600);
    } catch (e) {
      notify("Couldn't send", errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  if (sent !== undefined) {
    return (
      <Screen edges={['bottom']} scroll={false} contentStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.xl }}>
        <Sticker icon="check" size={96} color={Colors.accent} iconColor={Colors.onAccent} />
        <T variant="display" style={{ textAlign: 'center' }}>
          Sent!
        </T>
        <T variant="body" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
          {sent ? `${sent} phone${sent === 1 ? ' is' : 's are'} buzzing.` : 'Your friends will see it on their home screen.'}
        </T>
      </Screen>
    );
  }

  const audienceLabel =
    audience.visibility === 'circle' ? (circles ?? []).find((c) => c.id === audience.circleId)?.name ?? 'A circle' : 'All friends';

  return (
    <Screen edges={['bottom']} center={false}>
      <View style={{ gap: Spacing.lg }}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="What's the vibe?"
          placeholderTextColor={Colors.textTertiary}
          maxLength={140}
          multiline
          style={{ fontFamily: Fonts.display, fontSize: 40, lineHeight: 46, color: Colors.text, paddingVertical: 4 }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {VIBES.map((m) => (
            <Chip key={m} label={m} selected={m === message} onPress={() => setMessage(m)} />
          ))}
        </View>
      </View>

      <View style={{ gap: Spacing.lg }}>
        <T variant="title">When?</T>
        <WhenField value={range} onChange={setRange} repeat={repeat} onRepeatChange={setRepeat} />
      </View>

      <View style={{ gap: Spacing.lg }}>
        <Pressable onPress={() => setShowCover((v) => !v)} hitSlop={8}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="title">Add a sticker</T>
            <Icon name={showCover ? 'close' : 'plus'} size={18} />
          </Row>
        </Pressable>
        {showCover ? (
          <Animated.View entering={FadeInDown.duration(220)}>
            <GifPicker value={gif} onChange={setGif} />
          </Animated.View>
        ) : null}
      </View>

      <View style={{ gap: Spacing.lg }}>
        <Pressable onPress={() => setShowOptions((v) => !v)} hitSlop={8}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="body" color={Colors.textSecondary}>
              {audienceLabel} · gone in {expiryHours}h
            </T>
            <T variant="label" style={{ textDecorationLine: 'underline' }}>
              {showOptions ? 'Done' : 'Change'}
            </T>
          </Row>
        </Pressable>
        {showOptions ? (
          <Animated.View entering={FadeInDown.duration(220)} style={{ gap: Spacing.lg }}>
            <AudiencePicker value={audience} onChange={setAudience} circles={circles ?? []} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {EXPIRY.map((h) => (
                <Chip key={h} label={`Gone in ${h}h`} selected={h === expiryHours} onPress={() => setExpiryHours(h)} />
              ))}
            </View>
          </Animated.View>
        ) : null}
      </View>

      <PopButton onPress={send} disabled={sending}>
        <Row style={{ padding: 20, justifyContent: 'center' }} gap={10}>
          <Icon name="bolt" size={22} color={Colors.onAccent} />
          <T variant="title" color={Colors.onAccent}>
            {sending ? 'Sending…' : 'Send ping'}
          </T>
        </Row>
      </PopButton>
    </Screen>
  );
}
