import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AudiencePicker, type Audience } from '@/components/audience-picker';
import { GifPicker, type GifChoice } from '@/components/gif-picker';
import { TimeRangePicker, defaultRange } from '@/components/time-picker';
import { Bounce, Button, Card, Chip, Input, Screen, Section, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { errorMessage, notify } from '@/lib/alert';
import { addFreeSlot, getMyCircles, sendPing } from '@/lib/api';

const QUICK_MESSAGES = ['Who’s down? 🙋', 'Bored, entertain me 🥱', 'Food? 🍜', 'Drinks? 🍻', 'Walk & talk? 🚶', 'Games night? 🎮'];

const EXPIRY = [
  { label: '1h', hours: 1 },
  { label: '3h', hours: 3 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
];

export default function NewPing() {
  const [range, setRange] = useState(defaultRange);
  const [message, setMessage] = useState('');
  const [gif, setGif] = useState<GifChoice>({ gifUrl: null, sticker: '🎉' });
  const [audience, setAudience] = useState<Audience>({ visibility: 'friends', circleId: null });
  const [expiryHours, setExpiryHours] = useState(6);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<number | null | undefined>(undefined);
  const { data: circles } = useData(getMyCircles);

  const send = async () => {
    setSending(true);
    try {
      // A ping disappears at the chosen expiry, or when the free window ends — whichever is first.
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
      <Screen edges={['bottom']} contentStyle={{ alignItems: 'center', paddingTop: 80 }}>
        <Bounce>
          <Text style={{ fontSize: 96 }}>🚀</Text>
        </Bounce>
        <T variant="title" style={{ textAlign: 'center' }}>
          Pinged!
        </T>
        <T variant="caption" style={{ textAlign: 'center' }}>
          {sent ? `${sent} friend device${sent === 1 ? '' : 's'} buzzing right now` : 'Your friends will see it on their home screen'}
        </T>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Section title="When are you free?">
        <Card>
          <TimeRangePicker value={range} onChange={setRange} />
        </Card>
      </Section>

      <Section title="Say something">
        <Input value={message} onChangeText={setMessage} placeholder="Who's down for tacos? 🌮" maxLength={140} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QUICK_MESSAGES.map((m) => (
            <Chip key={m} label={m} selected={m === message} onPress={() => setMessage(m)} />
          ))}
        </View>
      </Section>

      <Section title="Make it cute ✨">
        <GifPicker value={gif} onChange={setGif} />
      </Section>

      <Section title="Who gets pinged?">
        <AudiencePicker value={audience} onChange={setAudience} circles={circles ?? []} />
      </Section>

      <Section title="Disappears in ⏳">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {EXPIRY.map((e) => (
            <Chip key={e.label} label={e.label} selected={e.hours === expiryHours} onPress={() => setExpiryHours(e.hours)} />
          ))}
        </View>
        <T variant="caption" style={{ marginTop: -Spacing.xs }}>
          Or when your free time ends, whichever comes first.
        </T>
      </Section>

      <Button title="Send ping" icon="📣" size="lg" onPress={send} loading={sending} />
    </Screen>
  );
}
