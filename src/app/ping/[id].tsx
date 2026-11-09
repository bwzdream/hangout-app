import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, AvatarStack, Bounce, Button, Loading, Row, T, displayName } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { confirm, errorMessage, notify } from '@/lib/alert';
import { deletePing, getPing, getPingResponses, getProfiles, markPingViewed, respondToPing } from '@/lib/api';
import { formatRange, timeLeft } from '@/lib/time';
import { useAuth } from '@/providers/auth';

const BACKGROUNDS = ['#FF5A36', '#7B5CFF', '#14B8A6', '#F59E0B', '#EC4899', '#3B82F6'];

export default function PingStory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const meId = session?.user.id;
  const [, tick] = useState(0);

  const { data, loading, reload } = useData(async () => {
    const ping = await getPing(id);
    if (!ping) return null;
    const responses = await getPingResponses(id);
    const profiles = await getProfiles([ping.sender_id, ...responses.map((r) => r.user_id)]);
    return { ping, responses, profiles };
  });

  useEffect(() => {
    if (data?.ping && data.ping.sender_id !== meId) markPingViewed(data.ping.id).catch(() => {});
  }, [data?.ping, meId]);

  // Keep the countdown fresh.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  if (loading && !data) return <Loading />;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: '#1B1530' }}>
        <Text style={{ fontSize: 64 }}>💨</Text>
        <T variant="title" color="#fff">
          This ping vanished
        </T>
        <Button title="Back" variant="secondary" onPress={close} />
      </SafeAreaView>
    );
  }

  const { ping, responses, profiles } = data;
  const sender = profiles[ping.sender_id];
  const mine = ping.sender_id === meId;
  const myResponse = responses.find((r) => r.user_id === meId)?.response ?? null;
  const inPeople = responses.filter((r) => r.response === 'in').map((r) => profiles[r.user_id]);
  const bg = BACKGROUNDS[ping.id.charCodeAt(0) % BACKGROUNDS.length];

  const respond = async (r: 'in' | 'maybe' | null) => {
    try {
      await respondToPing(ping.id, r);
      await reload();
    } catch (e) {
      notify('Oops', errorMessage(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <SafeAreaView style={{ flex: 1, padding: Spacing.lg, gap: Spacing.lg }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={Spacing.md}>
            <Avatar profile={sender} size={44} ring="#fff" />
            <View>
              <T variant="label" color="#fff">
                {mine ? 'You' : displayName(sender)}
              </T>
              <T variant="caption" color="rgba(255,255,255,0.8)">
                ⏳ {timeLeft(ping.expires_at)}
              </T>
            </View>
          </Row>
          <Pressable onPress={close} hitSlop={16}>
            <Text style={{ fontSize: 28, color: '#fff' }}>✕</Text>
          </Pressable>
        </Row>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xl }}>
          <Bounce>
            {ping.gif_url ? (
              <Image
                source={{ uri: ping.gif_url }}
                style={{ width: 280, height: 280, borderRadius: Radius.lg }}
                contentFit="cover"
              />
            ) : (
              <Text style={{ fontSize: 140 }}>{ping.sticker ?? '🎉'}</Text>
            )}
          </Bounce>
          <T variant="hero" color="#fff" style={{ textAlign: 'center' }}>
            {ping.message || `${mine ? "You're" : `${displayName(sender)} is`} free!`}
          </T>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: Radius.pill, paddingHorizontal: 18, paddingVertical: 10 }}>
            <T variant="label" color="#fff">
              🕒 {formatRange(ping.starts_at, ping.ends_at)}
            </T>
          </View>
          {inPeople.length > 0 ? (
            <Row>
              <AvatarStack profiles={inPeople} size={32} />
              <T variant="label" color="#fff">
                {inPeople.length} in!
              </T>
            </Row>
          ) : null}
        </View>

        {mine ? (
          <View style={{ gap: Spacing.sm }}>
            <Button
              title="Turn into a plan"
              icon="📍"
              variant="secondary"
              size="lg"
              onPress={() =>
                router.replace({
                  pathname: '/activity/new',
                  params: {
                    start: String(new Date(ping.starts_at).getTime()),
                    end: String(new Date(ping.ends_at).getTime()),
                    invite: responses.map((r) => r.user_id).join(','),
                    title: ping.message,
                  },
                })
              }
            />
            <Button
              title="Delete ping"
              variant="ghost"
              onPress={async () => {
                if (await confirm('Delete ping?', 'It will disappear for everyone.', 'Delete')) {
                  await deletePing(ping.id);
                  close();
                }
              }}
              style={{ opacity: 0.8 }}
            />
          </View>
        ) : (
          <Row style={{ justifyContent: 'center' }}>
            <Button
              title={myResponse === 'in' ? "You're in!" : "I'm in!"}
              icon="🙌"
              size="lg"
              variant={myResponse === 'in' ? 'accent' : 'secondary'}
              onPress={() => respond(myResponse === 'in' ? null : 'in')}
              style={{ flex: 1 }}
            />
            <Button
              title="Maybe"
              icon="🤔"
              size="lg"
              variant={myResponse === 'maybe' ? 'accent' : 'secondary'}
              onPress={() => respond(myResponse === 'maybe' ? null : 'maybe')}
            />
          </Row>
        )}
      </SafeAreaView>
    </View>
  );
}
