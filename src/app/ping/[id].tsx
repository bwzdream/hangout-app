import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, AvatarStack, Button, IconButton, Loading, Row, T, displayName } from '@/components/ui';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { confirm, errorMessage, notify } from '@/lib/alert';
import { deletePing, getPing, getPingResponses, getProfiles, markPingViewed, respondToPing } from '@/lib/api';
import { formatDay, formatTime, remainingFraction, timeLeft } from '@/lib/time';
import { useAuth } from '@/providers/auth';

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
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: Colors.background }}>
        <T variant="title">This ping has expired</T>
        <Button title="Close" variant="secondary" onPress={close} />
      </SafeAreaView>
    );
  }

  const { ping, responses, profiles } = data;
  const sender = profiles[ping.sender_id];
  const mine = ping.sender_id === meId;
  const myResponse = responses.find((r) => r.user_id === meId)?.response ?? null;
  const inPeople = responses.filter((r) => r.response === 'in').map((r) => profiles[r.user_id]);
  const headline = ping.message || `${mine ? "You're" : `${displayName(sender).split(' ')[0]} is`} free`;

  const respond = async (r: 'in' | 'maybe' | null) => {
    try {
      await respondToPing(ping.id, r);
      await reload();
    } catch (e) {
      notify('Something went wrong', errorMessage(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <SafeAreaView style={{ flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.xl - 4, gap: Spacing.xl }}>
        {/* Time remaining, like a story progress bar */}
        <View style={{ height: 3, borderRadius: 2, backgroundColor: Colors.surfaceRaised, overflow: 'hidden' }}>
          <View
            style={{
              height: 3,
              backgroundColor: Colors.accent,
              width: `${Math.max(4, remainingFraction(ping.created_at, ping.expires_at) * 100)}%`,
            }}
          />
        </View>

        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={Spacing.md}>
            <Avatar profile={sender} size={40} />
            <View>
              <T variant="label">{mine ? 'You' : displayName(sender)}</T>
              <T variant="caption">{timeLeft(ping.expires_at)}</T>
            </View>
          </Row>
          <IconButton icon="close" label="Close" onPress={close} />
        </Row>

        <View style={{ flex: 1, justifyContent: 'center', gap: Spacing.xl }}>
          {ping.gif_url ? (
            <Image source={{ uri: ping.gif_url }} style={{ width: '100%', aspectRatio: 1, borderRadius: Radius.xl }} contentFit="cover" />
          ) : ping.sticker ? (
            <Text style={{ fontSize: 64 }}>{ping.sticker}</Text>
          ) : null}

          <View style={{ gap: Spacing.md }}>
            <T variant="overline" color={Colors.accent}>
              {formatDay(ping.starts_at)}
            </T>
            <T variant="display">{headline}</T>
            <T variant="title" color={Colors.textSecondary} style={{ fontWeight: '600' }}>
              {formatTime(ping.starts_at)} – {formatTime(ping.ends_at)}
            </T>
          </View>

          {inPeople.length > 0 ? (
            <Row gap={Spacing.md}>
              <AvatarStack profiles={inPeople} size={30} />
              <T variant="caption">{inPeople.length} in</T>
            </Row>
          ) : null}
        </View>

        {mine ? (
          <View style={{ gap: Spacing.sm }}>
            <Button
              title="Make it a plan"
              size="lg"
              variant="white"
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
              variant="danger"
              onPress={async () => {
                if (await confirm('Delete ping?', 'It will disappear for everyone.', 'Delete')) {
                  await deletePing(ping.id);
                  close();
                }
              }}
            />
          </View>
        ) : (
          <Row>
            <Button
              title={myResponse === 'in' ? "You're in" : "I'm in"}
              icon={myResponse === 'in' ? 'check' : undefined}
              size="lg"
              variant={myResponse === 'in' ? 'primary' : 'white'}
              onPress={() => respond(myResponse === 'in' ? null : 'in')}
              style={{ flex: 1 }}
            />
            <Button
              title="Maybe"
              size="lg"
              variant="secondary"
              onPress={() => respond(myResponse === 'maybe' ? null : 'maybe')}
              style={myResponse === 'maybe' ? { borderWidth: 1.5, borderColor: Colors.text } : undefined}
            />
          </Row>
        )}
      </SafeAreaView>
    </View>
  );
}
