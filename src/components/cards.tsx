import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityWithPeople } from '@/lib/api';
import { formatRange, timeLeft } from '@/lib/time';
import type { Ping, Profile } from '@/lib/types';

import { Avatar, AvatarStack, Card, Row, T, displayName } from './ui';

export function ActivityCard({
  activity,
  profiles,
  meId,
}: {
  activity: ActivityWithPeople;
  profiles: Record<string, Profile>;
  meId?: string;
}) {
  const theme = useTheme();
  const going = activity.members.filter((m) => m.status === 'going');
  const imIn = activity.members.some((m) => m.user_id === meId);
  const host = profiles[activity.host_id];
  return (
    <Card onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}>
      <Row style={{ alignItems: 'flex-start' }} gap={Spacing.md}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            backgroundColor: theme.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 28 }}>{activity.emoji}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="heading" numberOfLines={1}>
            {activity.title}
          </T>
          <T variant="caption">{formatRange(activity.starts_at, activity.ends_at)}</T>
          {activity.location ? (
            <T variant="caption" numberOfLines={1}>
              📍 {activity.location}
            </T>
          ) : null}
        </View>
        {imIn ? (
          <View style={{ backgroundColor: theme.successSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T variant="caption" color={theme.success} style={{ fontWeight: '700' }}>
              {activity.host_id === meId ? 'Hosting' : 'Going'}
            </T>
          </View>
        ) : null}
      </Row>
      <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <AvatarStack profiles={going.map((m) => profiles[m.user_id])} />
        <T variant="caption">
          {going.length} going{host && activity.host_id !== meId ? ` · by ${displayName(host)}` : ''}
        </T>
      </Row>
    </Card>
  );
}

/** Story-style row of active pings. Unseen pings get a bright ring. */
export function PingStories({
  pings,
  profiles,
  viewed,
  meId,
}: {
  pings: Ping[];
  profiles: Record<string, Profile>;
  viewed: Set<string>;
  meId?: string;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.lg, paddingVertical: 4 }}>
      <Pressable onPress={() => router.push('/ping/new')} style={{ alignItems: 'center', gap: 6, width: 72 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: theme.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 28, color: theme.primary }}>＋</Text>
        </View>
        <T variant="caption" numberOfLines={1}>
          I'm free
        </T>
      </Pressable>
      {pings.map((p) => {
        const mine = p.sender_id === meId;
        const fresh = !mine && !viewed.has(p.id);
        return (
          <Pressable
            key={p.id}
            onPress={() => router.push({ pathname: '/ping/[id]', params: { id: p.id } })}
            style={{ alignItems: 'center', gap: 6, width: 72 }}>
            <Avatar profile={profiles[p.sender_id]} size={64} ring={fresh ? theme.primary : theme.border} />
            <T variant="caption" numberOfLines={1}>
              {mine ? 'You' : displayName(profiles[p.sender_id])}
            </T>
            <T variant="caption" style={{ fontSize: 11, marginTop: -6 }} color={fresh ? theme.primary : theme.textSecondary}>
              {timeLeft(p.expires_at)}
            </T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
