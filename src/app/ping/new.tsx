import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AudiencePicker, type Audience } from '@/components/audience-picker';
import { GifPicker, type GifChoice } from '@/components/gif-picker';
import { Icon } from '@/components/icon';
import { PopButton, Sticker } from '@/components/playful';
import { TimeRangePicker, type TimeRange } from '@/components/time-picker';
import { Chip, Row, Screen, T } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { errorMessage, notify } from '@/lib/alert';
import { addFreeSlot, getMyCircles, sendPing } from '@/lib/api';
import { formatTime } from '@/lib/time';

const VIBES = ['Dinner?', 'Drinks?', 'Coffee?', 'Walk?', 'Game night?', 'Anything!'];
const EXPIRY = [1, 3, 6, 24];

type Preset = { key: string; label: string; range: () => TimeRange | null };

const at = (dayOffset: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};

const PRESETS: Preset[] = [
  {
    key: 'now',
    label: 'Right now',
    range: () => {
      const start = Math.ceil(Date.now() / 900000) * 900000;
      return { start, end: start + 2 * 3600000 };
    },
  },
  {
    key: 'tonight',
    label: 'Tonight',
    range: () => {
      const end = at(0, 23);
      const start = Math.max(at(0, 18), Math.ceil(Date.now() / 1800000) * 1800000);
      return end - start >= 3600000 ? { start, end } : null;
    },
  },
  { key: 'tomorrow', label: 'Tomorrow night', range: () => ({ start: at(1, 18), end: at(1, 22) }) },
  {
    key: 'weekend',
    label: 'This weekend',
    range: () => {
      const toSat = (6 - new Date().getDay() + 7) % 7 || 7;
      return { start: at(toSat, 12), end: at(toSat, 18) };
    },
  },
];

export default function NewPing() {
  const [message, setMessage] = useState('');
  const [presetKey, setPresetKey] = useState<string>('tonight');
  const [custom, setCustom] = useState<TimeRange | null>(null);
  const [gif, setGif] = useState<GifChoice>({ gifUrl: null, sticker: null });
  const [audience, setAudience] = useState<Audience>({ visibility: 'friends', circleId: null });
  const [expiryHours, setExpiryHours] = useState(6);
  const [showOptions, setShowOptions] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<number | null | undefined>(undefined);
  const { data: circles } = useData(getMyCircles);

  const presets = PRESETS.filter((p) => p.range() !== null);
  const range: TimeRange | null =
    presetKey === 'custom' ? custom : (presets.find((p) => p.key === presetKey) ?? presets[0])?.range() ?? null;

  const send = async () => {
    if (!range) return notify('Pick a time');
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
    <Screen edges={['bottom']}>
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {presets.map((p) => (
            <Chip key={p.key} label={p.label} selected={presetKey === p.key} onPress={() => setPresetKey(p.key)} />
          ))}
          <Chip
            label="Pick a time"
            selected={presetKey === 'custom'}
            onPress={() => {
              setPresetKey('custom');
              if (!custom) setCustom(range ?? PRESETS[2].range());
            }}
          />
        </View>
        {presetKey === 'custom' && custom ? <TimeRangePicker value={custom} onChange={setCustom} /> : null}
        {range ? (
          <T variant="body" color={Colors.textSecondary}>
            {new Date(range.start).toLocaleDateString(undefined, { weekday: 'long' })}, {formatTime(range.start)} – {formatTime(range.end)}
          </T>
        ) : null}
      </View>

      <View style={{ gap: Spacing.lg }}>
        <Pressable onPress={() => setShowCover((v) => !v)} hitSlop={8}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="title">Add a sticker</T>
            <Icon name={showCover ? 'close' : 'plus'} size={18} />
          </Row>
        </Pressable>
        {showCover ? <GifPicker value={gif} onChange={setGif} /> : null}
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
          <View style={{ gap: Spacing.lg }}>
            <AudiencePicker value={audience} onChange={setAudience} circles={circles ?? []} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {EXPIRY.map((h) => (
                <Chip key={h} label={`Gone in ${h}h`} selected={h === expiryHours} onPress={() => setExpiryHours(h)} />
              ))}
            </View>
          </View>
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
