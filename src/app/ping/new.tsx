import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AudiencePicker, type Audience } from '@/components/audience-picker';
import { GifPicker, type GifChoice } from '@/components/gif-picker';
import { Icon } from '@/components/icon';
import { TimeRangePicker, defaultRange } from '@/components/time-picker';
import { Button, Card, Chip, Input, Screen, Section, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { errorMessage, notify } from '@/lib/alert';
import { addFreeSlot, getMyCircles, sendPing } from '@/lib/api';

const QUICK_MESSAGES = ['Who’s around?', 'Dinner?', 'Drinks?', 'Coffee?', 'Walk?', 'Game night?'];

const EXPIRY = [
  { label: '1 hr', hours: 1 },
  { label: '3 hrs', hours: 3 },
  { label: '6 hrs', hours: 6 },
  { label: '24 hrs', hours: 24 },
];

export default function NewPing() {
  const [range, setRange] = useState(defaultRange);
  const [message, setMessage] = useState('');
  const [gif, setGif] = useState<GifChoice>({ gifUrl: null, sticker: null });
  const [audience, setAudience] = useState<Audience>({ visibility: 'friends', circleId: null });
  const [expiryHours, setExpiryHours] = useState(6);
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
      setSent(notified);
      setTimeout(() => router.back(), 1400);
    } catch (e) {
      notify("Couldn't send", errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  if (sent !== undefined) {
    return (
      <Screen edges={['bottom']} scroll={false} contentStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={32} color={Colors.onAccent} />
        </View>
        <T variant="largeTitle">Sent</T>
        <T variant="caption" style={{ textAlign: 'center' }}>
          {sent ? `Notified ${sent} device${sent === 1 ? '' : 's'}.` : 'Your friends will see it on their home screen.'}
        </T>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Input
        value={message}
        onChangeText={setMessage}
        placeholder="What are you up for?"
        maxLength={140}
        style={{ fontSize: 22, fontWeight: '600', paddingVertical: 18 }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -Spacing.lg }}>
        {QUICK_MESSAGES.map((m) => (
          <Chip key={m} label={m} selected={m === message} onPress={() => setMessage(m)} />
        ))}
      </View>

      <Card>
        <TimeRangePicker value={range} onChange={setRange} />
      </Card>

      <Section title="Cover">
        <GifPicker value={gif} onChange={setGif} />
      </Section>

      <Section title="Who sees it">
        <AudiencePicker value={audience} onChange={setAudience} circles={circles ?? []} />
      </Section>

      <Section title="Disappears after">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {EXPIRY.map((e) => (
            <Chip key={e.label} label={e.label} selected={e.hours === expiryHours} onPress={() => setExpiryHours(e.hours)} />
          ))}
        </View>
      </Section>

      <Button title="Send ping" icon="bolt" size="lg" onPress={send} loading={sending} />
    </Screen>
  );
}
